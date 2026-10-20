-- A Speed Dating grader can save a note before, or without, picking a star.
-- Two minutes is often enough to notice something worth writing down and not
-- enough to settle on a number, and Group Case (20260914130000) already lets
-- a note stand on its own. rate_speed_dating_applicant now accepts a null
-- score; the only refused save is an empty first one (no star, no note, no
-- prior evaluation), the same rule rate_group_case_applicant applies.
-- speed_dating_results lists a note-only row under the applicant but never
-- counts it as a score: means, spreads, histograms, z-scores and the grader
-- table all aggregate over score, which ignores null. Both bodies are copied
-- from 20260913180000 and 20260913190000 with only those edits; no data is
-- touched.

-- One tap, one saved rating. Creates the member's assignment and evaluation
-- on the first save and rewrites the same rows on every later one; a frozen
-- round refuses before anything is touched. A note with no star is a valid
-- save too; criterion_ratings.score is nullable and readers skip null.
create or replace function rush.rate_speed_dating_applicant(
  target_round_id text,
  target_application_id text,
  target_session integer,
  score integer,
  note text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := rush.actor_id();
  round_row rush.rounds%rowtype;
  active_rubric_id text;
  active_criterion_id text;
  assignment_row rush.evaluation_assignments%rowtype;
  evaluation_row rush.evaluations%rowtype;
  clean_score integer := score;
  clean_note text := nullif(trim(note), '');
  saved_at timestamptz := now();
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  select * into round_row from rush.rounds where id = target_round_id for share;
  if round_row.id is null then raise exception 'round missing' using errcode = 'P0002'; end if;
  if round_row.kind <> 'SPEED_DATING' then
    raise exception 'not a Speed Dating round' using errcode = '55000';
  end if;
  if round_row.status <> 'ACTIVE' then
    raise exception 'round is not open for grading' using errcode = '55000';
  end if;
  if not rush.has_cycle_role(round_row.cycle_id, array['MEMBER','BOARD','PANEL','OWNER']::rush.member_role[])
     or rush.is_active_screening_reviewer(round_row.cycle_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (
    select 1
    from rush.round_participations participation
    join rush.applications application on application.id = participation.application_id
    where participation.round_id = target_round_id
      and participation.application_id = target_application_id
      and application.cycle_id = round_row.cycle_id
  ) then
    raise exception 'applicant is not in this round' using errcode = '22023';
  end if;
  if exists (
    select 1 from rush.conflict_declarations conflict
    where conflict.declarer_id = actor and conflict.application_id = target_application_id
  ) then raise exception 'conflict declared' using errcode = '42501'; end if;
  if target_session is null or target_session not between 1 and 4 then
    raise exception 'session must be between 1 and 4' using errcode = '22023';
  end if;
  if clean_score is not null and clean_score not between 1 and 5 then
    raise exception 'score must be 1 to 5' using errcode = '22023';
  end if;
  -- Clearing the note on an applicant already saved is a valid save;
  -- an empty first save is not.
  if clean_score is null and clean_note is null and not exists (
    select 1
    from rush.evaluations evaluation
    join rush.evaluation_assignments assignment on assignment.id = evaluation.assignment_id
    where assignment.round_id = target_round_id
      and assignment.application_id = target_application_id
      and assignment.evaluator_id = actor
      and evaluation.voided_at is null
  ) then
    raise exception 'pick a star or write a note' using errcode = '22023';
  end if;
  if char_length(clean_note) > 2000 then
    raise exception 'note must be 2000 characters or fewer' using errcode = '22023';
  end if;

  select rubric.id into active_rubric_id
  from rush.rubrics rubric
  where rubric.round_id = target_round_id
  order by rubric.version desc
  limit 1;
  select criterion.id into active_criterion_id
  from rush.rubric_criteria criterion
  where criterion.rubric_id = active_rubric_id
    and criterion.required
    and criterion.weight = 100
    and (select count(*) from rush.rubric_criteria where rubric_id = active_rubric_id) = 1;
  if active_criterion_id is null then
    raise exception 'Speed Dating rubric is not ready' using errcode = '55000';
  end if;

  -- Saving a rating is the acknowledgement; the evaluations trigger insists on one.
  insert into rush.round_calibration_acknowledgements (round_id, rubric_id, evaluator_id)
  values (target_round_id, active_rubric_id, actor)
  on conflict (round_id, rubric_id, evaluator_id) do nothing;

  insert into rush.evaluation_assignments (round_id, application_id, evaluator_id)
  values (target_round_id, target_application_id, actor)
  on conflict (round_id, application_id, evaluator_id) do nothing;
  select * into assignment_row
  from rush.evaluation_assignments assignment
  where assignment.round_id = target_round_id
    and assignment.application_id = target_application_id
    and assignment.evaluator_id = actor
  for update;
  if assignment_row.status = 'LOCKED' then
    raise exception 'round is frozen' using errcode = '55000';
  end if;

  select * into evaluation_row
  from rush.evaluations evaluation
  where evaluation.assignment_id = assignment_row.id
    and evaluation.voided_at is null
  order by evaluation.version desc
  limit 1
  for update;
  if evaluation_row.id is null then
    insert into rush.evaluations (assignment_id, evaluator_id, rubric_id, version, status, submitted_at, session)
    values (
      assignment_row.id,
      actor,
      active_rubric_id,
      (select coalesce(max(version), 0) + 1 from rush.evaluations where assignment_id = assignment_row.id),
      'SUBMITTED',
      saved_at,
      target_session
    )
    returning * into evaluation_row;
  elsif evaluation_row.status in ('DRAFT', 'SUBMITTED') then
    update rush.evaluations evaluation
    set session = target_session,
        status = 'SUBMITTED',
        submitted_at = coalesce(evaluation.submitted_at, saved_at),
        updated_at = saved_at
    where evaluation.id = evaluation_row.id
    returning * into evaluation_row;
  else
    raise exception 'round is frozen' using errcode = '55000';
  end if;

  insert into rush.criterion_ratings (evaluation_id, criterion_id, score, note)
  values (evaluation_row.id, active_criterion_id, clean_score, clean_note)
  on conflict (evaluation_id, criterion_id) do update
    set score = excluded.score, note = excluded.note;

  update rush.evaluation_assignments
  set status = 'SUBMITTED'
  where id = assignment_row.id and status <> 'SUBMITTED';

  insert into rush.audit_events (actor_id, cycle_id, action, resource, resource_id, metadata)
  values (actor, round_row.cycle_id, 'SPEED_DATING_RATED', 'Application', target_application_id,
          jsonb_build_object('roundId', target_round_id, 'session', target_session,
                             'score', clean_score, 'hasNote', clean_note is not null));

  return jsonb_build_object(
    'applicationId', target_application_id,
    'score', clean_score,
    'note', coalesce(clean_note, ''),
    'session', target_session,
    'savedAt', evaluation_row.updated_at
  );
end;
$$;

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
    -- A row with a null score is a note-only save: listed, never counted.
  ),
  grader as (
    select
      evaluator_id,
      evaluator_name,
      count(score)::integer score_count,
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
      count(score)::integer score_count,
      round(avg(score), 2) mean,
      round((percentile_cont(0.5) within group (order by score))::numeric, 1) median,
      case when count(score) >= 2 then round(stddev_pop(score), 2) end sd,
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

revoke all on function rush.rate_speed_dating_applicant(text, text, integer, integer, text) from public, anon;
revoke all on function rush.speed_dating_results(text) from public, anon;
grant execute on function rush.rate_speed_dating_applicant(text, text, integer, integer, text) to authenticated, service_role;
grant execute on function rush.speed_dating_results(text) to authenticated, service_role;
