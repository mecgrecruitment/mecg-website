-- A Speed Dating claim owns two private assignment drafts, while final submit
-- remains a single transaction. The pair is the navigation and commit unit;
-- each applicant still receives an independent evaluation and score.

-- Convert only untouched, pre-event Speed Dating rubrics. Active and historic
-- rounds keep their original meaning and are blocked by rubricReady below.
do $$
declare
  target_rubric_id text;
begin
  for target_rubric_id in
    select rubric.id
    from rush.rounds round
    join lateral (
      select candidate.id
      from rush.rubrics candidate
      where candidate.round_id = round.id
      order by candidate.version desc
      limit 1
    ) rubric on true
    where round.kind = 'SPEED_DATING'
      and round.status in ('DRAFT', 'PUBLISHED')
      and not exists (select 1 from rush.evaluations evaluation where evaluation.rubric_id = rubric.id)
      and not exists (
        select 1 from rush.speed_dating_pair_claims claim
        join rush.speed_dating_pairs pair on pair.id = claim.pair_id
        where pair.round_id = round.id
      )
  loop
    delete from rush.rubric_criteria where rubric_id = target_rubric_id;
    update rush.rubrics set minimum_observed_criteria = 1 where id = target_rubric_id;
    insert into rush.rubric_criteria (rubric_id, key, name, description, weight, required, position)
    values (
      target_rubric_id,
      'overall',
      'Overall Speed Dating assessment',
      'Rate the full interaction: listening, clear communication, reasoning, collaboration, and judgment.',
      100,
      true,
      0
    );
  end loop;
end;
$$;

create or replace function rush.create_cycle(cycle_name text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := rush.actor_id();
  cycle_id text;
  speed_round_id text;
  case_round_id text;
  speed_rubric_id text;
  case_rubric_id text;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  if char_length(trim(cycle_name)) not between 1 and 120 then raise exception 'invalid cycle name' using errcode = '22023'; end if;
  if exists (select 1 from rush.rush_cycles where lower(name) = lower(trim(cycle_name))) then
    raise exception 'cycle exists' using errcode = '23505';
  end if;
  if not exists (
    select 1 from rush.memberships membership
    join rush.profiles profile on profile.id = membership.user_id
    where membership.user_id = actor and membership.active and membership.role = 'OWNER' and profile.active
  ) then raise exception 'forbidden' using errcode = '42501'; end if;

  insert into rush.rush_cycles (name) values (trim(cycle_name)) returning id into cycle_id;
  insert into rush.memberships (user_id, cycle_id, role) values (actor, cycle_id, 'OWNER');

  insert into rush.rounds (cycle_id, kind, name, weight)
  values (cycle_id, 'SPEED_DATING', 'Speed Dating', 40) returning id into speed_round_id;
  insert into rush.rubrics (round_id, version, minimum_observed_criteria)
  values (speed_round_id, 1, 1) returning id into speed_rubric_id;
  insert into rush.rubric_criteria (rubric_id, key, name, description, weight, required, position)
  values (speed_rubric_id, 'overall', 'Overall Speed Dating assessment',
          'Rate the full interaction: listening, clear communication, reasoning, collaboration, and judgment.',
          100, true, 0);

  insert into rush.rounds (cycle_id, kind, name, weight)
  values (cycle_id, 'GROUP_CASE', 'Group Case', 60) returning id into case_round_id;
  insert into rush.rubrics (round_id, version) values (case_round_id, 1) returning id into case_rubric_id;
  insert into rush.rubric_criteria (rubric_id, key, name, description, weight, required, position) values
    (case_rubric_id, 'framing', 'Problem framing and assumptions', 'Clarifies the objective, ambiguity, and assumptions.', 20, false, 0),
    (case_rubric_id, 'analysis', 'Analysis and evidence', 'Uses evidence and tests assumptions.', 20, false, 1),
    (case_rubric_id, 'collaboration', 'Collaboration and inclusion', 'Invites contributions and resolves disagreement constructively.', 25, true, 2),
    (case_rubric_id, 'communication', 'Communication and listening', 'Synthesizes clearly and keeps the group aligned.', 15, false, 3),
    (case_rubric_id, 'ownership', 'Ownership and reliability', 'Follows through without taking over.', 10, false, 4),
    (case_rubric_id, 'recommendation', 'Recommendation and judgment', 'Prioritizes actions, limitations, and next steps.', 10, false, 5);

  perform rush.seed_cycle_questions(cycle_id);
  insert into rush.audit_events (actor_id, cycle_id, action, resource, resource_id)
  values (actor, cycle_id, 'CYCLE_CREATED', 'RushCycle', cycle_id);
  return cycle_id;
end;
$$;

create or replace function rush.my_speed_dating_pairs(target_round_id text)
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
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  select * into round_row from rush.rounds where id = target_round_id;
  if round_row.id is null then raise exception 'round missing' using errcode = 'P0002'; end if;
  if round_row.kind <> 'SPEED_DATING'
     or not rush.has_cycle_role(round_row.cycle_id, array['MEMBER','BOARD','PANEL','OWNER']::rush.member_role[])
     or rush.is_active_screening_reviewer(round_row.cycle_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select rubric.id into active_rubric_id
  from rush.rubrics rubric
  where rubric.round_id = target_round_id
  order by rubric.version desc
  limit 1;

  return jsonb_build_object(
    'roundId', round_row.id,
    'roundName', round_row.name,
    'roundStatus', round_row.status::text,
    'calibrated', active_rubric_id is not null and exists (
      select 1 from rush.round_calibration_acknowledgements acknowledgement
      where acknowledgement.round_id = target_round_id
        and acknowledgement.rubric_id = active_rubric_id
        and acknowledgement.evaluator_id = actor
    ),
    'criterion', (
      select jsonb_build_object(
        'id', criterion.id,
        'name', criterion.name,
        'description', criterion.description
      )
      from rush.rubric_criteria criterion
      where criterion.rubric_id = active_rubric_id
      order by criterion.position
      limit 1
    ),
    'rubricReady', active_rubric_id is not null and (
      select count(*) = 1
        and max(criterion.weight) = 100
        and bool_and(criterion.required)
      from rush.rubric_criteria criterion
      where criterion.rubric_id = active_rubric_id
    ),
    'pairs', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pair.id,
        'label', pair.label,
        'claimed', claim.pair_id is not null,
        'submittedAt', claim.submitted_at,
        'members', members.items
      ) order by
        case when claim.submitted_at is null and claim.pair_id is not null then 0 else 1 end,
        pair.label
      )
      from rush.speed_dating_pairs pair
      left join rush.speed_dating_pair_claims claim
        on claim.pair_id = pair.id and claim.evaluator_id = actor
      cross join lateral (
        select jsonb_agg(jsonb_build_object(
          'applicationId', member.application_id,
          'name', pnm.name,
          'position', member.position,
          'assignmentId', assignment.id,
          'assignmentStatus', assignment.status::text
        ) order by member.position) as items
        from rush.speed_dating_pair_members member
        join rush.applications application on application.id = member.application_id
        join rush.pnms pnm on pnm.id = application.pnm_id
        left join rush.evaluation_assignments assignment
          on assignment.round_id = member.round_id
         and assignment.application_id = member.application_id
         and assignment.evaluator_id = actor
        where member.pair_id = pair.id
      ) members
      where pair.round_id = target_round_id
        and pair.status = 'PUBLISHED'
        and not exists (
          select 1
          from rush.speed_dating_pair_members member
          join rush.conflict_declarations conflict
            on conflict.application_id = member.application_id and conflict.declarer_id = actor
          where member.pair_id = pair.id
        )
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function rush.speed_dating_pair_setup(target_round_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := rush.actor_id();
  round_row rush.rounds%rowtype;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  select * into round_row from rush.rounds where id = target_round_id;
  if round_row.id is null then raise exception 'round missing' using errcode = 'P0002'; end if;
  if round_row.kind <> 'SPEED_DATING'
     or not rush.has_cycle_role(round_row.cycle_id, array['BOARD','OWNER']::rush.member_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'roundId', target_round_id,
    'roundStatus', round_row.status::text,
    'participants', coalesce((
      select jsonb_agg(jsonb_build_object('applicationId', application.id, 'name', pnm.name) order by pnm.name, application.id)
      from rush.round_participations participation
      join rush.applications application on application.id = participation.application_id
      join rush.pnms pnm on pnm.id = application.pnm_id
      where participation.round_id = target_round_id
    ), '[]'::jsonb),
    'pairs', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pair.id,
        'label', pair.label,
        'status', pair.status,
        'applicationIds', members.application_ids
      ) order by pair.label)
      from rush.speed_dating_pairs pair
      cross join lateral (
        select jsonb_agg(member.application_id order by member.position) application_ids
        from rush.speed_dating_pair_members member
        where member.pair_id = pair.id
      ) members
      where pair.round_id = target_round_id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function rush.claim_speed_dating_pair(target_pair_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := rush.actor_id();
  pair_row rush.speed_dating_pairs%rowtype;
  round_row rush.rounds%rowtype;
  created_count integer;
  member_count integer;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  select * into pair_row from rush.speed_dating_pairs where id = target_pair_id for update;
  if pair_row.id is null then raise exception 'pair missing' using errcode = 'P0002'; end if;
  select * into round_row from rush.rounds where id = pair_row.round_id for update;
  if pair_row.status <> 'PUBLISHED'
     or round_row.status <> 'ACTIVE'
     or (round_row.closes_at is not null and round_row.closes_at < now()) then
    raise exception 'pair is not open for grading' using errcode = '55000';
  end if;
  if not rush.has_cycle_role(round_row.cycle_id, array['MEMBER','BOARD','PANEL','OWNER']::rush.member_role[])
     or rush.is_active_screening_reviewer(round_row.cycle_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if exists (
    select 1
    from rush.speed_dating_pair_members member
    join rush.conflict_declarations conflict
      on conflict.application_id = member.application_id and conflict.declarer_id = actor
    where member.pair_id = pair_row.id
  ) then
    raise exception 'conflict declared' using errcode = '42501';
  end if;
  select count(*) into member_count
  from rush.speed_dating_pair_members member
  where member.pair_id = pair_row.id;
  if member_count <> 2 then raise exception 'pair must contain two applicants' using errcode = '55000'; end if;

  insert into rush.speed_dating_pair_claims (pair_id, evaluator_id)
  values (pair_row.id, actor)
  on conflict (pair_id, evaluator_id) do nothing;
  get diagnostics created_count = row_count;

  insert into rush.evaluation_assignments (round_id, application_id, evaluator_id)
  select member.round_id, member.application_id, actor
  from rush.speed_dating_pair_members member
  where member.pair_id = pair_row.id
  on conflict (round_id, application_id, evaluator_id) do nothing;

  if (
    select count(*)
    from rush.speed_dating_pair_members member
    join rush.evaluation_assignments assignment
      on assignment.round_id = member.round_id
     and assignment.application_id = member.application_id
     and assignment.evaluator_id = actor
    where member.pair_id = pair_row.id
      and assignment.status in ('ASSIGNED', 'IN_PROGRESS')
      and not exists (
        select 1 from rush.evaluations evaluation
        where evaluation.assignment_id = assignment.id
          and evaluation.status in ('SUBMITTED', 'LOCKED')
      )
  ) <> 2 then
    raise exception 'pair assignments unavailable' using errcode = '55000';
  end if;

  if created_count = 1 then
    insert into rush.audit_events (actor_id, cycle_id, action, resource, resource_id)
    values (actor, round_row.cycle_id, 'SPEED_DATING_PAIR_CLAIMED', 'SpeedDatingPair', pair_row.id);
  end if;

  return jsonb_build_object('pairId', pair_row.id, 'claimed', true);
end;
$$;

create or replace function rush.submit_speed_dating_pair(target_pair_id text, submitted_members jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := rush.actor_id();
  pair_row rush.speed_dating_pairs%rowtype;
  round_row rush.rounds%rowtype;
  criterion_row rush.rubric_criteria%rowtype;
  entry jsonb;
  assignment_id text;
  submitted_ids jsonb := '[]'::jsonb;
  submission record;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  if jsonb_typeof(submitted_members) <> 'array'
     or jsonb_array_length(submitted_members) <> 2
     or (select count(distinct item->>'applicationId') from jsonb_array_elements(submitted_members) item) <> 2 then
    raise exception 'submit exactly two applicants' using errcode = '22023';
  end if;

  select * into pair_row from rush.speed_dating_pairs where id = target_pair_id for update;
  if pair_row.id is null then raise exception 'pair missing' using errcode = 'P0002'; end if;
  select * into round_row from rush.rounds where id = pair_row.round_id for update;
  if pair_row.status <> 'PUBLISHED'
     or round_row.status <> 'ACTIVE'
     or (round_row.closes_at is not null and round_row.closes_at < now()) then
    raise exception 'pair is not open for grading' using errcode = '55000';
  end if;
  if not exists (
    select 1 from rush.speed_dating_pair_claims claim
    where claim.pair_id = target_pair_id and claim.evaluator_id = actor and claim.submitted_at is null
  ) then raise exception 'claim the pair before submitting' using errcode = '55000'; end if;
  if not exists (
    select 1
    from rush.rubrics rubric
    join rush.round_calibration_acknowledgements acknowledgement
      on acknowledgement.round_id = pair_row.round_id
     and acknowledgement.rubric_id = rubric.id
     and acknowledgement.evaluator_id = actor
    where rubric.id = (select id from rush.rubrics where round_id = pair_row.round_id order by version desc limit 1)
  ) then raise exception 'calibration required' using errcode = '55000'; end if;
  if exists (
    select 1 from rush.speed_dating_pair_members member
    join rush.conflict_declarations conflict
      on conflict.application_id = member.application_id and conflict.declarer_id = actor
    where member.pair_id = target_pair_id
  ) then raise exception 'conflict declared' using errcode = '42501'; end if;

  select criterion.* into criterion_row
  from rush.rubrics rubric
  join rush.rubric_criteria criterion on criterion.rubric_id = rubric.id
  where rubric.round_id = pair_row.round_id
    and rubric.id = (select id from rush.rubrics where round_id = pair_row.round_id order by version desc limit 1)
  order by criterion.position
  limit 1;
  if criterion_row.id is null
     or criterion_row.weight <> 100
     or not criterion_row.required
     or (select count(*) from rush.rubric_criteria where rubric_id = criterion_row.rubric_id) <> 1 then
    raise exception 'Speed Dating needs one required 100 percent criterion' using errcode = '55000';
  end if;

  if exists (
    select 1 from jsonb_array_elements(submitted_members) item
    where jsonb_typeof(item) <> 'object'
       or not exists (
         select 1 from rush.speed_dating_pair_members member
         where member.pair_id = target_pair_id and member.application_id = item->>'applicationId'
       )
       or coalesce(item->>'score', '') !~ '^[1-5]$'
       or char_length(coalesce(item->>'note', '')) > 2000
       or ((item->>'score') in ('1', '2', '5') and trim(coalesce(item->>'note', '')) = '')
  ) then raise exception 'invalid pair ratings' using errcode = '22023'; end if;

  for entry in select value from jsonb_array_elements(submitted_members)
  loop
    select assignment.id into assignment_id
    from rush.evaluation_assignments assignment
    where assignment.round_id = pair_row.round_id
      and assignment.application_id = entry->>'applicationId'
      and assignment.evaluator_id = actor
    for update;
    if assignment_id is null then raise exception 'pair assignment missing' using errcode = '55000'; end if;

    select * into submission from rush.submit_evaluation(
      assignment_id,
      jsonb_build_array(jsonb_build_object(
        'criterionId', criterion_row.id,
        'score', (entry->>'score')::integer,
        'note', coalesce(entry->>'note', '')
      )),
      null
    );
    submitted_ids := submitted_ids || jsonb_build_array(submission.evaluation_id);
  end loop;

  update rush.speed_dating_pair_claims
  set submitted_at = now()
  where pair_id = target_pair_id and evaluator_id = actor;

  insert into rush.audit_events (actor_id, cycle_id, action, resource, resource_id, metadata)
  values (actor, round_row.cycle_id, 'SPEED_DATING_PAIR_SUBMITTED', 'SpeedDatingPair', target_pair_id,
          jsonb_build_object('evaluationIds', submitted_ids));

  return jsonb_build_object('pairId', target_pair_id, 'submitted', true, 'evaluationIds', submitted_ids);
end;
$$;

revoke all on function rush.submit_speed_dating_pair(text, jsonb) from public, anon;
revoke all on function rush.speed_dating_pair_setup(text) from public, anon;
grant execute on function rush.submit_speed_dating_pair(text, jsonb) to authenticated, service_role;
grant execute on function rush.speed_dating_pair_setup(text) to authenticated, service_role;
