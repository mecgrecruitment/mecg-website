-- Board view of Group Case grades, the Speed Dating results shape applied to
-- a six-criterion rubric. Each grader's latest submitted evaluation becomes
-- one weighted score on the guide's 8..40 scale:
--   weighted = 8 * sum(weight * score) / sum(weight)
-- over the criteria that grader actually scored (null = not observed drops
-- out of both sums), so a partial rating still reads on the same scale.
-- The applicant mean averages those per-grader scores; criterionMeans give
-- the raw 1..5 average per criterion across graders.
create or replace function rush.group_case_results(target_round_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := rush.actor_id();
  round_row rush.rounds%rowtype;
  active_rubric_id text;
  result jsonb;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  select * into round_row from rush.rounds where id = target_round_id;
  if round_row.id is null then raise exception 'round missing' using errcode = 'P0002'; end if;
  if not rush.has_cycle_role(round_row.cycle_id, array['BOARD','PANEL','OWNER']::rush.member_role[]) then
    raise exception 'board role required' using errcode = '42501';
  end if;
  if round_row.kind <> 'GROUP_CASE' then
    raise exception 'not a Group Case round' using errcode = '55000';
  end if;

  select rubric.id into active_rubric_id
  from rush.rubrics rubric where rubric.round_id = target_round_id
  order by rubric.version desc limit 1;

  with criterion as (
    select criterion.id, criterion.key, criterion.name, criterion.weight, criterion.position
    from rush.rubric_criteria criterion
    where criterion.rubric_id = active_rubric_id
  ),
  applicant as (
    select
      application.id,
      pnm.name,
      application.status::text status,
      (
        select case_group.name
        from rush.case_group_members membership
        join rush.case_groups case_group on case_group.id = membership.group_id
        where membership.application_id = application.id
          and case_group.cycle_id = round_row.cycle_id
        order by case_group.name, case_group.id
        limit 1
      ) group_name
    from rush.round_participations participation
    join rush.applications application on application.id = participation.application_id
    join rush.pnms pnm on pnm.id = application.pnm_id
    where participation.round_id = target_round_id
      and application.status not in ('DRAFT', 'WITHDRAWN')
  ),
  evaluated as (
    select
      applicant.id application_id,
      assignment.evaluator_id,
      profile.display_name evaluator_name,
      evaluation.id evaluation_id,
      evaluation.submitted_at,
      evaluation.updated_at,
      nullif(trim(evaluation.evidence), '') note
    from applicant
    join rush.evaluation_assignments assignment
      on assignment.round_id = target_round_id
     and assignment.application_id = applicant.id
    join rush.profiles profile on profile.id = assignment.evaluator_id
    join lateral (
      select evaluation.id, evaluation.submitted_at, evaluation.updated_at, evaluation.evidence
      from rush.evaluations evaluation
      where evaluation.assignment_id = assignment.id
        and evaluation.voided_at is null
        and evaluation.status in ('SUBMITTED', 'LOCKED')
      order by evaluation.version desc
      limit 1
    ) evaluation on true
  ),
  -- One row per evaluation x rubric criterion; a criterion the grader never touched reads as null.
  rated as (
    select evaluated.application_id, evaluated.evaluation_id, criterion.id criterion_id, criterion.weight, rating.score
    from evaluated
    cross join criterion
    left join rush.criterion_ratings rating
      on rating.evaluation_id = evaluated.evaluation_id
     and rating.criterion_id = criterion.id
  ),
  scored as (
    select
      evaluated.application_id,
      evaluated.evaluator_id,
      evaluated.evaluator_name,
      evaluated.evaluation_id,
      evaluated.submitted_at,
      evaluated.updated_at,
      evaluated.note,
      8 * sum(rated.weight * rated.score)::numeric / nullif(sum(rated.weight) filter (where rated.score is not null), 0) weighted,
      count(rated.score)::integer scored_count,
      count(*)::integer criteria_count,
      jsonb_object_agg(rated.criterion_id, rated.score) scores
    from evaluated
    join rated on rated.evaluation_id = evaluated.evaluation_id
    group by evaluated.application_id, evaluated.evaluator_id, evaluated.evaluator_name, evaluated.evaluation_id,
      evaluated.submitted_at, evaluated.updated_at, evaluated.note
    -- A grader who cleared every star and left no note has not graded; a note-only save still counts.
    having count(rated.score) > 0 or evaluated.note is not null
  ),
  criterion_mean as (
    select application_id, jsonb_object_agg(criterion_id, round(mean, 2)) means
    from (
      select rated.application_id, rated.criterion_id, avg(rated.score) mean
      from rated
      group by rated.application_id, rated.criterion_id
    ) per_criterion
    group by application_id
  ),
  stats as (
    select
      application_id,
      count(*)::integer evaluation_count,
      round(avg(weighted), 1) mean,
      jsonb_agg(jsonb_build_object(
        'evaluatorId', evaluator_id,
        'evaluatorName', evaluator_name,
        'weighted', round(weighted, 1),
        'scoredCount', scored_count,
        'criteriaCount', criteria_count,
        'scores', scores,
        'note', coalesce(note, ''),
        'submittedAt', submitted_at
      ) order by updated_at desc, evaluator_name) evaluations
    from scored
    group by application_id
  ),
  grader as (
    select
      evaluator_id,
      evaluator_name,
      count(*)::integer evaluation_count,
      round(avg(weighted), 1) mean,
      count(note)::integer note_count
    from scored
    group by evaluator_id, evaluator_name
  ),
  ranked as (
    select
      applicant.id,
      applicant.name,
      applicant.status,
      applicant.group_name,
      coalesce(stats.evaluation_count, 0) evaluation_count,
      stats.mean,
      coalesce(criterion_mean.means, '{}'::jsonb) criterion_means,
      coalesce(stats.evaluations, '[]'::jsonb) evaluations
    from applicant
    left join stats on stats.application_id = applicant.id
    left join criterion_mean on criterion_mean.application_id = applicant.id
  )
  select jsonb_build_object(
    'roundId', round_row.id,
    'roundName', round_row.name,
    'roundStatus', round_row.status::text,
    'criteria', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', criterion.id, 'key', criterion.key, 'name', criterion.name,
        'weight', criterion.weight, 'position', criterion.position
      ) order by criterion.position, criterion.id)
      from criterion
    ), '[]'::jsonb),
    'summary', (
      select jsonb_build_object(
        'applicants', count(*),
        'graded', count(*) filter (where evaluation_count > 0),
        'graders', (select count(*) from grader),
        'evaluations', coalesce(sum(evaluation_count), 0)
      )
      from ranked
    ),
    'applicants', coalesce((
      select jsonb_agg(jsonb_build_object(
        'applicationId', id,
        'name', name,
        'status', status,
        'groupName', group_name,
        'count', evaluation_count,
        'mean', mean,
        'criterionMeans', criterion_means,
        'evaluations', evaluations
      ) order by mean desc nulls last, name, id)
      from ranked
    ), '[]'::jsonb),
    'graders', coalesce((
      select jsonb_agg(jsonb_build_object(
        'evaluatorId', evaluator_id,
        'evaluatorName', evaluator_name,
        'count', evaluation_count,
        'mean', mean,
        'notes', note_count
      ) order by evaluation_count desc, evaluator_name, evaluator_id)
      from grader
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function rush.group_case_results(text) from public, anon;
grant execute on function rush.group_case_results(text) to authenticated, service_role;
