-- Engagement tracker: the delivery state of each client project.
--
-- rush.projects describes an engagement for the portfolio. This table records
-- how delivery is going: status, milestones, the lead's weekly health flag,
-- risks/blockers and the last client contact. Delivery notes can name client
-- staff and internal problems, so nothing here is readable through a table
-- grant. Access is only through the actor-checked functions below:
--   * an active BOARD or OWNER member reads every project and edits delivery;
--   * a project lead (assigned by the board, and still staffed on the project)
--     reads and edits only their own project, and is the only person who sets
--     the weekly health flag.
-- Writes carry an optimistic revision and are audited with counts and states
-- only, never the free-text notes.
create table rush.project_delivery (
 project_id text primary key references rush.projects(id) on delete cascade,
 status text not null default 'SCOPING' check (status in ('SCOPING','ACTIVE','FINAL','CLOSED')),
 lead_id uuid references rush.profiles(id) on delete set null,
 health text check (health in ('ON_TRACK','AT_RISK','OFF_TRACK')),
 health_note text not null default '' check (char_length(health_note) <= 1000),
 health_set_at timestamptz,
 health_set_by uuid references rush.profiles(id) on delete set null,
 last_contact_on date,
 last_contact_note text not null default '' check (char_length(last_contact_note) <= 1000),
 milestones jsonb not null default '[]'::jsonb,
 risks jsonb not null default '[]'::jsonb,
 revision integer not null default 0 check (revision >= 0),
 updated_at timestamptz not null default now(),
 updated_by uuid references rush.profiles(id) on delete set null
);
create index project_delivery_lead on rush.project_delivery(lead_id) where lead_id is not null;
alter table rush.project_delivery enable row level security;
alter table rush.project_delivery force row level security;
-- No policies and no table grants: access is exclusively through the RPCs.
revoke all on rush.project_delivery from public, anon, authenticated;

create function rush.engagement_is_board() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from rush.memberships m join rush.profiles p on p.id=m.user_id
  where m.user_id=rush.actor_id() and m.active and p.active and m.role in ('BOARD','OWNER'));
$$;

-- A lead keeps access only while still staffed, active and a current member.
create function rush.engagement_is_lead(target_project_id text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from rush.project_delivery d
  join rush.project_members pm on pm.project_id=d.project_id and pm.user_id=d.lead_id
  join rush.profiles p on p.id=d.lead_id
  where d.project_id=target_project_id and d.lead_id=rush.actor_id() and p.active
   and exists(select 1 from rush.memberships m where m.user_id=d.lead_id and m.active));
$$;

-- Navigation hint only: whether to show "Projects I lead". Reveals nothing
-- beyond the caller's own lead assignment.
create function rush.engagement_leads_any() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from rush.project_delivery d where d.lead_id=rush.actor_id() and rush.engagement_is_lead(d.project_id));
$$;

create function rush.validate_engagement_date(v text) returns date
language plpgsql immutable set search_path='' as $$
begin
 if v is null or v='' then return null; end if;
 if v !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'Invalid date' using errcode='22023'; end if;
 begin return v::date; exception when others then raise exception 'Invalid date' using errcode='22023'; end;
end; $$;

-- Milestones: [{id,title,due,done}]; risks: [{id,kind,text,status}]. Stored as
-- validated arrays so one revision covers the whole delivery record.
create function rush.validate_engagement_lists(milestones jsonb, risks jsonb) returns void
language plpgsql immutable set search_path='' as $$
declare item jsonb;
begin
 if jsonb_typeof(milestones) is distinct from 'array' or jsonb_array_length(milestones)>30
  or jsonb_typeof(risks) is distinct from 'array' or jsonb_array_length(risks)>30 then
  raise exception 'Invalid milestones or risks' using errcode='22023'; end if;
 for item in select value from jsonb_array_elements(milestones) loop
  if jsonb_typeof(item) is distinct from 'object'
   or exists(select 1 from jsonb_object_keys(item) k where k not in ('id','title','due','done'))
   or jsonb_typeof(item->'id') is distinct from 'string' or item->>'id' !~ '^[A-Za-z0-9-]{1,64}$'
   or jsonb_typeof(item->'title') is distinct from 'string' or char_length(trim(item->>'title')) not between 1 and 200 or item->>'title'<>trim(item->>'title')
   or jsonb_typeof(item->'due') is distinct from 'string' or item->>'due'=''
   or jsonb_typeof(item->'done') is distinct from 'string' then
   raise exception 'Check each milestone has a title and due date' using errcode='22023'; end if;
  perform rush.validate_engagement_date(item->>'due');
  perform rush.validate_engagement_date(item->>'done');
 end loop;
 for item in select value from jsonb_array_elements(risks) loop
  if jsonb_typeof(item) is distinct from 'object'
   or exists(select 1 from jsonb_object_keys(item) k where k not in ('id','kind','text','status'))
   or jsonb_typeof(item->'id') is distinct from 'string' or item->>'id' !~ '^[A-Za-z0-9-]{1,64}$'
   or coalesce(item->>'kind','') not in ('RISK','BLOCKER')
   or coalesce(item->>'status','') not in ('OPEN','RESOLVED')
   or jsonb_typeof(item->'text') is distinct from 'string' or char_length(trim(item->>'text')) not between 1 and 1000 or item->>'text'<>trim(item->>'text') then
   raise exception 'Check each risk or blocker' using errcode='22023'; end if;
 end loop;
end; $$;

create function rush.engagement_delivery_json(target_project_id text) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'projectId',pr.id,'title',pr.title,'clientLabel',pr.client_label,'semester',pr.semester,
  'status',coalesce(d.status,'SCOPING'),'leadId',d.lead_id,
  'leadName',(select p.display_name from rush.profiles p where p.id=d.lead_id),
  'leadStaffed',d.lead_id is not null and exists(select 1 from rush.project_members pm where pm.project_id=pr.id and pm.user_id=d.lead_id),
  'health',d.health,'healthNote',coalesce(d.health_note,''),'healthSetAt',d.health_set_at,
  'healthSetByName',(select p.display_name from rush.profiles p where p.id=d.health_set_by),
  'lastContactOn',coalesce(d.last_contact_on::text,''),'lastContactNote',coalesce(d.last_contact_note,''),
  'milestones',coalesce(d.milestones,'[]'::jsonb),'risks',coalesce(d.risks,'[]'::jsonb),
  'revision',coalesce(d.revision,0),'updatedAt',d.updated_at,
  'isLead',rush.engagement_is_lead(pr.id),
  'staff',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.display_name) order by p.display_name)
    from rush.project_members pm join rush.profiles p on p.id=pm.user_id where pm.project_id=pr.id and p.active),'[]'::jsonb))
 from rush.projects pr left join rush.project_delivery d on d.project_id=pr.id where pr.id=target_project_id;
$$;

create function rush.engagement_tracker() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare board boolean := rush.engagement_is_board();
begin
 if not exists(select 1 from rush.memberships m join rush.profiles p on p.id=m.user_id where m.user_id=rush.actor_id() and m.active and p.active) then
  raise exception 'Membership required' using errcode='42501'; end if;
 return jsonb_build_object('canManage',board,'projects',coalesce((
  select jsonb_agg(rush.engagement_delivery_json(pr.id) order by pr.sort_order, pr.title)
  from rush.projects pr where board or rush.engagement_is_lead(pr.id)),'[]'::jsonb));
end; $$;

-- Locks the delivery row for this transaction and returns its revision after
-- checking it against the caller's. A project with no delivery row reads as
-- revision 0; the placeholder row inserted here is also revision 0, so the
-- first save matches that read.
create function rush.engagement_lock(target_project_id text, expected_revision integer) returns integer
language plpgsql security definer set search_path='' as $$
declare current_revision integer;
begin
 if expected_revision is null or expected_revision<0 then raise exception 'Invalid revision' using errcode='22023'; end if;
 if not exists(select 1 from rush.projects where id=target_project_id) then raise exception 'Project unavailable' using errcode='42501'; end if;
 insert into rush.project_delivery(project_id) values(target_project_id) on conflict do nothing;
 select revision into current_revision from rush.project_delivery where project_id=target_project_id for update;
 if current_revision<>expected_revision then
  raise exception 'Delivery record changed. Reload before saving.' using errcode='55000'; end if;
 return current_revision;
end; $$;

create function rush.save_project_delivery(target_project_id text, expected_revision integer, payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare d rush.project_delivery%rowtype; actor uuid := rush.actor_id(); contact date;
begin
 if not (rush.engagement_is_board() or rush.engagement_is_lead(target_project_id)) then
  raise exception 'Board or project lead access required' using errcode='42501'; end if;
 if jsonb_typeof(payload) is distinct from 'object'
  or exists(select 1 from jsonb_object_keys(payload) k where k not in ('status','milestones','risks','lastContactOn','lastContactNote')) then
  raise exception 'Invalid delivery form' using errcode='22023'; end if;
 if payload->>'status' is null or payload->>'status' not in ('SCOPING','ACTIVE','FINAL','CLOSED')
  or jsonb_typeof(payload->'lastContactOn') is distinct from 'string'
  or jsonb_typeof(payload->'lastContactNote') is distinct from 'string' or char_length(payload->>'lastContactNote')>1000 then
  raise exception 'Check the delivery fields' using errcode='22023'; end if;
 perform rush.validate_engagement_lists(payload->'milestones', payload->'risks');
 contact := rush.validate_engagement_date(payload->>'lastContactOn');
 perform rush.engagement_lock(target_project_id, expected_revision);
 update rush.project_delivery set status=payload->>'status', milestones=payload->'milestones', risks=payload->'risks',
  last_contact_on=contact, last_contact_note=trim(payload->>'lastContactNote'),
  revision=revision+1,
  updated_at=now(), updated_by=actor
  where project_id=target_project_id returning * into d;
 insert into rush.audit_events(actor_id,action,resource,resource_id,metadata)
 values(actor,'PROJECT_DELIVERY_SAVED','Project',target_project_id,jsonb_build_object('status',d.status,'revision',d.revision,
  'milestones',jsonb_array_length(d.milestones),'openBlockers',(select count(*) from jsonb_array_elements(d.risks) r where r->>'kind'='BLOCKER' and r->>'status'='OPEN')));
 return rush.engagement_delivery_json(target_project_id);
end; $$;

create function rush.set_project_health(target_project_id text, expected_revision integer, flag text, note text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare d rush.project_delivery%rowtype; actor uuid := rush.actor_id();
begin
 if not rush.engagement_is_lead(target_project_id) then
  raise exception 'Only the project lead sets the weekly health flag' using errcode='42501'; end if;
 if flag is null or flag not in ('ON_TRACK','AT_RISK','OFF_TRACK') or note is null or char_length(note)>1000
  or (flag<>'ON_TRACK' and trim(note)='') then
  raise exception 'Choose a health flag and explain any risk' using errcode='22023'; end if;
 perform rush.engagement_lock(target_project_id, expected_revision);
 update rush.project_delivery set health=flag, health_note=trim(note), health_set_at=now(), health_set_by=actor,
  revision=revision+1, updated_at=now(), updated_by=actor where project_id=target_project_id returning * into d;
 insert into rush.audit_events(actor_id,action,resource,resource_id,metadata)
 values(actor,'PROJECT_HEALTH_SET','Project',target_project_id,jsonb_build_object('health',flag,'revision',d.revision));
 return rush.engagement_delivery_json(target_project_id);
end; $$;

create function rush.set_project_lead(target_project_id text, expected_revision integer, target_user uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare d rush.project_delivery%rowtype; actor uuid := rush.actor_id();
begin
 if not rush.engagement_is_board() then raise exception 'Board access required' using errcode='42501'; end if;
 if target_user is not null and not exists(select 1 from rush.project_members pm join rush.profiles p on p.id=pm.user_id
  where pm.project_id=target_project_id and pm.user_id=target_user and p.active) then
  raise exception 'Staff this member on the project before making them lead' using errcode='22023'; end if;
 perform rush.engagement_lock(target_project_id, expected_revision);
 update rush.project_delivery set lead_id=target_user, revision=revision+1, updated_at=now(), updated_by=actor
  where project_id=target_project_id returning * into d;
 insert into rush.audit_events(actor_id,action,resource,resource_id,metadata)
 values(actor,'PROJECT_LEAD_SET','Project',target_project_id,jsonb_build_object('leadId',target_user,'revision',d.revision));
 return rush.engagement_delivery_json(target_project_id);
end; $$;

revoke all on function rush.engagement_is_board(), rush.engagement_is_lead(text), rush.engagement_leads_any(), rush.validate_engagement_date(text),
 rush.validate_engagement_lists(jsonb,jsonb), rush.engagement_delivery_json(text), rush.engagement_tracker(),
 rush.engagement_lock(text,integer), rush.save_project_delivery(text,integer,jsonb),
 rush.set_project_health(text,integer,text,text), rush.set_project_lead(text,integer,uuid) from public, anon, authenticated;
grant execute on function rush.engagement_tracker(), rush.engagement_leads_any(), rush.save_project_delivery(text,integer,jsonb),
 rush.set_project_health(text,integer,text,text), rush.set_project_lead(text,integer,uuid) to authenticated;
