-- Staffing planner: each member tells the board, once per cycle, how many hours
-- a week they can give client work, what skills they bring and which projects
-- they would most like. The board sees that next to each member's current
-- project load (rush.project_members) before it staffs a project.
--
-- Access is only through the actor-checked functions below:
-- * an active member of the cycle (any role except PANEL alone) reads and
--   writes only their own availability for that cycle;
-- * an active BOARD or OWNER member of the cycle reads everyone's for that
--   cycle. The board cannot write a member's availability.
-- Members are told on the form that the board reads what they enter. This is
-- not a member-tool record and reads none.
-- Writes carry an optimistic revision and are audited with the revision only;
-- skills, preferences and notes are not copied into audit metadata.
create table rush.staffing_availability (
 cycle_id text not null references rush.rush_cycles(id) on delete cascade,
 user_id uuid not null references rush.profiles(id) on delete cascade,
 weekly_hours integer not null check (weekly_hours between 0 and 40),
 skills text[] not null default '{}' check (cardinality(skills) <= 12),
 -- Ranked, most wanted first.
 preferred_project_ids text[] not null default '{}' check (cardinality(preferred_project_ids) <= 3),
 notes text not null default '' check (char_length(notes) <= 500),
 revision integer not null default 1 check (revision >= 1),
 updated_at timestamptz not null default now(),
 primary key (cycle_id, user_id)
);
alter table rush.staffing_availability enable row level security;
alter table rush.staffing_availability force row level security;
-- No policies and no table grants: access is exclusively through the RPCs.
revoke all on rush.staffing_availability from public, anon, authenticated;

create function rush.staffing_is_member(target_cycle_id text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from rush.memberships m join rush.profiles p on p.id=m.user_id
  where m.user_id=rush.actor_id() and m.cycle_id=target_cycle_id and m.active and p.active and m.role<>'PANEL');
$$;

create function rush.staffing_is_board(target_cycle_id text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from rush.memberships m join rush.profiles p on p.id=m.user_id
  where m.user_id=rush.actor_id() and m.cycle_id=target_cycle_id and m.active and p.active and m.role in ('BOARD','OWNER'));
$$;

create function rush.staffing_availability_json(target_cycle_id text, target_user uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'submitted',a.user_id is not null,
  'weeklyHours',a.weekly_hours,
  'skills',to_jsonb(coalesce(a.skills,'{}'::text[])),
  'preferredProjectIds',to_jsonb(coalesce(a.preferred_project_ids,'{}'::text[])),
  'notes',coalesce(a.notes,''),
  'revision',coalesce(a.revision,0),
  'updatedAt',a.updated_at)
 from (select 1) one left join rush.staffing_availability a on a.cycle_id=target_cycle_id and a.user_id=target_user;
$$;

create function rush.my_staffing_availability(target_cycle_id text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if target_cycle_id is null or not rush.staffing_is_member(target_cycle_id) then
  raise exception 'Active membership required' using errcode='42501'; end if;
 return jsonb_build_object('cycleId',target_cycle_id) || rush.staffing_availability_json(target_cycle_id, rush.actor_id());
end; $$;

create function rush.save_my_staffing_availability(target_cycle_id text, expected_revision integer, weekly_hours integer,
 skills jsonb, preferred_project_ids jsonb, notes text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid := rush.actor_id(); clean_skills text[]; clean_projects text[]; clean_notes text; saved_revision integer;
begin
 if target_cycle_id is null or not rush.staffing_is_member(target_cycle_id) then
  raise exception 'Active membership required' using errcode='42501'; end if;
 if expected_revision is null or expected_revision<0 then raise exception 'Invalid revision' using errcode='22023'; end if;
 if weekly_hours is null or weekly_hours not between 0 and 40 then
  raise exception 'Weekly hours must be a whole number from 0 to 40.' using errcode='22023'; end if;
 if skills is null or jsonb_typeof(skills)<>'array' or jsonb_array_length(skills)>12
  or exists(select 1 from jsonb_array_elements(skills) s where jsonb_typeof(s)<>'string' or char_length(btrim(s#>>'{}')) not between 1 and 40) then
  raise exception 'List up to 12 skills, each 1 to 40 characters.' using errcode='22023'; end if;
 -- Trim and drop case-insensitive duplicates, keeping the first spelling and order.
 select coalesce(array_agg(v order by first_at),'{}') into clean_skills from (
  select (array_agg(btrim(s.value#>>'{}') order by s.ordinality))[1] as v, min(s.ordinality) as first_at
  from jsonb_array_elements(skills) with ordinality s group by lower(btrim(s.value#>>'{}'))) d;
 if preferred_project_ids is null or jsonb_typeof(preferred_project_ids)<>'array' or jsonb_array_length(preferred_project_ids)>3
  or exists(select 1 from jsonb_array_elements(preferred_project_ids) p where jsonb_typeof(p)<>'string')
  or (select count(distinct p) from jsonb_array_elements_text(preferred_project_ids) p)<>jsonb_array_length(preferred_project_ids) then
  raise exception 'Choose up to 3 different projects.' using errcode='22023'; end if;
 select coalesce(array_agg(p.value order by p.ordinality),'{}') into clean_projects from jsonb_array_elements_text(preferred_project_ids) with ordinality p;
 if exists(select 1 from unnest(clean_projects) u(pid) where not exists(select 1 from rush.projects pr where pr.id=u.pid)) then
  raise exception 'A chosen project no longer exists. Reload and choose again.' using errcode='22023'; end if;
 clean_notes := btrim(coalesce(notes,''));
 if char_length(clean_notes)>500 then raise exception 'Notes must be 500 characters or fewer.' using errcode='22023'; end if;

 if expected_revision=0 then
  insert into rush.staffing_availability(cycle_id,user_id,weekly_hours,skills,preferred_project_ids,notes)
  values(target_cycle_id,actor,weekly_hours,clean_skills,clean_projects,clean_notes)
  on conflict do nothing returning revision into saved_revision;
 else
  update rush.staffing_availability a set weekly_hours=save_my_staffing_availability.weekly_hours, skills=clean_skills,
   preferred_project_ids=clean_projects, notes=clean_notes, revision=a.revision+1, updated_at=now()
  where a.cycle_id=target_cycle_id and a.user_id=actor and a.revision=expected_revision
  returning a.revision into saved_revision;
 end if;
 if saved_revision is null then
  raise exception 'Your availability changed in another tab. Reload before saving.' using errcode='55000'; end if;
 insert into rush.audit_events(actor_id,cycle_id,action,resource,resource_id,metadata)
 values(actor,target_cycle_id,'STAFFING_AVAILABILITY_SAVED','StaffingAvailability',actor::text,jsonb_build_object('revision',saved_revision));
 return jsonb_build_object('cycleId',target_cycle_id) || rush.staffing_availability_json(target_cycle_id, actor);
end; $$;

-- The board's planning view for one cycle: every member of the cycle (same
-- set as above), their availability (or not submitted) and the projects they
-- are staffed on now. Projects are org-wide in this schema, so current load
-- counts every staffed project, and the project list is every project.
create function rush.staffing_plan(target_cycle_id text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if target_cycle_id is null or not rush.staffing_is_board(target_cycle_id) then
  raise exception 'Board access required' using errcode='42501'; end if;
 return jsonb_build_object(
  'cycleId',target_cycle_id,
  'projects',coalesce((select jsonb_agg(jsonb_build_object('id',pr.id,'title',pr.title,'semester',pr.semester,
    'staffCount',(select count(*) from rush.project_members pm where pm.project_id=pr.id)) order by pr.sort_order, pr.title, pr.id)
   from rush.projects pr),'[]'::jsonb),
  'members',coalesce((
   with people as (
    select p.id, p.display_name, array_agg(distinct m.role::text order by m.role::text) as roles
    from rush.memberships m join rush.profiles p on p.id=m.user_id
    where m.cycle_id=target_cycle_id and m.active and p.active
    group by p.id, p.display_name
    having bool_or(m.role<>'PANEL'))
   select jsonb_agg(jsonb_build_object('userId',pe.id,'name',pe.display_name,'roles',to_jsonb(pe.roles),
     'staffedProjectIds',coalesce((select jsonb_agg(pm.project_id order by pm.project_id) from rush.project_members pm where pm.user_id=pe.id),'[]'::jsonb))
     || rush.staffing_availability_json(target_cycle_id, pe.id) order by pe.display_name, pe.id)
   from people pe),'[]'::jsonb));
end; $$;

revoke all on function rush.staffing_is_member(text), rush.staffing_is_board(text), rush.staffing_availability_json(text,uuid),
 rush.my_staffing_availability(text), rush.save_my_staffing_availability(text,integer,integer,jsonb,jsonb,text), rush.staffing_plan(text)
 from public, anon, authenticated;
grant execute on function rush.my_staffing_availability(text), rush.save_my_staffing_availability(text,integer,integer,jsonb,jsonb,text),
 rush.staffing_plan(text) to authenticated;
