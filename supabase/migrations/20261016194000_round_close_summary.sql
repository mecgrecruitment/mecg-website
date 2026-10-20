-- Read-only pre-freeze evidence snapshot. This never authorizes or blocks a
-- transition; set_round_status retains its existing Board/Owner authority.
-- Cohort is real enrollment UNION legacy actual assignments, never every
-- applicant in a cycle and never a fabricated expected Speed Dating queue.
create or replace function rush.round_close_summary(target_round_id text)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  round_row rush.rounds%rowtype;
  active_rubric_id text;
  result jsonb;
begin
  if rush.actor_id() is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  select * into round_row from rush.rounds where id = target_round_id;
  if round_row.id is null or not rush.has_cycle_role(round_row.cycle_id, array['BOARD','OWNER']::rush.member_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  -- Screening has a separate three-review batch/freeze contract. Do not present
  -- two interview evaluations as screening readiness or infer a fake cohort.
  if round_row.kind = 'APPLICATION_SCREEN' then
    raise exception 'use screening batch coverage' using errcode = '55000';
  end if;
  select rubric.id into active_rubric_id from rush.rubrics rubric
    where rubric.round_id = target_round_id order by rubric.version desc limit 1;

  with cohort as (
    select application.id
    from rush.applications application
    where application.cycle_id = round_row.cycle_id
      and application.status not in ('DRAFT','WITHDRAWN')
      and (exists (
        select 1 from rush.round_participations participation
        where participation.round_id = target_round_id and participation.application_id = application.id
      ) or exists (
        select 1 from rush.evaluation_assignments assignment
        where assignment.round_id = target_round_id and assignment.application_id = application.id
      ))
  ), assigned as (
    select assignment.* from rush.evaluation_assignments assignment
    join cohort on cohort.id = assignment.application_id
    where assignment.round_id = target_round_id
  ), submitted as (
    select assignment.application_id, assignment.evaluator_id, evaluation.id,
      evaluation.rubric_id
    from assigned assignment
    join lateral (
      select observation.id, observation.status, observation.rubric_id
      from rush.evaluations observation
      where observation.assignment_id = assignment.id and observation.voided_at is null
      order by observation.version desc limit 1
    ) evaluation on evaluation.status in ('SUBMITTED','LOCKED')
  ), valid as (
    select distinct submitted.application_id, submitted.evaluator_id
    from submitted
    cross join lateral rush.evaluation_observation_quality(submitted.id) quality
    where quality.valid and submitted.rubric_id = active_rubric_id
      and not exists (
        select 1 from rush.conflict_declarations conflict
        where conflict.application_id = submitted.application_id
          and conflict.declarer_id = submitted.evaluator_id
      )
  ), coverage as (
    select cohort.id, count(valid.evaluator_id) >= 2 ready
    from cohort left join valid on valid.application_id = cohort.id
    group by cohort.id
  )
  select jsonb_build_object(
    'roundId', round_row.id,
    'roundStatus', round_row.status::text,
    'checkedAt', statement_timestamp(),
    'applicants', (select count(*) from coverage),
    'applicantsReady', (select count(*) from coverage where ready),
    'applicantsIncomplete', (select count(*) from coverage where not ready),
    'submittedEvaluations', (select count(*) from submitted),
    'validEvaluations', (select count(*) from valid),
    -- Conflict/recusal policy must not hide actual unfinished records. A declared
    -- conflict excludes merit validity, but an open record still closes at freeze.
    'openAssignments', (select count(*) from assigned where status in ('ASSIGNED','IN_PROGRESS'))
  ) into result;
  return result;
end;
$$;
revoke all on function rush.round_close_summary(text) from public, anon;
grant execute on function rush.round_close_summary(text) to authenticated, service_role;
