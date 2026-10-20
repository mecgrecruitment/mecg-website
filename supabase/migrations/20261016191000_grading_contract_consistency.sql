-- Keep saved inline observations distinct from valid evaluations. Existing defaults:
-- required criteria, rubric minimum, 75% observed weight and two independent graders.
-- No observation rows, scores, rubric weights or Board decision authority are changed.

create or replace function rush.evaluation_observation_quality(target_evaluation_id text)
returns table (coverage numeric, observed_count integer, criteria_count integer,
  minimum_observed integer, missing_required text[], valid boolean, weighted numeric)
language sql stable security definer set search_path = ''
as $$
  with evidence as (
    select rubric.minimum_observed_criteria,
      count(criterion.id)::integer criteria_count,
      count(rating.score)::integer observed_count,
      coalesce((sum(criterion.weight) filter (where rating.score is not null))::numeric
        / nullif(sum(criterion.weight), 0), 0) coverage,
      coalesce(array_agg(criterion.name order by criterion.position, criterion.id)
        filter (where criterion.required and rating.score is null), '{}'::text[]) missing_required,
      8 * sum(criterion.weight * rating.score)::numeric
        / nullif(sum(criterion.weight) filter (where rating.score is not null), 0) weighted
    from rush.evaluations evaluation
    join rush.rubrics rubric on rubric.id = evaluation.rubric_id
    left join rush.rubric_criteria criterion on criterion.rubric_id = rubric.id
    left join rush.criterion_ratings rating on rating.evaluation_id = evaluation.id
      and rating.criterion_id = criterion.id
    where evaluation.id = target_evaluation_id
    group by rubric.minimum_observed_criteria
  )
  select evidence.coverage, evidence.observed_count, evidence.criteria_count,
    evidence.minimum_observed_criteria, evidence.missing_required,
    evidence.coverage >= 0.75 and evidence.observed_count >= evidence.minimum_observed_criteria
      and cardinality(evidence.missing_required) = 0 valid,
    case when evidence.coverage >= 0.75 and evidence.observed_count >= evidence.minimum_observed_criteria
      and cardinality(evidence.missing_required) = 0 then evidence.weighted end weighted
  from evidence;
$$;
-- Internal evidence helper; guarded RPCs are the public surface.
revoke all on function rush.evaluation_observation_quality(text) from public, anon, authenticated;


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
  if round_row.status <> 'ACTIVE' or (round_row.closes_at is not null and round_row.closes_at < now()) then
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
      and application.status not in ('DRAFT', 'WITHDRAWN')
    for share of application
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
  if clean_score is null or clean_score not between 1 and 5 then
    raise exception 'score must be 1 to 5' using errcode = '22023';
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


create or replace function rush.rate_group_case_applicant(
  target_round_id text,
  target_application_id text,
  scores jsonb,
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
  assignment_row rush.evaluation_assignments%rowtype;
  evaluation_row rush.evaluations%rowtype;
  clean_note text := left(nullif(trim(note), ''), 4000);
  saved_at timestamptz := now();
  scored_count integer;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  select * into round_row from rush.rounds where id = target_round_id for share;
  if round_row.id is null then raise exception 'round missing' using errcode = 'P0002'; end if;
  if round_row.kind <> 'GROUP_CASE' then
    raise exception 'not a Group Case round' using errcode = '55000';
  end if;
  if round_row.status <> 'ACTIVE' or (round_row.closes_at is not null and round_row.closes_at < now()) then
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
      and application.status not in ('DRAFT', 'WITHDRAWN')
    for share of application
  ) then
    raise exception 'applicant is not in this round' using errcode = '22023';
  end if;
  if exists (
    select 1 from rush.conflict_declarations conflict
    where conflict.declarer_id = actor and conflict.application_id = target_application_id
  ) then raise exception 'conflict declared' using errcode = '42501'; end if;

  select rubric.id into active_rubric_id
  from rush.rubrics rubric
  where rubric.round_id = target_round_id
  order by rubric.version desc
  limit 1;
  if active_rubric_id is null then raise exception 'rubric missing' using errcode = '55000'; end if;

  if scores is null or jsonb_typeof(scores) <> 'object' then
    raise exception 'scores must be an object of criterionId to score' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_each(scores) entry
    where not exists (
      select 1 from rush.rubric_criteria criterion
      where criterion.rubric_id = active_rubric_id and criterion.id = entry.key
    )
  ) then
    raise exception 'unknown criterion' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_each(scores) entry
    where entry.value <> 'null'::jsonb and (jsonb_typeof(entry.value) <> 'number' or (entry.value#>>'{}') !~ '^[1-5]$')
  ) then
    raise exception 'scores must be 1 through 5 or null' using errcode = '22023';
  end if;
  select count(*) into scored_count from jsonb_each(scores) entry where entry.value <> 'null'::jsonb;
  -- Clearing the last star on an applicant already graded is a valid save;
  -- an empty first save is not.
  if scored_count = 0 and clean_note is null and not exists (
    select 1
    from rush.evaluations evaluation
    join rush.evaluation_assignments assignment on assignment.id = evaluation.assignment_id
    where assignment.round_id = target_round_id
      and assignment.application_id = target_application_id
      and assignment.evaluator_id = actor
      and evaluation.voided_at is null
  ) then
    raise exception 'pick at least one star' using errcode = '22023';
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
    insert into rush.evaluations (assignment_id, evaluator_id, rubric_id, version, status, evidence, submitted_at)
    values (
      assignment_row.id,
      actor,
      active_rubric_id,
      (select coalesce(max(version), 0) + 1 from rush.evaluations where assignment_id = assignment_row.id),
      'SUBMITTED',
      clean_note,
      saved_at
    )
    returning * into evaluation_row;
  elsif evaluation_row.status in ('DRAFT', 'SUBMITTED') then
    update rush.evaluations evaluation
    set status = 'SUBMITTED',
        evidence = clean_note,
        submitted_at = coalesce(evaluation.submitted_at, saved_at),
        updated_at = saved_at
    where evaluation.id = evaluation_row.id
    returning * into evaluation_row;
  else
    raise exception 'round is frozen' using errcode = '55000';
  end if;

  insert into rush.criterion_ratings (evaluation_id, criterion_id, score, note)
  select evaluation_row.id, entry.key, nullif(entry.value#>>'{}', 'null')::integer, null
  from jsonb_each(scores) entry
  on conflict (evaluation_id, criterion_id) do update
    set score = excluded.score;

  update rush.evaluation_assignments
  set status = 'SUBMITTED'
  where id = assignment_row.id and status <> 'SUBMITTED';

  insert into rush.audit_events (actor_id, cycle_id, action, resource, resource_id, metadata)
  values (actor, round_row.cycle_id, 'GROUP_CASE_RATED', 'Application', target_application_id,
          jsonb_build_object('roundId', target_round_id, 'scored', scored_count, 'hasNote', clean_note is not null));

  return jsonb_build_object(
    'applicationId', target_application_id,
    'scores', coalesce((
      select jsonb_object_agg(rating.criterion_id, rating.score)
      from rush.criterion_ratings rating
      where rating.evaluation_id = evaluation_row.id
    ), '{}'::jsonb),
    'note', coalesce(clean_note, ''),
    'savedAt', evaluation_row.updated_at
  );
end;
$$;


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
    select criterion.id, criterion.key, criterion.name, criterion.weight, criterion.position, criterion.required
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
      and not exists (select 1 from rush.conflict_declarations conflict
        where conflict.application_id = application.id and conflict.declarer_id = actor)
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
      select evaluation.id, evaluation.submitted_at, evaluation.updated_at, evaluation.evidence, evaluation.status, evaluation.rubric_id
      from rush.evaluations evaluation
      where evaluation.assignment_id = assignment.id
        and evaluation.voided_at is null
      order by evaluation.version desc
      limit 1
    ) evaluation on true
    where evaluation.status in ('SUBMITTED', 'LOCKED') and evaluation.rubric_id = active_rubric_id
      and not exists (select 1 from rush.conflict_declarations conflict
      where conflict.application_id = applicant.id and conflict.declarer_id = assignment.evaluator_id)
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
      quality.weighted,
      quality.valid,
      quality.coverage,
      quality.minimum_observed,
      quality.missing_required,
      count(rated.score)::integer scored_count,
      count(*)::integer criteria_count,
      jsonb_object_agg(rated.criterion_id, rated.score) scores
    from evaluated
    join rated on rated.evaluation_id = evaluated.evaluation_id
    cross join lateral rush.evaluation_observation_quality(evaluated.evaluation_id) quality
    group by evaluated.application_id, evaluated.evaluator_id, evaluated.evaluator_name, evaluated.evaluation_id,
      evaluated.submitted_at, evaluated.updated_at, evaluated.note, quality.weighted, quality.valid,
      quality.coverage, quality.minimum_observed, quality.missing_required
    -- Keep notes and partial scores as saved evidence; neither implies a valid evaluation.
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
      count(*) filter (where valid)::integer evaluation_count,
      count(*)::integer saved_count,
      case when count(distinct evaluator_id) filter (where valid) >= 2
        then round(avg(weighted) filter (where valid), 1) end mean,
      case when count(distinct evaluator_id) filter (where valid) < 2 then 'PENDING'
        when (max(weighted) filter (where valid) - min(weighted) filter (where valid)) * 100 / 32 >= 25 then 'REVIEW'
        else 'COMPLETE' end completion_status,
      jsonb_agg(jsonb_build_object(
        'evaluatorId', evaluator_id,
        'evaluatorName', evaluator_name,
        'weighted', round(weighted, 1),
        'valid', valid,
        'coverage', coverage,
        'minimumObserved', minimum_observed,
        'missingRequired', to_jsonb(missing_required),
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
      count(*) filter (where valid)::integer evaluation_count,
      count(*)::integer saved_count,
      round(avg(weighted) filter (where valid), 1) mean,
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
      coalesce(stats.saved_count, 0) saved_count,
      coalesce(stats.completion_status, 'PENDING') completion_status,
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
        'weight', criterion.weight, 'position', criterion.position, 'required', criterion.required
      ) order by criterion.position, criterion.id)
      from criterion
    ), '[]'::jsonb),
    'summary', (
      select jsonb_build_object(
        'applicants', count(*),
        'graded', count(*) filter (where evaluation_count >= 2),
        'saved', count(*) filter (where saved_count > 0),
        'savedEvaluations', coalesce(sum(saved_count), 0),
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
        'savedCount', saved_count,
        'completionStatus', completion_status,
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
        'savedCount', saved_count,
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


-- A frozen partial observation is still partial; decision readiness uses the same gate.
create or replace function rush.is_decision_ready(target_application_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from rush.applications a
    join rush.rounds r on r.cycle_id = a.cycle_id and r.weight > 0
    where a.id = target_application_id and a.status not in ('DRAFT', 'WITHDRAWN')
  ) and not exists (
    select 1
    from rush.applications a
    join rush.rounds r on r.cycle_id = a.cycle_id and r.weight > 0
    where a.id = target_application_id
      and (
        r.status not in ('FROZEN', 'FINALIZED')
        or (
          select count(distinct ea.evaluator_id)
          from rush.evaluation_assignments ea
          join lateral (
            select evaluation.* from rush.evaluations evaluation
            where evaluation.assignment_id = ea.id and evaluation.voided_at is null
            order by evaluation.version desc limit 1
          ) e on true
          join rush.rubrics rubric on rubric.id = e.rubric_id and rubric.round_id = r.id
            and rubric.id = (select active.id from rush.rubrics active where active.round_id = r.id order by active.version desc limit 1)
          cross join lateral rush.evaluation_observation_quality(e.id) quality
          where ea.round_id = r.id
            and ea.application_id = a.id
            and e.status = 'LOCKED' and quality.valid
            and not exists (select 1 from rush.conflict_declarations conflict
              where conflict.application_id = a.id and conflict.declarer_id = ea.evaluator_id)
        ) < 2
      )
  );
$$;

-- The legacy assignment form must enforce the same application eligibility as inline saves.
create or replace function rush.submit_evaluation(target_assignment_id text, submitted_ratings jsonb, submitted_evidence text default null)
returns table (evaluation_id text, score numeric)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := rush.actor_id();
  assignment_row rush.evaluation_assignments%rowtype;
  round_row rush.rounds%rowtype;
  v_rubric_id text;
  expected_count integer;
  received_count integer;
  minimum_observed integer;
  observed_count integer;
  total_weight numeric;
  observed_weight numeric;
  weighted_score numeric;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  if jsonb_typeof(submitted_ratings) <> 'array' then raise exception 'ratings must be an array' using errcode = '22023'; end if;
  select * into assignment_row from rush.evaluation_assignments where id = target_assignment_id for update;
  if assignment_row.id is null or assignment_row.evaluator_id <> actor then raise exception 'assignment not found' using errcode = 'P0002'; end if;
  select * into round_row from rush.rounds where id = assignment_row.round_id for share;
  if assignment_row.status <> 'ASSIGNED' or round_row.status <> 'ACTIVE' or (round_row.closes_at is not null and round_row.closes_at < now()) then
    raise exception 'assignment closed' using errcode = '55000';
  end if;
  if not exists (
    select 1 from rush.applications application
    where application.id = assignment_row.application_id
      and application.cycle_id = round_row.cycle_id
      and application.status not in ('DRAFT', 'WITHDRAWN')
    for share of application
  ) then
    raise exception 'applicant is not eligible for evaluation' using errcode = '22023';
  end if;
  if not rush.has_cycle_role(round_row.cycle_id, array['MEMBER','BOARD','PANEL','OWNER']::rush.member_role[]) then
    raise exception 'role revoked' using errcode = '42501';
  end if;
  if exists (select 1 from rush.conflict_declarations where application_id = assignment_row.application_id and declarer_id = actor) then
    raise exception 'conflict declared' using errcode = '42501';
  end if;
  if exists (select 1 from rush.evaluations where assignment_id = target_assignment_id and status in ('SUBMITTED','LOCKED')) then
    raise exception 'already submitted' using errcode = '23505';
  end if;
  select id, minimum_observed_criteria into v_rubric_id, minimum_observed
  from rush.rubrics where round_id = round_row.id order by version desc limit 1;
  if v_rubric_id is null then raise exception 'rubric missing' using errcode = '55000'; end if;

  with input as (
    select x->>'criterionId' criterion_id
    from jsonb_array_elements(submitted_ratings) x
  )
  select count(*), count(distinct criterion_id) into received_count, expected_count from input;
  select count(*) into expected_count from rush.rubric_criteria where rubric_id = v_rubric_id;
  if received_count <> expected_count or exists (
    select 1 from jsonb_array_elements(submitted_ratings) x
    where not exists (select 1 from rush.rubric_criteria c where c.rubric_id = v_rubric_id and c.id = x->>'criterionId')
  ) or (select count(distinct x->>'criterionId') from jsonb_array_elements(submitted_ratings) x) <> expected_count then
    raise exception 'every criterion must appear exactly once' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(submitted_ratings) x where x->'score' <> 'null'::jsonb and ((x->>'score') !~ '^[1-5]$')) then
    raise exception 'scores must be 1 through 5 or null' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(submitted_ratings) x where (x->>'score') in ('1','2','5') and trim(coalesce(x->>'note','')) = '') then
    raise exception 'extreme scores require notes' using errcode = '22023';
  end if;
  with input as (
    select x->>'criterionId' criterion_id, nullif(x->>'score','')::integer score_value
    from jsonb_array_elements(submitted_ratings) x
  )
  select sum(c.weight),
    sum(c.weight) filter (where i.score_value is not null),
    count(*) filter (where i.score_value is not null),
    100 * sum(c.weight * ((i.score_value - 1)::numeric / 4)) filter (where i.score_value is not null)
      / nullif(sum(c.weight) filter (where i.score_value is not null), 0)
  into total_weight, observed_weight, observed_count, weighted_score
  from rush.rubric_criteria c join input i on i.criterion_id = c.id where c.rubric_id = v_rubric_id;
  if observed_count < minimum_observed or observed_weight / total_weight < 0.75 or exists (
    select 1 from rush.rubric_criteria c join jsonb_array_elements(submitted_ratings) x on x->>'criterionId' = c.id
    where c.rubric_id = v_rubric_id and c.required and coalesce(x->'score', 'null'::jsonb) = 'null'::jsonb
  ) then raise exception 'required criteria or observation coverage missing' using errcode = '22023'; end if;

  insert into rush.evaluations (assignment_id, evaluator_id, rubric_id, status, evidence, submitted_at)
  values (target_assignment_id, actor, v_rubric_id, 'SUBMITTED', left(nullif(trim(submitted_evidence),''), 4000), now())
  returning id into evaluation_id;
  insert into rush.criterion_ratings (evaluation_id, criterion_id, score, note)
  select evaluation_id, x->>'criterionId', nullif(x->>'score','')::integer, left(nullif(trim(x->>'note'),''), 2000)
  from jsonb_array_elements(submitted_ratings) x;
  update rush.evaluation_assignments set status = 'SUBMITTED' where id = target_assignment_id;
  insert into rush.audit_events (actor_id, cycle_id, action, resource, resource_id)
  values (actor, round_row.cycle_id, 'EVALUATION_SUBMITTED', 'Evaluation', evaluation_id);
  score := weighted_score;
  return next;
end;
$$;
