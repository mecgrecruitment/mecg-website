-- Board decision log: dated board decisions with category, outcome, the vote
-- if one was taken, and a link to the minutes.
--
-- Decisions are an organisation record, not a recruitment-cycle record, so the
-- log is org-wide like rush.projects. Decisions can concern members, money or
-- clients, so nothing here is readable through a table grant. Access is only
-- through the actor-checked functions below: an active BOARD or OWNER member
-- (in any cycle, with an active profile) reads and writes every entry.
-- There is no delete. A wrong entry is corrected by editing it (every edit is
-- audited) or marked Withdrawn, so the log keeps its history.
-- Writes carry an optimistic revision. Audit metadata records the category,
-- outcome, date, vote counts and which fields changed, never the title,
-- summary or minutes link.
create table rush.board_decisions (
 id uuid primary key default gen_random_uuid(),
 decided_on date not null,
 title text not null check (char_length(title) between 1 and 200 and title=btrim(title)),
 category text not null check (category in ('MEMBERSHIP','RECRUITMENT','FINANCE','CLIENTS','OPERATIONS','POLICY','OTHER')),
 outcome text not null check (outcome in ('APPROVED','REJECTED','DEFERRED','NOTED','WITHDRAWN')),
 summary text not null default '' check (char_length(summary) <= 2000),
 votes_for integer check (votes_for between 0 and 200),
 votes_against integer check (votes_against between 0 and 200),
 votes_abstain integer check (votes_abstain between 0 and 200),
 minutes_url text not null default '' check (minutes_url='' or (char_length(minutes_url) <= 500 and minutes_url ~ '^https://[^[:space:]]+$')),
 revision integer not null default 1 check (revision >= 1),
 created_at timestamptz not null default now(),
 created_by uuid references rush.profiles(id) on delete set null,
 updated_at timestamptz not null default now(),
 updated_by uuid references rush.profiles(id) on delete set null,
 -- A vote is recorded whole or not at all (decided by consensus or noted).
 check ((votes_for is null and votes_against is null and votes_abstain is null)
  or (votes_for is not null and votes_against is not null and votes_abstain is not null))
);
create index board_decisions_decided_on on rush.board_decisions(decided_on desc, created_at desc);
alter table rush.board_decisions enable row level security;
alter table rush.board_decisions force row level security;
-- No policies and no table grants: access is exclusively through the RPCs.
revoke all on rush.board_decisions from public, anon, authenticated;

create function rush.decision_log_is_board() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from rush.memberships m join rush.profiles p on p.id=m.user_id
  where m.user_id=rush.actor_id() and m.active and p.active and m.role in ('BOARD','OWNER'));
$$;

create function rush.board_decision_json(d rush.board_decisions) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'id',d.id,'decidedOn',d.decided_on::text,'title',d.title,'category',d.category,'outcome',d.outcome,'summary',d.summary,
  'votes',case when d.votes_for is null then null else jsonb_build_object('for',d.votes_for,'against',d.votes_against,'abstain',d.votes_abstain) end,
  'minutesUrl',d.minutes_url,'revision',d.revision,'createdAt',d.created_at,'updatedAt',d.updated_at,
  'createdByName',(select p.display_name from rush.profiles p where p.id=d.created_by),
  'updatedByName',(select p.display_name from rush.profiles p where p.id=d.updated_by));
$$;

create function rush.board_decision_log() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not rush.decision_log_is_board() then raise exception 'Board access required' using errcode='42501'; end if;
 return jsonb_build_object('decisions',coalesce((
  select jsonb_agg(rush.board_decision_json(d) order by d.decided_on desc, d.created_at desc, d.id)
  from rush.board_decisions d),'[]'::jsonb));
end; $$;

-- Creates an entry when target_id is null (expected_revision must be 0), or
-- replaces an existing entry whose revision matches expected_revision.
create function rush.save_board_decision(target_id uuid, expected_revision integer, payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 actor uuid := rush.actor_id();
 old rush.board_decisions%rowtype;
 d rush.board_decisions%rowtype;
 decided date;
 votes jsonb;
 v_for integer; v_against integer; v_abstain integer;
 changed text[] := '{}';
begin
 if not rush.decision_log_is_board() then raise exception 'Board access required' using errcode='42501'; end if;
 if expected_revision is null or expected_revision<0 or (target_id is null and expected_revision<>0) or (target_id is not null and expected_revision<1) then
  raise exception 'Invalid revision' using errcode='22023'; end if;
 if jsonb_typeof(payload) is distinct from 'object'
  or exists(select 1 from jsonb_object_keys(payload) k where k not in ('decidedOn','title','category','outcome','summary','votes','minutesUrl'))
  or (select count(*) from jsonb_object_keys(payload))<>7 then
  raise exception 'Invalid decision form' using errcode='22023'; end if;
 if jsonb_typeof(payload->'decidedOn') is distinct from 'string' or payload->>'decidedOn' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
  raise exception 'Give the date of the decision' using errcode='22023'; end if;
 begin decided := (payload->>'decidedOn')::date;
 exception when others then raise exception 'Give the date of the decision' using errcode='22023'; end;
 if jsonb_typeof(payload->'title') is distinct from 'string' or char_length(payload->>'title') not between 1 and 200 or payload->>'title'<>btrim(payload->>'title')
  or coalesce(payload->>'category','') not in ('MEMBERSHIP','RECRUITMENT','FINANCE','CLIENTS','OPERATIONS','POLICY','OTHER')
  or coalesce(payload->>'outcome','') not in ('APPROVED','REJECTED','DEFERRED','NOTED','WITHDRAWN')
  or jsonb_typeof(payload->'summary') is distinct from 'string' or char_length(payload->>'summary')>2000 or payload->>'summary'<>btrim(payload->>'summary')
  or jsonb_typeof(payload->'minutesUrl') is distinct from 'string'
  or (payload->>'minutesUrl'<>'' and (char_length(payload->>'minutesUrl')>500 or payload->>'minutesUrl' !~ '^https://[^[:space:]]+$')) then
  raise exception 'Check the decision fields' using errcode='22023'; end if;
 votes := payload->'votes';
 if jsonb_typeof(votes)='object' then
  if exists(select 1 from jsonb_object_keys(votes) k where k not in ('for','against','abstain')) or (select count(*) from jsonb_object_keys(votes))<>3
   or exists(select 1 from jsonb_each(votes) e where jsonb_typeof(e.value) is distinct from 'number' or e.value::text !~ '^[0-9]{1,3}$' or e.value::text::integer>200) then
   raise exception 'Vote counts must be whole numbers from 0 to 200' using errcode='22023'; end if;
  v_for := (votes->>'for')::integer; v_against := (votes->>'against')::integer; v_abstain := (votes->>'abstain')::integer;
 elsif jsonb_typeof(votes) is distinct from 'null' then
  raise exception 'Vote counts must be whole numbers from 0 to 200' using errcode='22023';
 end if;

 if target_id is null then
  insert into rush.board_decisions(decided_on,title,category,outcome,summary,votes_for,votes_against,votes_abstain,minutes_url,created_by,updated_by)
  values(decided,payload->>'title',payload->>'category',payload->>'outcome',payload->>'summary',v_for,v_against,v_abstain,payload->>'minutesUrl',actor,actor)
  returning * into d;
  insert into rush.audit_events(actor_id,action,resource,resource_id,metadata)
  values(actor,'BOARD_DECISION_RECORDED','BoardDecision',d.id::text,jsonb_build_object('decidedOn',d.decided_on,'category',d.category,'outcome',d.outcome,
   'votes',case when d.votes_for is null then null else jsonb_build_object('for',d.votes_for,'against',d.votes_against,'abstain',d.votes_abstain) end,
   'hasMinutes',d.minutes_url<>'','revision',d.revision));
  return rush.board_decision_json(d);
 end if;

 select * into old from rush.board_decisions where id=target_id for update;
 if not found then raise exception 'Decision not found' using errcode='P0002'; end if;
 if old.revision<>expected_revision then raise exception 'This decision changed since you opened it. Reload before saving.' using errcode='55000'; end if;
 if old.decided_on<>decided then changed := array_append(changed,'decidedOn'); end if;
 if old.title<>payload->>'title' then changed := array_append(changed,'title'); end if;
 if old.category<>payload->>'category' then changed := array_append(changed,'category'); end if;
 if old.outcome<>payload->>'outcome' then changed := array_append(changed,'outcome'); end if;
 if old.summary<>payload->>'summary' then changed := array_append(changed,'summary'); end if;
 if old.votes_for is distinct from v_for or old.votes_against is distinct from v_against or old.votes_abstain is distinct from v_abstain then changed := array_append(changed,'votes'); end if;
 if old.minutes_url<>payload->>'minutesUrl' then changed := array_append(changed,'minutesUrl'); end if;
 -- Saving an unchanged form is not a new revision and leaves no audit entry.
 if cardinality(changed)=0 then return rush.board_decision_json(old); end if;
 update rush.board_decisions set decided_on=decided, title=payload->>'title', category=payload->>'category', outcome=payload->>'outcome',
  summary=payload->>'summary', votes_for=v_for, votes_against=v_against, votes_abstain=v_abstain, minutes_url=payload->>'minutesUrl',
  revision=revision+1, updated_at=now(), updated_by=actor
  where id=target_id returning * into d;
 insert into rush.audit_events(actor_id,action,resource,resource_id,metadata)
 values(actor,'BOARD_DECISION_UPDATED','BoardDecision',d.id::text,jsonb_build_object('decidedOn',d.decided_on,'category',d.category,'outcome',d.outcome,
  'votes',case when d.votes_for is null then null else jsonb_build_object('for',d.votes_for,'against',d.votes_against,'abstain',d.votes_abstain) end,
  'hasMinutes',d.minutes_url<>'','revision',d.revision,'changed',to_jsonb(changed)));
 return rush.board_decision_json(d);
end; $$;

revoke all on function rush.decision_log_is_board(), rush.board_decision_json(rush.board_decisions), rush.board_decision_log(),
 rush.save_board_decision(uuid,integer,jsonb) from public, anon, authenticated;
grant execute on function rush.board_decision_log(), rush.save_board_decision(uuid,integer,jsonb) to authenticated;
