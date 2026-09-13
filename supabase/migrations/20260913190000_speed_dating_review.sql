-- After the night the Board reviews every score and note, not just a mean.
-- A raw mean rewards the applicants who happened to meet lenient graders, so
-- the ranking uses grader-normalized scores: each score is expressed relative
-- to what that grader gave everyone else, then averaged per applicant. Thin
-- (fewer than 8 scores) and split (stddev at or above 1.0) flag where the
-- mean itself is not trustworthy. The screening ranking from 5aa5ba1 fits an
-- additive model for the same reason; a per-grader z-score is the SQL-sized
-- version of that idea, and here every grader meets nearly every applicant,
-- so the pool a grader drew does not skew their lean the way it did there.
--
-- Adjusted score: for a score s by grader g with mean_g and stddev_pop_g over
-- g's scores this round,
--   z = (s - mean_g) / stddev_g   when stddev_g > 0 and g has at least 3 scores
--   z = s - mean_g                otherwise (a grader who gave everyone the
--                                 same star contributes 0, which is right)
--   adjusted = clamp(round(3 + avg(z), 2), 1, 5)
-- so it reads on the same 1-to-5 feel as the mean. 5aa5ba1 has no degenerate
-- rule (least squares never divides by a reader's spread); the fallback above
-- is this function's own choice.
create or replace function rush.speed_dating_results(target_round_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := rush.actor_id();
  round_row rush.rounds%rowtype;
  result jsonb;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  select * into round_row from rush.rounds where id = target_round_id;
  if round_row.id is null then raise exception 'round missing' using errcode = 'P0002'; end if;
  if not rush.has_cycle_role(round_row.cycle_id, array['BOARD','PANEL','OWNER']::rush.member_role[]) then
    raise exception 'board role required' using errcode = '42501';
  end if;
  if round_row.kind <> 'SPEED_DATING' then
    raise exception 'not a Speed Dating round' using errcode = '55000';
  end if;

  with applicant as (
    select application.id, pnm.name, application.status::text status
    from rush.round_participations participation
    join rush.applications application on application.id = participation.application_id
    join rush.pnms pnm on pnm.id = application.pnm_id
    where participation.round_id = target_round_id
      and application.status not in ('DRAFT', 'WITHDRAWN')
  ),
  scored as (
    select
      applicant.id application_id,
      assignment.evaluator_id,
      profile.display_name evaluator_name,
      evaluation.submitted_at,
      evaluation.updated_at,
      evaluation.session,
      rating.score,
      nullif(trim(rating.note), '') note
    from applicant
    join rush.evaluation_assignments assignment
      on assignment.round_id = target_round_id
     and assignment.application_id = applicant.id
    join rush.profiles profile on profile.id = assignment.evaluator_id
    join lateral (
      select evaluation.id, evaluation.submitted_at, evaluation.updated_at, evaluation.session
      from rush.evaluations evaluation
      where evaluation.assignment_id = assignment.id
        and evaluation.voided_at is null
        and evaluation.status in ('SUBMITTED', 'LOCKED')
      order by evaluation.version desc
      limit 1
    ) evaluation on true
    join lateral (
      select rating.score, rating.note
      from rush.criterion_ratings rating
      join rush.rubric_criteria criterion on criterion.id = rating.criterion_id
      where rating.evaluation_id = evaluation.id
      order by criterion.position
      limit 1
    ) rating on true
    where rating.score is not null
  ),
  grader as (
    select
      evaluator_id,
      evaluator_name,
      count(*)::integer score_count,
      avg(score) mean,
      stddev_pop(score) sd,
      count(note)::integer note_count
    from scored
    group by evaluator_id, evaluator_name
  ),
  normalized as (
    select
      s.*,
      case when g.score_count >= 3 and g.sd > 0 then (s.score - g.mean) / g.sd
           else s.score - g.mean end z
    from scored s
    join grader g on g.evaluator_id = s.evaluator_id
  ),
  stats as (
    select
      application_id,
      count(*)::integer score_count,
      round(avg(score), 2) mean,
      round((percentile_cont(0.5) within group (order by score))::numeric, 1) median,
      case when count(*) >= 2 then round(stddev_pop(score), 2) end sd,
      least(5, greatest(1, round(3 + avg(z), 2))) adjusted,
      jsonb_build_array(
        count(*) filter (where score = 1),
        count(*) filter (where score = 2),
        count(*) filter (where score = 3),
        count(*) filter (where score = 4),
        count(*) filter (where score = 5)
      ) histogram,
      jsonb_agg(jsonb_build_object(
        'evaluatorName', evaluator_name,
        'evaluatorId', evaluator_id,
        'session', session,
        'score', score,
        'note', coalesce(note, ''),
        'submittedAt', submitted_at
      ) order by updated_at desc, evaluator_name) scores
    from normalized
    group by application_id
  ),
  ranked as (
    select
      applicant.id,
      applicant.name,
      applicant.status,
      stats.mean,
      stats.median,
      coalesce(stats.score_count, 0) score_count,
      stats.sd,
      stats.adjusted,
      coalesce(stats.histogram, '[0, 0, 0, 0, 0]'::jsonb) histogram,
      coalesce(stats.score_count, 0) < 8 thin,
      coalesce(stats.sd >= 1.0, false) split,
      coalesce(stats.scores, '[]'::jsonb) scores
    from applicant
    left join stats on stats.application_id = applicant.id
  )
  select jsonb_build_object(
    'roundId', round_row.id,
    'roundName', round_row.name,
    'roundStatus', round_row.status::text,
    'summary', (
      select jsonb_build_object(
        'applicants', count(*),
        'graded', count(*) filter (where score_count > 0),
        'graders', (select count(*) from grader),
        'thin', count(*) filter (where thin),
        'split', count(*) filter (where split),
        'scores', coalesce(sum(score_count), 0)
      )
      from ranked
    ),
    'applicants', coalesce((
      select jsonb_agg(jsonb_build_object(
        'applicationId', id,
        'name', name,
        'status', status,
        'mean', mean,
        'median', median,
        'count', score_count,
        'stddev', sd,
        'adjusted', adjusted,
        'histogram', histogram,
        'thin', thin,
        'split', split,
        'scores', scores
      ) order by adjusted desc nulls last, mean desc nulls last, name, id)
      from ranked
    ), '[]'::jsonb),
    'graders', coalesce((
      select jsonb_agg(jsonb_build_object(
        'evaluatorId', evaluator_id,
        'evaluatorName', evaluator_name,
        'count', score_count,
        'mean', round(mean, 2),
        'stddev', case when score_count >= 2 then round(sd, 2) end,
        'notes', note_count
      ) order by score_count desc, evaluator_name, evaluator_id)
      from grader
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function rush.speed_dating_results(text) from public, anon;
grant execute on function rush.speed_dating_results(text) to authenticated, service_role;
