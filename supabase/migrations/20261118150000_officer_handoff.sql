-- Officer handoff: one transition checklist per officer role change, with the
-- outgoing and incoming officer, a due date and completion tracking.
--
-- A handoff is an organisation record, like rush.projects and the board
-- decision log, so it is not tied to a recruitment cycle. Checklist items can
-- name accounts, shared drives and open client work, so nothing here is
-- readable through a table grant. Access is only through the actor-checked
-- functions below: an active BOARD or OWNER member (in any cycle, with an
-- active profile) reads and writes every handoff.
--
-- The read also lists, for both officers, their current elevated roles and
-- member-tool reviewer grants, so the board can see what still has to move.
-- That list is access metadata only: it never reads member_tool_records and
-- does not unlock any private record. Nothing here changes a role or grant;
-- the Owner still does that in Settings and in the member tools.
--
-- There is no delete. A handoff that will not happen is set to Cancelled.
-- Writes carry an optimistic revision on the handoff. Audit metadata records
-- status, the two officers' ids, the due date, item counts and which fields
-- changed, never the role title, notes, item labels or item details.
create table rush.officer_handoffs (
 id uuid primary key default gen_random_uuid(),
 role_title text not null check (char_length(role_title) between 1 and 80 and role_title=btrim(role_title)),
 outgoing_id uuid not null references rush.profiles(id),
 incoming_id uuid references rush.profiles(id),
 due_on date,
 status text not null default 'OPEN' check (status in ('OPEN','COMPLETE','CANCELLED')),
 notes text not null default '' check (char_length(notes) <= 2000 and notes=btrim(notes)),
 revision integer not null default 1 check (revision >= 1),
 completed_at timestamptz,
 created_at timestamptz not null default now(),
 created_by uuid references rush.profiles(id) on delete set null,
 updated_at timestamptz not null default now(),
 updated_by uuid references rush.profiles(id) on delete set null,
 check (incoming_id is null or incoming_id<>outgoing_id),
 check ((status='COMPLETE')=(completed_at is not null)),
 check (status<>'COMPLETE' or incoming_id is not null)
);
create index officer_handoffs_status on rush.officer_handoffs(status, due_on, created_at desc);

create table rush.officer_handoff_items (
 id uuid primary key default gen_random_uuid(),
 handoff_id uuid not null references rush.officer_handoffs(id) on delete cascade,
 position integer not null check (position between 1 and 40),
 kind text not null check (kind in ('ACCOUNT','ACCESS','OPEN_ITEM')),
 label text not null check (char_length(label) between 1 and 200 and label=btrim(label)),
 detail text not null default '' check (char_length(detail) <= 1000 and detail=btrim(detail)),
 done_at timestamptz,
 done_by uuid references rush.profiles(id) on delete set null,
 unique (handoff_id, position) deferrable initially deferred
);
create index officer_handoff_items_handoff on rush.officer_handoff_items(handoff_id, position);

alter table rush.officer_handoffs enable row level security;
alter table rush.officer_handoffs force row level security;
alter table rush.officer_handoff_items enable row level security;
alter table rush.officer_handoff_items force row level security;
-- No policies and no table grants: access is exclusively through the RPCs.
revoke all on rush.officer_handoffs, rush.officer_handoff_items from public, anon, authenticated;

create function rush.officer_handoff_is_board() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from rush.memberships m join rush.profiles p on p.id=m.user_id
  where m.user_id=rush.actor_id() and m.active and p.active and m.role in ('BOARD','OWNER'));
$$;

-- People who can be named as an officer: an active profile with at least one
-- active membership.
create function rush.officer_handoff_eligible(person uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from rush.memberships m join rush.profiles p on p.id=m.user_id
  where m.user_id=person and m.active and p.active);
$$;

-- Current elevated roles and reviewer grants for one person. MEMBER is left
-- out because every member holds it and it never needs handing over.
create function rush.officer_handoff_access(person uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'roles',coalesce((select jsonb_agg(jsonb_build_object('cycleId',c.id,'cycleName',c.name,'role',m.role::text) order by c.name, c.id, m.role::text)
   from rush.memberships m join rush.rush_cycles c on c.id=m.cycle_id
   where m.user_id=person and m.active and m.role<>'MEMBER'),'[]'::jsonb),
  'reviewerGrants',coalesce((select jsonb_agg(jsonb_build_object('cycleId',c.id,'cycleName',c.name,'tool',r.kind) order by c.name, c.id, r.kind)
   from rush.member_tool_reviewers r join rush.rush_cycles c on c.id=r.cycle_id
   where r.user_id=person),'[]'::jsonb));
$$;

create function rush.officer_handoff_json(h rush.officer_handoffs) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'id',h.id,'roleTitle',h.role_title,
  'outgoingId',h.outgoing_id,'outgoingName',(select p.display_name from rush.profiles p where p.id=h.outgoing_id),
  'incomingId',h.incoming_id,'incomingName',(select p.display_name from rush.profiles p where p.id=h.incoming_id),
  'dueOn',h.due_on::text,'status',h.status,'notes',h.notes,
  'items',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'kind',i.kind,'label',i.label,'detail',i.detail,'done',i.done_at is not null,
    'doneAt',i.done_at,'doneByName',(select p.display_name from rush.profiles p where p.id=i.done_by)) order by i.position)
   from rush.officer_handoff_items i where i.handoff_id=h.id),'[]'::jsonb),
  'access',jsonb_build_object('outgoing',rush.officer_handoff_access(h.outgoing_id),
   'incoming',case when h.incoming_id is null then null else rush.officer_handoff_access(h.incoming_id) end),
  'revision',h.revision,'completedAt',h.completed_at,'createdAt',h.created_at,'updatedAt',h.updated_at,
  'createdByName',(select p.display_name from rush.profiles p where p.id=h.created_by),
  'updatedByName',(select p.display_name from rush.profiles p where p.id=h.updated_by));
$$;

create function rush.officer_handoffs() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not rush.officer_handoff_is_board() then raise exception 'Board access required' using errcode='42501'; end if;
 return jsonb_build_object(
  -- Open handoffs first, soonest due first; then finished ones, newest first.
  'handoffs',coalesce((select jsonb_agg(rush.officer_handoff_json(h)
    order by (h.status='OPEN') desc, case when h.status='OPEN' then h.due_on end asc nulls last, h.created_at desc, h.id)
   from rush.officer_handoffs h),'[]'::jsonb),
  'people',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.display_name) order by p.display_name, p.id)
   from rush.profiles p where rush.officer_handoff_eligible(p.id)),'[]'::jsonb));
end; $$;

-- Creates a handoff when target_id is null (expected_revision must be 0), or
-- replaces an existing one whose revision matches expected_revision. The items
-- array is the whole checklist in order: an item with an id keeps its id and
-- done time, an item with a null id is new, and a stored item missing from the
-- array is removed.
create function rush.save_officer_handoff(target_id uuid, expected_revision integer, payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 actor uuid := rush.actor_id();
 old rush.officer_handoffs%rowtype;
 h rush.officer_handoffs%rowtype;
 uuid_pattern constant text := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
 outgoing uuid; incoming uuid; due date;
 items jsonb; item jsonb; pos integer; item_id uuid;
 old_items jsonb; new_items jsonb;
 kept uuid[] := '{}';
 total integer; done_count integer;
 changed text[] := '{}';
begin
 if not rush.officer_handoff_is_board() then raise exception 'Board access required' using errcode='42501'; end if;
 if expected_revision is null or expected_revision<0 or (target_id is null and expected_revision<>0) or (target_id is not null and expected_revision<1) then
  raise exception 'Invalid revision' using errcode='22023'; end if;
 if jsonb_typeof(payload) is distinct from 'object'
  or exists(select 1 from jsonb_object_keys(payload) k where k not in ('roleTitle','outgoingId','incomingId','dueOn','status','notes','items'))
  or (select count(*) from jsonb_object_keys(payload))<>7 then
  raise exception 'Invalid handoff form' using errcode='22023'; end if;
 if jsonb_typeof(payload->'roleTitle') is distinct from 'string' or char_length(payload->>'roleTitle') not between 1 and 80 or payload->>'roleTitle'<>btrim(payload->>'roleTitle') then
  raise exception 'Name the role being handed over (up to 80 characters)' using errcode='22023'; end if;
 if coalesce(payload->>'status','') not in ('OPEN','COMPLETE','CANCELLED')
  or jsonb_typeof(payload->'notes') is distinct from 'string' or char_length(payload->>'notes')>2000 or payload->>'notes'<>btrim(payload->>'notes') then
  raise exception 'Check the handoff fields' using errcode='22023'; end if;
 if jsonb_typeof(payload->'outgoingId') is distinct from 'string' or payload->>'outgoingId' !~ uuid_pattern then
  raise exception 'Choose the outgoing officer' using errcode='22023'; end if;
 outgoing := (payload->>'outgoingId')::uuid;
 if jsonb_typeof(payload->'incomingId')='string' and payload->>'incomingId' ~ uuid_pattern then incoming := (payload->>'incomingId')::uuid;
 elsif jsonb_typeof(payload->'incomingId') is distinct from 'null' then raise exception 'Choose the incoming officer' using errcode='22023'; end if;
 if incoming=outgoing then raise exception 'The incoming officer must be someone other than the outgoing officer' using errcode='22023'; end if;
 if jsonb_typeof(payload->'dueOn')='string' then
  if payload->>'dueOn' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'Check the due date' using errcode='22023'; end if;
  begin due := (payload->>'dueOn')::date;
  exception when others then raise exception 'Check the due date' using errcode='22023'; end;
 elsif jsonb_typeof(payload->'dueOn') is distinct from 'null' then raise exception 'Check the due date' using errcode='22023'; end if;

 items := payload->'items';
 if jsonb_typeof(items) is distinct from 'array' or jsonb_array_length(items)>40 then
  raise exception 'A handoff holds up to 40 checklist items' using errcode='22023'; end if;
 for item in select value from jsonb_array_elements(items) loop
  if jsonb_typeof(item) is distinct from 'object'
   or exists(select 1 from jsonb_object_keys(item) k where k not in ('id','kind','label','detail','done')) or (select count(*) from jsonb_object_keys(item))<>5
   or not (jsonb_typeof(item->'id')='null' or (jsonb_typeof(item->'id')='string' and item->>'id' ~ uuid_pattern))
   or coalesce(item->>'kind','') not in ('ACCOUNT','ACCESS','OPEN_ITEM')
   or jsonb_typeof(item->'label') is distinct from 'string' or char_length(item->>'label') not between 1 and 200 or item->>'label'<>btrim(item->>'label')
   or jsonb_typeof(item->'detail') is distinct from 'string' or char_length(item->>'detail')>1000 or item->>'detail'<>btrim(item->>'detail')
   or jsonb_typeof(item->'done') is distinct from 'boolean' then
   raise exception 'Check the checklist items' using errcode='22023'; end if;
 end loop;
 if (select count(*) from jsonb_array_elements(items) e where e->>'id' is not null)
  <>(select count(distinct e->>'id') from jsonb_array_elements(items) e where e->>'id' is not null) then
  raise exception 'Check the checklist items' using errcode='22023'; end if;
 total := jsonb_array_length(items);
 done_count := (select count(*) from jsonb_array_elements(items) e where (e->>'done')::boolean);
 if payload->>'status'='COMPLETE' and (incoming is null or done_count<total) then
  raise exception 'A handoff is complete only when it names the incoming officer and every item is ticked' using errcode='22023'; end if;

 if target_id is not null then
  select * into old from rush.officer_handoffs where id=target_id for update;
  if not found then raise exception 'Handoff not found' using errcode='P0002'; end if;
  if old.revision<>expected_revision then raise exception 'This handoff changed since you opened it. Reload before saving.' using errcode='55000'; end if;
  if exists(select 1 from jsonb_array_elements(items) e where e->>'id' is not null
   and not exists(select 1 from rush.officer_handoff_items i where i.handoff_id=target_id and i.id=(e->>'id')::uuid)) then
   raise exception 'A checklist item changed since you opened it. Reload before saving.' using errcode='55000'; end if;
 elsif exists(select 1 from jsonb_array_elements(items) e where e->>'id' is not null) then
  raise exception 'Check the checklist items' using errcode='22023';
 end if;
 -- The outgoing and incoming officer must be people who can be chosen now,
 -- unless the handoff already names them (an officer may have left since).
 if not rush.officer_handoff_eligible(outgoing) and outgoing is distinct from old.outgoing_id then
  raise exception 'Choose the outgoing officer from current members' using errcode='22023'; end if;
 if incoming is not null and not rush.officer_handoff_eligible(incoming) and incoming is distinct from old.incoming_id then
  raise exception 'Choose the incoming officer from current members' using errcode='22023'; end if;

 if target_id is null then
  insert into rush.officer_handoffs(role_title,outgoing_id,incoming_id,due_on,status,notes,completed_at,created_by,updated_by)
  values(payload->>'roleTitle',outgoing,incoming,due,payload->>'status',payload->>'notes',
   case when payload->>'status'='COMPLETE' then now() end,actor,actor)
  returning * into h;
  insert into rush.officer_handoff_items(handoff_id,position,kind,label,detail,done_at,done_by)
  select h.id,e.ordinality,e.value->>'kind',e.value->>'label',e.value->>'detail',
   case when (e.value->>'done')::boolean then now() end,case when (e.value->>'done')::boolean then actor end
  from jsonb_array_elements(items) with ordinality e;
  insert into rush.audit_events(actor_id,action,resource,resource_id,metadata)
  values(actor,'OFFICER_HANDOFF_CREATED','OfficerHandoff',h.id::text,jsonb_build_object('status',h.status,'outgoingId',h.outgoing_id,'incomingId',h.incoming_id,
   'dueOn',h.due_on,'items',total,'done',done_count,'revision',h.revision));
  return rush.officer_handoff_json(h);
 end if;

 old_items := coalesce((select jsonb_agg(jsonb_build_object('id',i.id::text,'kind',i.kind,'label',i.label,'detail',i.detail,'done',i.done_at is not null) order by i.position)
  from rush.officer_handoff_items i where i.handoff_id=target_id),'[]'::jsonb);
 new_items := coalesce((select jsonb_agg(jsonb_build_object('id',e->>'id','kind',e->>'kind','label',e->>'label','detail',e->>'detail','done',(e->>'done')::boolean) order by o)
  from jsonb_array_elements(items) with ordinality t(e,o)),'[]'::jsonb);
 if old.role_title<>payload->>'roleTitle' then changed := array_append(changed,'roleTitle'); end if;
 if old.outgoing_id<>outgoing then changed := array_append(changed,'outgoing'); end if;
 if old.incoming_id is distinct from incoming then changed := array_append(changed,'incoming'); end if;
 if old.due_on is distinct from due then changed := array_append(changed,'dueOn'); end if;
 if old.status<>payload->>'status' then changed := array_append(changed,'status'); end if;
 if old.notes<>payload->>'notes' then changed := array_append(changed,'notes'); end if;
 if old_items<>new_items then changed := array_append(changed,'items'); end if;
 -- Saving an unchanged form is not a new revision and leaves no audit entry.
 if cardinality(changed)=0 then return rush.officer_handoff_json(old); end if;

 update rush.officer_handoffs set role_title=payload->>'roleTitle', outgoing_id=outgoing, incoming_id=incoming, due_on=due,
  status=payload->>'status', notes=payload->>'notes',
  completed_at=case when payload->>'status'<>'COMPLETE' then null when old.status='COMPLETE' then old.completed_at else now() end,
  revision=revision+1, updated_at=now(), updated_by=actor
  where id=target_id returning * into h;
 -- Positions are deferred-unique, so items can be renumbered in place.
 pos := 0;
 for item in select value from jsonb_array_elements(items) loop
  pos := pos+1;
  if item->>'id' is null then
   insert into rush.officer_handoff_items(handoff_id,position,kind,label,detail,done_at,done_by)
   values(target_id,pos,item->>'kind',item->>'label',item->>'detail',
    case when (item->>'done')::boolean then now() end,case when (item->>'done')::boolean then actor end)
   returning id into item_id;
  else
   item_id := (item->>'id')::uuid;
   -- A tick keeps its original time and person; unticking clears both.
   update rush.officer_handoff_items i set position=pos, kind=item->>'kind', label=item->>'label', detail=item->>'detail',
    done_at=case when not (item->>'done')::boolean then null else coalesce(i.done_at,now()) end,
    done_by=case when not (item->>'done')::boolean then null when i.done_at is null then actor else i.done_by end
    where i.id=item_id and i.handoff_id=target_id;
  end if;
  kept := array_append(kept,item_id);
 end loop;
 delete from rush.officer_handoff_items i where i.handoff_id=target_id and not (i.id=any(kept));
 insert into rush.audit_events(actor_id,action,resource,resource_id,metadata)
 values(actor,'OFFICER_HANDOFF_UPDATED','OfficerHandoff',h.id::text,jsonb_build_object('status',h.status,'outgoingId',h.outgoing_id,'incomingId',h.incoming_id,
  'dueOn',h.due_on,'items',total,'done',done_count,'revision',h.revision,'changed',to_jsonb(changed)));
 return rush.officer_handoff_json(h);
end; $$;

revoke all on function rush.officer_handoff_is_board(), rush.officer_handoff_eligible(uuid), rush.officer_handoff_access(uuid),
 rush.officer_handoff_json(rush.officer_handoffs), rush.officer_handoffs(), rush.save_officer_handoff(uuid,integer,jsonb)
 from public, anon, authenticated;
grant execute on function rush.officer_handoffs(), rush.save_officer_handoff(uuid,integer,jsonb) to authenticated;
