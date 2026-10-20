-- Add the canonical quality of only the requesting evaluator's own evidence.
-- Existing authorization, filtering, locking, writes and grading rules are unchanged.
-- No public helper or evaluator-id input is introduced.

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
    'savedAt', evaluation_row.updated_at,
    'quality', (select jsonb_build_object(
      'valid', quality.valid, 'coverage', quality.coverage,
      'observedCount', quality.observed_count, 'criteriaCount', quality.criteria_count,
      'minimumObserved', quality.minimum_observed, 'missingRequired', to_jsonb(quality.missing_required)
    ) from rush.evaluation_observation_quality(evaluation_row.id) quality)
  );
end;
$$;

create or replace function rush.group_case_roster(target_round_id text)
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
  can_see_speed_dating boolean;
  sd_round_id text;
  sd_scores jsonb := '{}'::jsonb;
  criteria jsonb;
  group_items jsonb;
  total_count integer;
  scored_count integer;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  select * into round_row from rush.rounds where id = target_round_id;
  if round_row.id is null then raise exception 'round missing' using errcode = 'P0002'; end if;
  if round_row.kind <> 'GROUP_CASE' then
    raise exception 'not a Group Case round' using errcode = '55000';
  end if;
  if not rush.has_cycle_role(round_row.cycle_id, array['MEMBER','BOARD','PANEL','OWNER']::rush.member_role[])
     or rush.is_active_screening_reviewer(round_row.cycle_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select rubric.id into active_rubric_id
  from rush.rubrics rubric where rubric.round_id = target_round_id
  order by rubric.version desc limit 1;
  criteria := coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', criterion.id, 'name', criterion.name, 'description', criterion.description,
      'weight', criterion.weight, 'required', criterion.required
    ) order by criterion.position, criterion.id)
    from rush.rubric_criteria criterion where criterion.rubric_id = active_rubric_id
  ), '[]'::jsonb);

  can_see_speed_dating := rush.has_cycle_role(round_row.cycle_id, array['BOARD','PANEL','OWNER']::rush.member_role[]);
  if can_see_speed_dating then
    select id into sd_round_id
    from rush.rounds
    where cycle_id = round_row.cycle_id and kind = 'SPEED_DATING'
    order by created_at desc
    limit 1;
    if sd_round_id is not null then
      select coalesce(jsonb_object_agg(
        item->>'applicationId',
        jsonb_build_object('adjusted', item->'adjusted', 'mean', item->'mean', 'count', item->'count')
      ), '{}'::jsonb) into sd_scores
      from jsonb_array_elements(rush.speed_dating_results(sd_round_id)->'applicants') item;
    end if;
  end if;

  group_items := coalesce((
    with row_data as (
      select
        application.id application_id,
        pnm.name,
        case_group.id group_id,
        coalesce(case_group.name, 'Not in a group') group_name,
        coalesce((
          select jsonb_object_agg(rating.criterion_id, rating.score)
          from rush.criterion_ratings rating
          where rating.evaluation_id = evaluation.id
        ), '{}'::jsonb) scores,
        coalesce(evaluation.evidence, '') note,
        evaluation.updated_at saved_at,
        case when evaluation.rubric_id = active_rubric_id then (select jsonb_build_object(
      'valid', quality.valid, 'coverage', quality.coverage,
      'observedCount', quality.observed_count, 'criteriaCount', quality.criteria_count,
      'minimumObserved', quality.minimum_observed, 'missingRequired', to_jsonb(quality.missing_required)
    ) from rush.evaluation_observation_quality(evaluation.id) quality) end quality
      from rush.round_participations participation
      join rush.applications application on application.id = participation.application_id
      join rush.pnms pnm on pnm.id = application.pnm_id
      left join rush.case_group_members membership on membership.application_id = application.id
      left join rush.case_groups case_group
        on case_group.id = membership.group_id and case_group.cycle_id = round_row.cycle_id
      left join rush.evaluation_assignments mine
        on mine.round_id = target_round_id
       and mine.application_id = application.id
       and mine.evaluator_id = actor
      left join lateral (
        select * from rush.evaluations evaluation
        where evaluation.assignment_id = mine.id and evaluation.voided_at is null
        order by evaluation.version desc limit 1
      ) evaluation on true
      where participation.round_id = target_round_id
        and application.status not in ('DRAFT', 'WITHDRAWN')
        and not exists (
          select 1 from rush.conflict_declarations conflict
          where conflict.application_id = application.id and conflict.declarer_id = actor
        )
    )
    select jsonb_agg(jsonb_build_object(
      'groupId', grouped.group_id,
      'groupName', grouped.group_name,
      'applicants', grouped.applicants
    ) order by grouped.group_id is null, grouped.group_name, grouped.group_id)
    from (
      select
        row_data.group_id,
        row_data.group_name,
        jsonb_agg(jsonb_build_object(
          'applicationId', row_data.application_id,
          'name', row_data.name,
          'scores', row_data.scores,
          'note', row_data.note,
          'savedAt', row_data.saved_at,
          'quality', row_data.quality,
          'speedDating', case when can_see_speed_dating then sd_scores->row_data.application_id end
        ) order by row_data.name, row_data.application_id) applicants
      from row_data
      group by row_data.group_id, row_data.group_name
    ) grouped
  ), '[]'::jsonb);

  select count(*), count(*) filter (where exists (
    select 1 from jsonb_each(applicant->'scores') entry where entry.value <> 'null'::jsonb
  )) into total_count, scored_count
  from jsonb_array_elements(group_items) case_group, jsonb_array_elements(case_group->'applicants') applicant;

  return jsonb_build_object(
    'roundId', round_row.id,
    'roundName', round_row.name,
    'roundStatus', round_row.status::text,
    'canSeeSpeedDating', can_see_speed_dating,
    'criteria', criteria,
    'progress', jsonb_build_object('scored', scored_count, 'total', total_count),
    'groups', group_items
  );
end;
$$;
