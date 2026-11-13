-- Private operations, independent of recruitment permissions and publication.
create table rush.member_tool_reviewers (
 cycle_id text not null references rush.rush_cycles(id) on delete cascade,
 kind text not null check (kind in ('pipeline','evidence','lab')),
 user_id uuid not null references rush.profiles(id) on delete cascade,
 primary key(cycle_id,kind,user_id)
);
create table rush.member_tool_records (
 id uuid primary key,
 cycle_id text not null references rush.rush_cycles(id) on delete cascade,
 kind text not null check (kind in ('pipeline','evidence','lab')),
 owner_id uuid not null references rush.profiles(id),
 content jsonb not null,
 review jsonb not null default '{"verification":"Pending","sharing":"Restricted","note":"","source":"","scope":"","reviewerId":null}',
 revision integer not null default 1,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index member_tool_records_scope on rush.member_tool_records(cycle_id,kind,updated_at desc);
alter table rush.member_tool_reviewers enable row level security;
alter table rush.member_tool_records enable row level security;
-- No table grants/policies: access is exclusively through actor-checked RPCs.
revoke all on rush.member_tool_reviewers, rush.member_tool_records from public, anon, authenticated;

create function rush.member_tool_access(c text, k text) returns boolean
language sql stable security definer set search_path='' as $$
 select rush.has_cycle_role(c,array['MEMBER','BOARD','PANEL','OWNER','RECRUITMENT_COMMITTEE']::rush.member_role[])
 and k in ('pipeline','evidence','lab');
$$;
create function rush.member_tool_reviewer(c text,k text) returns boolean
language sql stable security definer set search_path='' as $$
 select rush.member_tool_access(c,k) and exists(select 1 from rush.member_tool_reviewers r where r.cycle_id=c and r.kind=k and r.user_id=rush.actor_id());
$$;
create function rush.member_tool_workspace(c text,k text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not rush.member_tool_access(c,k) then raise exception 'Membership required' using errcode='42501'; end if;
 return jsonb_build_object('canReview',rush.member_tool_reviewer(c,k),
 'canManageAccess',rush.has_cycle_role(c,array['OWNER']::rush.member_role[]),
 'records',coalesce((select jsonb_agg(to_jsonb(r) || jsonb_build_object('owner_name',(select p.display_name from rush.profiles p where p.id=r.owner_id)) order by r.updated_at desc) from rush.member_tool_records r
 where r.cycle_id=c and r.kind=k and (r.owner_id=rush.actor_id() or rush.member_tool_reviewer(c,k))),'[]'::jsonb));
end; $$;

create function rush.validate_member_tool_content(k text, payload jsonb) returns void
language plpgsql immutable set search_path='' as $$
declare spec jsonb := '{"pipeline": [{"key": "title", "label": "Company or organization", "required": true}, {"key": "track", "label": "Opportunity type", "options": ["Client", "Sponsor"], "required": true}, {"key": "stage", "label": "Stage", "options": ["Research", "Qualified", "Conversation", "Proposal", "Agreed", "Dormant", "Closed"], "required": true}, {"key": "problem", "label": "Business problem or support ask", "type": "textarea", "required": true}, {"key": "source", "label": "Source link", "type": "url", "required": true}, {"key": "introduction", "label": "Contact or warm introduction route", "hint": "Record a route, not an assumed introduction or permission to send."}, {"key": "qualification", "label": "Qualification or stage evidence", "type": "textarea", "hint": "Required beyond Research. For Agreed, link the written agreement here."}, {"key": "lastConversation", "label": "Last meaningful conversation", "type": "date"}, {"key": "nextAction", "label": "Next action", "required": true}, {"key": "nextDate", "label": "Next-action date", "type": "date", "hint": "Leave blank unless agreed."}], "evidence": [{"key": "title", "label": "Project title", "required": true}, {"key": "problem", "label": "Problem and context", "type": "textarea", "required": true}, {"key": "approach", "label": "Approach and your contribution", "type": "textarea", "required": true}, {"key": "source", "label": "Original deliverable link", "type": "url", "required": true}, {"key": "result", "label": "Result or deliverable produced", "type": "textarea", "required": true, "hint": "Distinguish measured results, client reports and estimates. Unknown impact is acceptable."}, {"key": "measurement", "label": "Measurement method, baseline and limitations", "type": "textarea", "required": true}, {"key": "feedback", "label": "Client feedback source", "type": "url"}, {"key": "permission", "label": "Permission source", "type": "url", "hint": "Optional. Submission does not authorize sharing."}, {"key": "allowedUse", "label": "Requested or documented sharing scope", "type": "textarea", "hint": "Specify audience, channels, names, logos, quotes and restrictions."}], "lab": [{"key": "title", "label": "Demo title", "required": true}, {"key": "problem", "label": "User, decision and scope", "type": "textarea", "required": true}, {"key": "source", "label": "Demo or recorded fallback link", "type": "url", "required": true}, {"key": "setup", "label": "Reproduction steps and tool/model version", "type": "textarea", "required": true}, {"key": "evaluation", "label": "Evaluation report link", "type": "url", "required": true, "hint": "Question-by-question baseline, AI output, citation, expected result and observed error."}, {"key": "baseline", "label": "Manual baseline and observed comparison", "type": "textarea", "required": true}, {"key": "effort", "label": "Setup, verification effort and cost assumptions", "type": "textarea", "required": true}, {"key": "limits", "label": "Failures, risks and maintenance handoff", "type": "textarea", "required": true}, {"key": "recommendation", "label": "Recommendation", "options": ["Adopt", "Revise", "Do not adopt"], "required": true}]}'::jsonb; f jsonb; v text; key_name text;
begin
 if jsonb_typeof(payload) is distinct from 'object' or not spec ? k then raise exception 'Invalid form' using errcode='22023'; end if;
 for key_name in select jsonb_object_keys(payload) loop
  if not exists(select 1 from jsonb_array_elements(spec->k) field where field->>'key'=key_name) then raise exception 'Unknown field' using errcode='22023'; end if;
 end loop;
 for f in select * from jsonb_array_elements(spec->k) loop
  key_name:=f->>'key'; v:=coalesce(payload->>key_name,'');
  if (payload ? key_name and jsonb_typeof(payload->key_name)<>'string') or v<>trim(v)
   or (coalesce((f->>'required')::boolean,false) and v='')
   or length(v)>(case when f->>'type'='textarea' then 4000 else 1000 end)
   or (v<>'' and f ? 'options' and not (f->'options') ? v)
   or (v<>'' and f->>'type'='url' and (v !~ '^https://[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?([/?#][^[:space:]]*)?$' or v ~ '^https://[^/]*@'))
  then raise exception 'Check %',f->>'label' using errcode='22023'; end if;
  if v<>'' and f->>'type'='date' then
   if v !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'Invalid date' using errcode='22023'; end if;
   begin perform v::date; exception when others then raise exception 'Invalid date' using errcode='22023'; end;
  end if;
 end loop;
 if k='pipeline' and payload->>'stage'<>'Research' and coalesce(payload->>'qualification','')='' then raise exception 'Add evidence for this stage' using errcode='22023'; end if;
end; $$;

create function rush.save_member_tool(c text,k text,record_id uuid,expected_revision integer,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r rush.member_tool_records%rowtype; actor uuid:=rush.actor_id();
begin
 if not rush.member_tool_access(c,k) then raise exception 'Membership required' using errcode='42501'; end if;
 perform rush.validate_member_tool_content(k,payload);
 if expected_revision is null or expected_revision<0 or record_id is null then raise exception 'Invalid revision or record ID' using errcode='22023'; end if;
 if expected_revision=0 then
  -- Client-selected ID makes a retry after a lost response idempotent.
  insert into rush.member_tool_records(id,cycle_id,kind,owner_id,content) values(record_id,c,k,actor,payload) on conflict(id) do nothing;
  select * into r from rush.member_tool_records where id=record_id for update;
  if r.cycle_id<>c or r.kind<>k or r.owner_id<>actor then raise exception 'Record unavailable' using errcode='42501'; end if;
  if r.content<>payload or r.revision<>1 then raise exception 'Record changed. Reload before saving.' using errcode='55000'; end if;
 else
  select * into r from rush.member_tool_records where id=record_id and cycle_id=c and kind=k for update;
  if not found or (r.owner_id<>actor and not rush.member_tool_reviewer(c,k)) then raise exception 'Record unavailable' using errcode='42501'; end if;
  if r.revision<>expected_revision then raise exception 'Record changed. Reload before saving.' using errcode='55000'; end if;
  update rush.member_tool_records set content=payload,revision=revision+1,updated_at=now(),
   review='{"verification":"Pending","sharing":"Restricted","note":"","source":"","scope":"","reviewerId":null}'::jsonb
   where id=record_id returning * into r;
 end if;
 insert into rush.audit_events(actor_id,cycle_id,action,resource,resource_id,metadata)
 values(actor,c,'MEMBER_TOOL_SAVED','MemberTool',record_id::text,jsonb_build_object('kind',k,'revision',r.revision));
 return to_jsonb(r);
end; $$;

create function rush.review_member_tool(c text,k text,record_id uuid,expected_revision integer,payload jsonb) returns jsonb
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
 update rush.member_tool_records set review=(payload - 'reviewerId') || jsonb_build_object('reviewerId',rush.actor_id()),revision=revision+1,updated_at=now()
 where id=record_id returning * into r;
 insert into rush.audit_events(actor_id,cycle_id,action,resource,resource_id,metadata)
 values(rush.actor_id(),c,'MEMBER_TOOL_REVIEWED','MemberTool',record_id::text,jsonb_build_object('kind',k,'revision',r.revision));
 return to_jsonb(r);
end; $$;

create function rush.set_member_tool_reviewer(c text,k text,target_user uuid,enabled boolean) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 if not rush.has_cycle_role(c,array['OWNER']::rush.member_role[]) then raise exception 'Owner access required' using errcode='42501'; end if;
 if k not in ('pipeline','evidence','lab') or k is null or enabled is null then raise exception 'Invalid tool access' using errcode='22023'; end if;
 if enabled then
  if not exists(select 1 from rush.memberships m join rush.profiles p on p.id=m.user_id where m.cycle_id=c and m.user_id=target_user and m.active and p.active) then raise exception 'Active membership required' using errcode='22023'; end if;
  insert into rush.member_tool_reviewers values(c,k,target_user) on conflict do nothing;
 else delete from rush.member_tool_reviewers where cycle_id=c and kind=k and user_id=target_user; end if;
 insert into rush.audit_events(actor_id,cycle_id,action,resource,resource_id,metadata)
 values(rush.actor_id(),c,'MEMBER_TOOL_ACCESS_CHANGED','MemberToolAccess',target_user::text,jsonb_build_object('kind',k,'enabled',enabled));
 return true;
end; $$;

revoke all on function rush.member_tool_access(text,text),rush.member_tool_reviewer(text,text),rush.validate_member_tool_content(text,jsonb),rush.member_tool_workspace(text,text),rush.save_member_tool(text,text,uuid,integer,jsonb),rush.review_member_tool(text,text,uuid,integer,jsonb),rush.set_member_tool_reviewer(text,text,uuid,boolean) from public, anon, authenticated;
grant execute on function rush.member_tool_workspace(text,text),rush.save_member_tool(text,text,uuid,integer,jsonb),rush.review_member_tool(text,text,uuid,integer,jsonb),rush.set_member_tool_reviewer(text,text,uuid,boolean) to authenticated;
