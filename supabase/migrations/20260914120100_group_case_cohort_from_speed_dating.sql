-- The Group Case cohort is the Speed Dating cohort, by Board decision on
-- 2026-09-14: everyone enrolled in Speed Dating is enrolled in Group Case and
-- their application moves INVITED -> GROUP_CASE. Later advances still go
-- through rush.set_application_status. Idempotent: re-running enrolls nobody
-- twice and flips nobody who already moved on.

do $$
declare
  cycle_row record;
  owner_id uuid;
  gc_rubric_id text;
  flipped integer;
  enrolled integer;
begin
  for cycle_row in
    select c.id cycle_id,
      (select id from rush.rounds where cycle_id = c.id and kind = 'SPEED_DATING' order by created_at desc limit 1) sd_round_id,
      (select id from rush.rounds where cycle_id = c.id and kind = 'GROUP_CASE' order by created_at desc limit 1) gc_round_id
    from rush.rush_cycles c
  loop
    if cycle_row.sd_round_id is null or cycle_row.gc_round_id is null then continue; end if;
    select id into gc_rubric_id from rush.rubrics where round_id = cycle_row.gc_round_id order by version desc limit 1;
    if gc_rubric_id is null then continue; end if;
    select user_id into owner_id from rush.memberships
    where cycle_id = cycle_row.cycle_id and role = 'OWNER' and active
    order by created_at limit 1;
    if owner_id is null then continue; end if;

    with flipped_rows as (
      update rush.applications application
      set status = 'GROUP_CASE'
      where application.status = 'INVITED'
        and exists (
          select 1 from rush.round_participations participation
          where participation.round_id = cycle_row.sd_round_id
            and participation.application_id = application.id
        )
      returning application.id
    )
    insert into rush.audit_events (actor_id, cycle_id, action, resource, resource_id, metadata)
    select owner_id, cycle_row.cycle_id, 'APPLICATION_STATUS_CHANGED', 'Application', id,
      jsonb_build_object('from', 'INVITED', 'to', 'GROUP_CASE', 'reason', 'copied from Speed Dating cohort')
    from flipped_rows;
    get diagnostics flipped = row_count;

    insert into rush.round_participations (
      round_id, application_id, rubric_id, required_evaluators, assignment_policy, advanced_by
    )
    select cycle_row.gc_round_id, participation.application_id, gc_rubric_id, 2,
      jsonb_build_object('version', 1, 'strategy', 'self_service'), owner_id
    from rush.round_participations participation
    join rush.applications application on application.id = participation.application_id
    where participation.round_id = cycle_row.sd_round_id
      and application.status not in ('DRAFT', 'WITHDRAWN')
    on conflict (round_id, application_id) do nothing;
    get diagnostics enrolled = row_count;

    if flipped > 0 or enrolled > 0 then
      insert into rush.audit_events (actor_id, cycle_id, action, resource, resource_id, metadata)
      values (owner_id, cycle_row.cycle_id, 'GROUP_CASE_COHORT_COPIED', 'Round', cycle_row.gc_round_id,
        jsonb_build_object('enrolled', enrolled, 'statusFlipped', flipped));
    end if;
  end loop;
end;
$$;
