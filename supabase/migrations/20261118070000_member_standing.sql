-- Member standing: a read-only board rollup, per cycle, of each active
-- member's event attendance (rush.member_checkins), project participation
-- (rush.project_members) and onboarding completion
-- (rush.member_onboarding_items), plus the thresholds the board uses to call a
-- member active or at risk.
--
-- Access is only through the actor-checked functions below. An active BOARD or
-- OWNER member of the cycle reads the rollup and edits that cycle's thresholds.
-- The rollup returns counts only: no event names, project titles, check-in
-- times or onboarding notes. It reads no member-tool records.
-- Threshold writes carry an optimistic revision and are audited with the
-- values set (they are configuration, not confidential content).
create table rush.member_standing_settings (
 cycle_id text primary key references rush.rush_cycles(id) on delete cascade,
 -- Keep these defaults in step with DEFAULT_THRESHOLDS in src/lib/standing/model.ts.
 min_attendance_pct integer not null default 50 check (min_attendance_pct between 0 and 100),
 min_projects integer not null default 1 check (min_projects between 0 and 10),
 require_onboarding boolean not null default true,
 revision integer not null default 0 check (revision >= 0),
 updated_at timestamptz not null default now(),
 updated_by uuid references rush.profiles(id) on delete set null
);
alter table rush.member_standing_settings enable row level security;
alter table rush.member_standing_settings force row level security;
-- No policies and no table grants: access is exclusively through the RPCs.
revoke all on rush.member_standing_settings from public, anon, authenticated;

create function rush.standing_is_board(target_cycle_id text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from rush.memberships m join rush.profiles p on p.id=m.user_id
  where m.user_id=rush.actor_id() and m.cycle_id=target_cycle_id and m.active and p.active and m.role in ('BOARD','OWNER'));
$$;

create function rush.standing_thresholds_json(target_cycle_id text) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'minAttendancePct',coalesce(s.min_attendance_pct,50),
  'minProjects',coalesce(s.min_projects,1),
  'requireOnboarding',coalesce(s.require_onboarding,true),
  'revision',coalesce(s.revision,0),
  'updatedAt',s.updated_at,
  'configured',s.cycle_id is not null)
 from (select target_cycle_id as id) c left join rush.member_standing_settings s on s.cycle_id=c.id;
$$;

-- Members are active profiles with an active membership in the cycle in any
-- role except PANEL alone (panelists can be outside judges, not members).
-- Events held: the cycle's PUBLISHED or CLOSED events that have started.
-- Onboarding: the checklist from the member's most recently accepted offer.
create function rush.member_standing(target_cycle_id text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if target_cycle_id is null or not rush.standing_is_board(target_cycle_id) then
  raise exception 'Board access required' using errcode='42501'; end if;
 return jsonb_build_object(
  'cycleId',target_cycle_id,
  'thresholds',rush.standing_thresholds_json(target_cycle_id),
  'members',coalesce((
   with held as (
    select e.id from rush.events e
    where e.cycle_id=target_cycle_id and e.status in ('PUBLISHED','CLOSED') and e.starts_at<=now()),
   people as (
    select p.id, p.display_name, array_agg(distinct m.role::text order by m.role::text) as roles
    from rush.memberships m join rush.profiles p on p.id=m.user_id
    where m.cycle_id=target_cycle_id and m.active and p.active
    group by p.id, p.display_name
    having bool_or(m.role<>'PANEL')),
   onboarding as (
    select distinct on (pn.auth_user_id) pn.auth_user_id as user_id, a.id as application_id
    from rush.applications a join rush.pnms pn on pn.id=a.pnm_id
    where a.offer_response='ACCEPTED' and pn.auth_user_id is not null
     and exists(select 1 from rush.member_onboarding_items i where i.application_id=a.id)
    order by pn.auth_user_id, a.offer_responded_at desc nulls last, a.id)
   select jsonb_agg(jsonb_build_object(
    'userId',pe.id,'name',pe.display_name,'roles',to_jsonb(pe.roles),
    'eventsAttended',(select count(*) from rush.member_checkins mc join held h on h.id=mc.event_id where mc.member_id=pe.id),
    'eventsHeld',(select count(*) from held),
    'projects',(select count(*) from rush.project_members pm where pm.user_id=pe.id),
    'onboardingDone',case when o.application_id is null then null else ob.done end,
    'onboardingTotal',case when o.application_id is null then null else ob.total end)
    order by pe.display_name, pe.id)
   from people pe left join onboarding o on o.user_id=pe.id
   left join lateral (select count(*) filter (where i.completed_at is not null) as done, count(*) as total
    from rush.member_onboarding_items i where i.application_id=o.application_id) ob on true),'[]'::jsonb));
end; $$;

create function rush.save_member_standing_thresholds(target_cycle_id text, expected_revision integer, min_attendance_pct integer, min_projects integer, require_onboarding boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid := rush.actor_id(); current_revision integer; saved rush.member_standing_settings%rowtype;
begin
 if target_cycle_id is null or not rush.standing_is_board(target_cycle_id) then
  raise exception 'Board access required' using errcode='42501'; end if;
 if expected_revision is null or expected_revision<0 then raise exception 'Invalid revision' using errcode='22023'; end if;
 if min_attendance_pct is null or min_attendance_pct not between 0 and 100
  or min_projects is null or min_projects not between 0 and 10 or require_onboarding is null then
  raise exception 'Check the standing thresholds' using errcode='22023'; end if;
 insert into rush.member_standing_settings(cycle_id) values(target_cycle_id) on conflict do nothing;
 select s.revision into current_revision from rush.member_standing_settings s where s.cycle_id=target_cycle_id for update;
 if current_revision<>expected_revision then
  raise exception 'Thresholds changed. Reload before saving.' using errcode='55000'; end if;
 update rush.member_standing_settings s set min_attendance_pct=save_member_standing_thresholds.min_attendance_pct,
  min_projects=save_member_standing_thresholds.min_projects, require_onboarding=save_member_standing_thresholds.require_onboarding,
  revision=s.revision+1, updated_at=now(), updated_by=actor
  where s.cycle_id=target_cycle_id returning s.* into saved;
 insert into rush.audit_events(actor_id,cycle_id,action,resource,resource_id,metadata)
 values(actor,target_cycle_id,'MEMBER_STANDING_THRESHOLDS_SET','Cycle',target_cycle_id,jsonb_build_object(
  'minAttendancePct',saved.min_attendance_pct,'minProjects',saved.min_projects,'requireOnboarding',saved.require_onboarding,'revision',saved.revision));
 return rush.standing_thresholds_json(target_cycle_id);
end; $$;

revoke all on function rush.standing_is_board(text), rush.standing_thresholds_json(text), rush.member_standing(text),
 rush.save_member_standing_thresholds(text,integer,integer,integer,boolean) from public, anon, authenticated;
grant execute on function rush.member_standing(text), rush.save_member_standing_thresholds(text,integer,integer,integer,boolean) to authenticated;
