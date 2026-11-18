-- Client close-out and feedback.
--
-- When an engagement is Closed (feature 1, rush.project_delivery), the board
-- creates a one-time feedback link and passes it to the client itself. Nothing
-- here sends email or any other message. Only a SHA-256 digest of the link
-- token is stored; the raw token is returned once to the board member who
-- created it. A link works once, expires after 30 days, and is replaced when
-- the board creates a new one.
--
-- The client's answers (satisfaction, would-rehire, quote, quote and logo
-- permission with scope) are kept here as board operating data, and are also
-- copied into a DRAFT evidence record (rush.member_tool_records, kind
-- 'evidence') owned by the project lead in the cycle the board chose. That
-- record starts Pending verification and Restricted sharing like any other
-- evidence entry; the lead completes the required fields and an explicit
-- evidence reviewer verifies it. Board rank alone still never reads it.
--
-- Access: board-only RPCs for the overview and link management (actor
-- checked, audited); two token-checked RPCs for the client form, callable
-- without signing in. Audit metadata carries flags and IDs, never the quote,
-- scope or attribution text.
create table rush.client_feedback (
 project_id text primary key references rush.projects(id) on delete cascade,
 cycle_id text not null references rush.rush_cycles(id) on delete cascade,
 lead_id uuid not null references rush.profiles(id),
 token_digest text unique check (token_digest ~ '^[0-9a-f]{64}$'),
 expires_at timestamptz,
 requested_at timestamptz not null default now(),
 requested_by uuid references rush.profiles(id) on delete set null,
 submitted_at timestamptz,
 satisfaction smallint check (satisfaction between 1 and 5),
 would_rehire text check (would_rehire in ('YES','MAYBE','NO')),
 quote text not null default '' check (char_length(quote) <= 1000),
 attribution text not null default '' check (char_length(attribution) <= 200),
 quote_permission boolean,
 logo_permission boolean,
 permission_scope text not null default '' check (char_length(permission_scope) <= 1000),
 evidence_record_id uuid references rush.member_tool_records(id) on delete set null,
 check ((submitted_at is null) = (satisfaction is null)),
 check (submitted_at is null or token_digest is null)
);
alter table rush.client_feedback enable row level security;
alter table rush.client_feedback force row level security;
-- No policies and no table grants: access is exclusively through the RPCs.
revoke all on rush.client_feedback from public, anon, authenticated;

create function rush.client_feedback_digest(raw_token text) returns text
language sql immutable set search_path='' as $$
 select case when raw_token ~ '^[0-9a-f]{64}$' then encode(extensions.digest(raw_token,'sha256'),'hex') end;
$$;

create function rush.client_feedback_json(target_project_id text) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'projectId',f.project_id,'cycleId',f.cycle_id,
  'leadName',(select p.display_name from rush.profiles p where p.id=f.lead_id),
  'state',case when f.submitted_at is not null then 'RECEIVED' when f.token_digest is null then 'REVOKED'
   when f.expires_at<=now() then 'EXPIRED' else 'ACTIVE' end,
  'requestedAt',f.requested_at,'expiresAt',f.expires_at,'submittedAt',f.submitted_at,
  'satisfaction',f.satisfaction,'wouldRehire',f.would_rehire,'quote',f.quote,'attribution',f.attribution,
  'quotePermission',f.quote_permission,'logoPermission',f.logo_permission,'permissionScope',f.permission_scope,
  'evidenceCreated',f.evidence_record_id is not null)
 from rush.client_feedback f where f.project_id=target_project_id;
$$;

-- Board view: one entry per project that has a close-out request.
create function rush.client_closeout_overview() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not rush.engagement_is_board() then raise exception 'Board access required' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(rush.client_feedback_json(f.project_id) order by f.requested_at) from rush.client_feedback f),'[]'::jsonb);
end; $$;

-- The lead must be able to own an evidence record in the chosen cycle, so the
-- draft lands somewhere they can see it.
create function rush.create_client_feedback_link(target_project_id text, target_cycle_id text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid := rush.actor_id(); d rush.project_delivery%rowtype; existing rush.client_feedback%rowtype;
 raw_token text := encode(extensions.gen_random_bytes(32),'hex'); expires timestamptz := now() + interval '30 days';
begin
 if not rush.engagement_is_board() or target_cycle_id is null
  or not rush.has_cycle_role(target_cycle_id,array['BOARD','OWNER']::rush.member_role[]) then
  raise exception 'Board access in this cycle required' using errcode='42501'; end if;
 select * into d from rush.project_delivery where project_id=target_project_id for update;
 if not found or d.status<>'CLOSED' then raise exception 'Close the project before asking for feedback' using errcode='22023'; end if;
 if d.lead_id is null or not exists(select 1 from rush.memberships m join rush.profiles p on p.id=m.user_id
  where m.cycle_id=target_cycle_id and m.user_id=d.lead_id and m.active and p.active and m.role in ('MEMBER','BOARD','PANEL','OWNER')) then
  raise exception 'Assign a lead who is an active member of this cycle first' using errcode='22023'; end if;
 select * into existing from rush.client_feedback where project_id=target_project_id for update;
 if found and existing.submitted_at is not null then raise exception 'Feedback already received for this project' using errcode='55000'; end if;
 insert into rush.client_feedback(project_id,cycle_id,lead_id,token_digest,expires_at,requested_at,requested_by)
 values(target_project_id,target_cycle_id,d.lead_id,rush.client_feedback_digest(raw_token),expires,now(),actor)
 on conflict(project_id) do update set cycle_id=excluded.cycle_id, lead_id=excluded.lead_id, token_digest=excluded.token_digest,
  expires_at=excluded.expires_at, requested_at=excluded.requested_at, requested_by=excluded.requested_by;
 insert into rush.audit_events(actor_id,cycle_id,action,resource,resource_id,metadata)
 values(actor,target_cycle_id,'CLIENT_FEEDBACK_LINK_CREATED','Project',target_project_id,
  jsonb_build_object('replacedPrevious',existing.project_id is not null,'leadId',d.lead_id,'expiresAt',expires));
 return jsonb_build_object('token',raw_token,'expiresAt',expires,'feedback',rush.client_feedback_json(target_project_id));
end; $$;

create function rush.revoke_client_feedback_link(target_project_id text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare f rush.client_feedback%rowtype;
begin
 if not rush.engagement_is_board() then raise exception 'Board access required' using errcode='42501'; end if;
 update rush.client_feedback set token_digest=null
  where project_id=target_project_id and submitted_at is null and token_digest is not null returning * into f;
 if not found then raise exception 'No open feedback link for this project' using errcode='55000'; end if;
 insert into rush.audit_events(actor_id,cycle_id,action,resource,resource_id,metadata)
 values(rush.actor_id(),f.cycle_id,'CLIENT_FEEDBACK_LINK_REVOKED','Project',target_project_id,'{}'::jsonb);
 return rush.client_feedback_json(target_project_id);
end; $$;

-- Token holder only: what the form needs to show, nothing about the team.
create function rush.client_feedback_form(raw_token text) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('projectTitle',pr.title,'clientLabel',pr.client_label,'expiresAt',f.expires_at)
 from rush.client_feedback f join rush.projects pr on pr.id=f.project_id
 where f.token_digest=rush.client_feedback_digest(raw_token) and f.submitted_at is null and f.expires_at>now();
$$;

create function rush.submit_client_feedback(raw_token text, payload jsonb) returns boolean
language plpgsql security definer set search_path='' as $$
declare f rush.client_feedback%rowtype; title text; record_id uuid := gen_random_uuid();
 sat int; rehire text; quote_text text; credit text; scope text; quote_ok boolean; logo_ok boolean; result_text text; use_text text;
begin
 if jsonb_typeof(payload) is distinct from 'object'
  or exists(select 1 from jsonb_object_keys(payload) k where k not in ('satisfaction','wouldRehire','quote','attribution','quotePermission','logoPermission','permissionScope'))
  or jsonb_typeof(payload->'satisfaction') is distinct from 'number'
  or jsonb_typeof(payload->'wouldRehire') is distinct from 'string'
  or jsonb_typeof(payload->'quote') is distinct from 'string' or jsonb_typeof(payload->'attribution') is distinct from 'string'
  or jsonb_typeof(payload->'permissionScope') is distinct from 'string'
  or jsonb_typeof(payload->'quotePermission') is distinct from 'boolean' or jsonb_typeof(payload->'logoPermission') is distinct from 'boolean' then
  raise exception 'Check the feedback form' using errcode='22023'; end if;
 if payload->>'satisfaction' !~ '^[1-5]$' then raise exception 'Choose a satisfaction rating from 1 to 5' using errcode='22023'; end if;
 sat := (payload->>'satisfaction')::int;
 rehire := payload->>'wouldRehire';
 quote_text := trim(payload->>'quote'); credit := trim(payload->>'attribution'); scope := trim(payload->>'permissionScope');
 quote_ok := (payload->>'quotePermission')::boolean; logo_ok := (payload->>'logoPermission')::boolean;
 if rehire not in ('YES','MAYBE','NO') then raise exception 'Say whether you would work with MECG again' using errcode='22023'; end if;
 if char_length(quote_text)>1000 or char_length(credit)>200 or char_length(scope)>1000 then raise exception 'Shorten your answers' using errcode='22023'; end if;
 if quote_ok and quote_text='' then raise exception 'Add the quote you are allowing us to use' using errcode='22023'; end if;
 if (quote_ok or logo_ok) and scope='' then raise exception 'Say where and how we may use it' using errcode='22023'; end if;

 select * into f from rush.client_feedback where token_digest=rush.client_feedback_digest(raw_token) for update;
 if not found or f.submitted_at is not null or f.expires_at<=now() then
  raise exception 'This feedback link has expired or was already used' using errcode='P0002'; end if;
 select pr.title into title from rush.projects pr where pr.id=f.project_id;

 -- The draft holds only fields the evidence form knows; the lead completes the
 -- required ones (problem, approach, deliverable link, measurement).
 result_text := format('Client close-out feedback, %s: satisfaction %s of 5; would work with MECG again: %s.',
  to_char(now() at time zone 'America/Detroit','YYYY-MM-DD'), sat,
  case rehire when 'YES' then 'yes' when 'MAYBE' then 'maybe' else 'no' end)
  || case when quote_text<>'' then E'\n\nClient quote: "' || quote_text || '"' || case when credit<>'' then ' (' || credit || ')' else '' end else '' end;
 use_text := format('Client close-out form: quote %s; logo %s.',
  case when quote_ok then 'may be used' else 'not permitted' end, case when logo_ok then 'may be used' else 'not permitted' end)
  || case when scope<>'' then ' Scope: ' || scope else '' end
  || ' Confirm the respondent can grant this before clearing.';
 insert into rush.member_tool_records(id,cycle_id,kind,owner_id,content)
 values(record_id,f.cycle_id,'evidence',f.lead_id,jsonb_build_object('title',left(trim(title),1000),'result',result_text,'allowedUse',use_text));

 update rush.client_feedback set token_digest=null, submitted_at=now(), satisfaction=sat, would_rehire=rehire,
  quote=quote_text, attribution=credit, quote_permission=quote_ok, logo_permission=logo_ok, permission_scope=scope,
  evidence_record_id=record_id
  where project_id=f.project_id;
 insert into rush.audit_events(actor_id,cycle_id,action,resource,resource_id,metadata)
 values(null,f.cycle_id,'CLIENT_FEEDBACK_SUBMITTED','Project',f.project_id,
  jsonb_build_object('evidenceRecordId',record_id,'leadId',f.lead_id,'quotePermission',quote_ok,'logoPermission',logo_ok,'hasQuote',quote_text<>''));
 return true;
end; $$;

-- A draft from close-out lacks required evidence fields until the lead
-- completes it. Only a complete record can be marked anything but Pending.
create or replace function rush.review_member_tool(c text,k text,record_id uuid,expected_revision integer,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r rush.member_tool_records%rowtype; key_name text; verification text:=payload->>'verification'; sharing text:=payload->>'sharing';
begin
 if not rush.member_tool_reviewer(c,k) then raise exception 'Explicit tool reviewer access required' using errcode='42501'; end if;
 if k='pipeline' then raise exception 'Pipeline uses stage evidence, not review clearance' using errcode='22023'; end if;
 if jsonb_typeof(payload) is distinct from 'object' then raise exception 'Invalid review' using errcode='22023'; end if;
 if exists(select 1 from jsonb_object_keys(payload) key where key not in ('verification','sharing','note','source','scope')) then raise exception 'Unknown review field' using errcode='22023'; end if;
 foreach key_name in array array['verification','sharing','note','source','scope'] loop
  if jsonb_typeof(payload->key_name) is distinct from 'string' or length(payload->>key_name)>(case when key_name='source' then 1000 else 4000 end) then raise exception 'Invalid review fields' using errcode='22023'; end if;
 end loop;
 if verification not in ('Pending','Needs changes','Verified') or sharing not in ('Restricted','Cleared for specified use','Withdrawn')
 or (verification<>'Pending' and trim(payload->>'note')='')
 or (payload->>'source'<>'' and (payload->>'source' !~ '^https://[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?([/?#][^[:space:]]*)?$' or payload->>'source' ~ '^https://[^/]*@'))
 or (sharing='Cleared for specified use' and (verification<>'Verified' or payload->>'source'='' or trim(payload->>'scope')=''))
 then raise exception 'Review needs supporting notes and a permission source/scope for clearance' using errcode='22023'; end if;
 if expected_revision is null then raise exception 'Revision required' using errcode='22023'; end if;
 select * into r from rush.member_tool_records where id=record_id and cycle_id=c and kind=k for update;
 if not found then raise exception 'Record unavailable' using errcode='42501'; end if;
 if r.owner_id=rush.actor_id() then raise exception 'A different reviewer must verify your work' using errcode='42501'; end if;
 if r.revision<>expected_revision then raise exception 'Record changed. Reload before reviewing.' using errcode='55000'; end if;
 if verification<>'Pending' or sharing<>'Restricted' then
  begin perform rush.validate_member_tool_content(k,r.content);
  exception when sqlstate '22023' then raise exception 'The owner must complete this draft before review' using errcode='22023'; end;
 end if;
 update rush.member_tool_records set review=(payload - 'reviewerId') || jsonb_build_object('reviewerId',rush.actor_id()),revision=revision+1,updated_at=now()
 where id=record_id returning * into r;
 insert into rush.audit_events(actor_id,cycle_id,action,resource,resource_id,metadata)
 values(rush.actor_id(),c,'MEMBER_TOOL_REVIEWED','MemberTool',record_id::text,jsonb_build_object('kind',k,'revision',r.revision));
 return to_jsonb(r);
end; $$;

revoke all on function rush.client_feedback_digest(text), rush.client_feedback_json(text), rush.client_closeout_overview(),
 rush.create_client_feedback_link(text,text), rush.revoke_client_feedback_link(text),
 rush.client_feedback_form(text), rush.submit_client_feedback(text,jsonb) from public, anon, authenticated;
grant execute on function rush.client_closeout_overview(), rush.create_client_feedback_link(text,text),
 rush.revoke_client_feedback_link(text) to authenticated;
grant execute on function rush.client_feedback_form(text), rush.submit_client_feedback(text,jsonb) to anon, authenticated;
