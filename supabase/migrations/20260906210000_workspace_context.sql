-- Give the internal workspace one cycle-bound source for navigation state.
-- This replaces the independent screening, event, and round lookups that every
-- page previously triggered through WorkspaceNav.

create or replace function rush.workspace_context(target_cycle_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := rush.actor_id();
  is_screening_reviewer boolean;
  open_screening_count integer;
  open_evaluation_count integer;
  open_calibration_count integer;
  open_live_event_count integer;
  open_speed_dating_count integer;
  open_task_count integer;
  has_grading_event boolean;
  has_speed_dating_round boolean;
  has_group_case_work boolean;
begin
  if actor is null or not rush.has_cycle_role(
    target_cycle_id,
    array['MEMBER', 'BOARD', 'PANEL', 'OWNER', 'RECRUITMENT_COMMITTEE']::rush.member_role[]
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select rush.is_active_screening_reviewer(target_cycle_id)
  into is_screening_reviewer;

  select count(*)::integer
  into open_screening_count
  from rush.screening_assignments assignment
  join rush.screening_packets packet on packet.id = assignment.packet_id
  join rush.screening_batches batch on batch.id = packet.batch_id
  join rush.screening_reviewers reviewer
    on reviewer.batch_id = batch.id
   and reviewer.reviewer_id = assignment.reviewer_id
   and reviewer.active
  where is_screening_reviewer
    and batch.cycle_id = target_cycle_id
    and batch.status = 'PUBLISHED'
    and assignment.reviewer_id = actor
    and assignment.status = 'ASSIGNED';

  with open_assignments as (
    select
      assignment.id,
      assignment.round_id,
      exists (
        select 1
        from rush.round_calibration_acknowledgements acknowledgement
        where acknowledgement.round_id = assignment.round_id
          and acknowledgement.rubric_id = active_rubric.id
          and acknowledgement.evaluator_id = actor
      ) as calibrated
    from rush.evaluation_assignments assignment
    join rush.rounds round on round.id = assignment.round_id
    join lateral (
      select rubric.id
      from rush.rubrics rubric
      where rubric.round_id = round.id
      order by rubric.version desc
      limit 1
    ) active_rubric on true
    where assignment.evaluator_id = actor
      and round.cycle_id = target_cycle_id
      and round.kind <> 'SPEED_DATING'
      and round.status = 'ACTIVE'
      and assignment.status in ('ASSIGNED', 'IN_PROGRESS')
      and not exists (
        select 1
        from rush.evaluations evaluation
        where evaluation.assignment_id = assignment.id
          and evaluation.status in ('SUBMITTED', 'LOCKED')
      )
  )
  select
    count(*) filter (where calibrated)::integer,
    count(distinct round_id) filter (where not calibrated)::integer
  into open_evaluation_count, open_calibration_count
  from open_assignments;

  select exists (
    select 1
    from rush.events event
    join rush.member_checkins checkin
      on checkin.event_id = event.id
     and checkin.member_id = actor
    join rush.rush_cycles cycle
      on cycle.id = event.cycle_id
     and cycle.status not in ('CLOSED', 'ARCHIVED')
    where event.cycle_id = target_cycle_id
      and event.member_grading
      and event.status = 'PUBLISHED'
      and now() <= event.checkin_closes_at + interval '4 hours'
  ) into has_grading_event;

  select case when exists (
    select 1
    from rush.events event
    join rush.member_checkins checkin
      on checkin.event_id = event.id
     and checkin.member_id = actor
    join rush.rush_cycles cycle
      on cycle.id = event.cycle_id
     and cycle.status not in ('CLOSED', 'ARCHIVED')
    where event.cycle_id = target_cycle_id
      and event.member_grading
      and event.status = 'PUBLISHED'
      and now() between event.checkin_opens_at and event.checkin_closes_at + interval '4 hours'
  ) then 1 else 0 end
  into open_live_event_count;

  select not is_screening_reviewer and exists (
    select 1
    from rush.rounds round
    where round.cycle_id = target_cycle_id
      and round.kind = 'SPEED_DATING'
      and round.status in ('PUBLISHED', 'ACTIVE')
  ) into has_speed_dating_round;

  select case when exists (
    select 1
    from rush.rounds round
    where round.cycle_id = target_cycle_id
      and round.kind = 'SPEED_DATING'
      and round.status = 'ACTIVE'
      and (round.closes_at is null or round.closes_at >= now())
  ) and not is_screening_reviewer then 1 else 0 end
  into open_speed_dating_count;

  select exists (
    select 1
    from rush.evaluation_assignments assignment
    join rush.rounds round on round.id = assignment.round_id
    where assignment.evaluator_id = actor
      and round.cycle_id = target_cycle_id
      and round.kind = 'GROUP_CASE'
      and round.status in ('PUBLISHED', 'ACTIVE')
      and assignment.status in ('ASSIGNED', 'IN_PROGRESS')
  ) into has_group_case_work;

  open_task_count := open_screening_count
    + open_evaluation_count
    + open_calibration_count
    + open_live_event_count
    + open_speed_dating_count;

  return jsonb_build_object(
    'cycleId', target_cycle_id,
    'isScreeningReviewer', is_screening_reviewer,
    'openScreeningCount', open_screening_count,
    'openEvaluationCount', open_evaluation_count,
    'openCalibrationCount', open_calibration_count,
    'openLiveEventCount', open_live_event_count,
    'openTaskCount', open_task_count,
    'hasGradingEvent', has_grading_event,
    'hasSpeedDatingRound', has_speed_dating_round,
    'hasGroupCaseWork', has_group_case_work
  );
end;
$$;

revoke all on function rush.workspace_context(text) from public, anon;
grant execute on function rush.workspace_context(text) to authenticated, service_role;
