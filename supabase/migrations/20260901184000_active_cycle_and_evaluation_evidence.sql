-- A cycle selected by recency could hide an older live cycle, and concurrent
-- writers could both create non-terminal cycles. The partial unique index is
-- the database serialization point. It rejects concurrent inserts even when
-- both transactions checked for an active cycle before writing.
do $$
begin
  if (
    select count(*)
    from rush.rush_cycles
    where status in ('DRAFT', 'OPEN', 'IN_PROCESS', 'DECISION_LOCK')
  ) > 1 then
    raise exception 'multiple non-terminal recruitment cycles exist; close or archive all but one before applying this migration'
      using errcode = '23505';
  end if;
end;
$$;
create unique index rush_cycles_one_non_terminal_idx
  on rush.rush_cycles ((true))
  where status in ('DRAFT', 'OPEN', 'IN_PROCESS', 'DECISION_LOCK');
-- Weight coverage and observed-criterion count answer different questions.
-- Keep both rules on the rubric version so past evaluations retain the rule
-- under which they were submitted.
alter table rush.rubrics
  add column minimum_observed_criteria integer not null default 3
  check (minimum_observed_criteria between 1 and 20);
update rush.rubrics rubric
set minimum_observed_criteria = greatest(1, least(3, (
  select count(*)::integer
  from rush.rubric_criteria criterion
  where criterion.rubric_id = rubric.id
)));
create or replace function rush.set_rubric_criteria(target_round_id text, criteria jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  v_cycle_id text;
  v_round_status rush.round_status;
  latest_rubric_id text;
  latest_version integer;
  target_rubric_id text;
  entry jsonb;
  position_index integer := 0;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;

  select r.cycle_id, r.status into v_cycle_id, v_round_status
  from rush.rounds r where r.id = target_round_id;
  if v_cycle_id is null then raise exception 'round missing' using errcode = 'P0002'; end if;
  if not rush.has_cycle_role(v_cycle_id, array['BOARD','OWNER']::rush.member_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_round_status not in ('DRAFT', 'PUBLISHED') then
    raise exception 'round is already under way' using errcode = '55000';
  end if;

  if jsonb_typeof(criteria) <> 'array' then raise exception 'invalid criteria' using errcode = '22023'; end if;
  if jsonb_array_length(criteria) < 1 then raise exception 'a rubric needs at least one criterion' using errcode = '22023'; end if;
  if jsonb_array_length(criteria) > 20 then raise exception 'too many criteria' using errcode = '22023'; end if;

  for entry in select value from jsonb_array_elements(criteria) loop
    if jsonb_typeof(entry) <> 'object' then raise exception 'invalid criterion' using errcode = '22023'; end if;
    if coalesce(entry->>'key','') !~ '^[a-z][a-z0-9_]*$' or char_length(entry->>'key') > 80 then
      raise exception 'invalid criterion key' using errcode = '22023';
    end if;
    if char_length(trim(coalesce(entry->>'name',''))) not between 1 and 120 then
      raise exception 'invalid criterion name' using errcode = '22023';
    end if;
    if char_length(coalesce(entry->>'description','')) > 2000 then
      raise exception 'invalid criterion description' using errcode = '22023';
    end if;
    if coalesce((entry->>'weight')::integer, 0) not between 1 and 100 then
      raise exception 'invalid criterion weight' using errcode = '22023';
    end if;
  end loop;

  if (select count(distinct elem->>'key') from jsonb_array_elements(criteria) elem)
     <> jsonb_array_length(criteria) then
    raise exception 'duplicate criterion key' using errcode = '23505';
  end if;

  select b.id, b.version into latest_rubric_id, latest_version
  from rush.rubrics b where b.round_id = target_round_id order by b.version desc limit 1;

  if latest_rubric_id is null then
    insert into rush.rubrics (round_id, version, minimum_observed_criteria)
    values (target_round_id, 1, least(3, jsonb_array_length(criteria)))
    returning id into target_rubric_id;
  elsif exists (select 1 from rush.evaluations e where e.rubric_id = latest_rubric_id) then
    insert into rush.rubrics (round_id, version, minimum_observed_criteria)
    values (target_round_id, latest_version + 1, least(3, jsonb_array_length(criteria)))
    returning id into target_rubric_id;
  else
    target_rubric_id := latest_rubric_id;
    update rush.rubrics
    set minimum_observed_criteria = least(3, jsonb_array_length(criteria))
    where id = target_rubric_id;
    delete from rush.rubric_criteria where rubric_id = target_rubric_id;
  end if;

  for entry in select value from jsonb_array_elements(criteria) loop
    insert into rush.rubric_criteria (rubric_id, key, name, description, weight, required, position)
    values (
      target_rubric_id,
      entry->>'key',
      trim(entry->>'name'),
      coalesce(entry->>'description', ''),
      (entry->>'weight')::integer,
      coalesce((entry->>'required')::boolean, false),
      position_index
    );
    position_index := position_index + 1;
  end loop;

  insert into rush.audit_events (actor_id, cycle_id, action, resource, resource_id, metadata)
  values (actor, v_cycle_id, 'RUBRIC_CRITERIA_SET', 'Rubric', target_rubric_id,
          jsonb_build_object('roundId', target_round_id, 'count', position_index));
  return target_rubric_id;
end;
$$;
create or replace function rush.cycle_rubrics(target_cycle_id text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when not rush.has_cycle_role(target_cycle_id, array['BOARD','OWNER']::rush.member_role[]) then '[]'::jsonb
    else coalesce((
      select jsonb_agg(jsonb_build_object(
        'roundId', r.id,
        'roundName', r.name,
        'roundStatus', r.status,
        'rubricVersion', b.version,
        'minimumObservedCriteria', b.minimum_observed_criteria,
        'criteria', coalesce((
          select jsonb_agg(jsonb_build_object(
            'key', c.key,
            'name', c.name,
            'description', c.description,
            'weight', c.weight,
            'required', c.required
          ) order by c.position)
          from rush.rubric_criteria c where c.rubric_id = b.id
        ), '[]'::jsonb)
      ) order by r.name)
      from rush.rounds r
      left join lateral (
        select b2.id, b2.version, b2.minimum_observed_criteria from rush.rubrics b2
        where b2.round_id = r.id order by b2.version desc limit 1
      ) b on true
      where r.cycle_id = target_cycle_id
    ), '[]'::jsonb)
  end;
$$;
create or replace function rush.submit_evaluation(target_assignment_id text, submitted_ratings jsonb, submitted_evidence text default null)
returns table (evaluation_id text, score numeric)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
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
  select * into round_row from rush.rounds where id = assignment_row.round_id for update;
  if assignment_row.status <> 'ASSIGNED' or round_row.status <> 'ACTIVE' or (round_row.closes_at is not null and round_row.closes_at < now()) then
    raise exception 'assignment closed' using errcode = '55000';
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
-- Cloning must copy the evidence rule with the rubric content. Defaulting a
-- clone to a different minimum would change the meaning of the copied rubric.
create or replace function rush.clone_cycle(source_cycle_id text, cycle_name text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  new_cycle_id text;
  round_row record;
  new_round_id text;
  source_rubric_id text;
  source_minimum_observed integer;
  new_rubric_id text;
  rounds_copied integer := 0;
  questions_copied integer := 0;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  if char_length(trim(cycle_name)) not between 1 and 120 then
    raise exception 'invalid cycle name' using errcode = '22023';
  end if;
  if exists (select 1 from rush.rush_cycles where lower(name) = lower(trim(cycle_name))) then
    raise exception 'cycle exists' using errcode = '23505';
  end if;
  if not exists (select 1 from rush.rush_cycles where id = source_cycle_id) then
    raise exception 'source cycle missing' using errcode = 'P0002';
  end if;
  if not exists (
    select 1
    from rush.memberships m
    join rush.profiles p on p.id = m.user_id
    where m.user_id = actor and m.active and m.role = 'OWNER' and p.active
  ) then raise exception 'forbidden' using errcode = '42501'; end if;

  insert into rush.rush_cycles (name) values (trim(cycle_name)) returning id into new_cycle_id;
  insert into rush.memberships (user_id, cycle_id, role)
  select m.user_id, new_cycle_id, m.role
  from rush.memberships m
  join rush.profiles p on p.id = m.user_id
  where m.cycle_id = source_cycle_id and m.active and p.active;
  if not exists (
    select 1 from rush.memberships
    where cycle_id = new_cycle_id and user_id = actor and role = 'OWNER'
  ) then
    insert into rush.memberships (user_id, cycle_id, role) values (actor, new_cycle_id, 'OWNER');
  end if;

  for round_row in
    select r.id, r.kind, r.name, r.weight
    from rush.rounds r where r.cycle_id = source_cycle_id order by r.name
  loop
    insert into rush.rounds (cycle_id, kind, name, weight)
    values (new_cycle_id, round_row.kind, round_row.name, round_row.weight)
    returning id into new_round_id;
    rounds_copied := rounds_copied + 1;

    select b.id, b.minimum_observed_criteria
    into source_rubric_id, source_minimum_observed
    from rush.rubrics b where b.round_id = round_row.id order by b.version desc limit 1;
    if source_rubric_id is not null then
      insert into rush.rubrics (round_id, version, minimum_observed_criteria)
      values (new_round_id, 1, source_minimum_observed)
      returning id into new_rubric_id;
      insert into rush.rubric_criteria (rubric_id, key, name, description, weight, required, position)
      select new_rubric_id, c.key, c.name, c.description, c.weight, c.required, c.position
      from rush.rubric_criteria c where c.rubric_id = source_rubric_id;
    end if;
  end loop;

  insert into rush.application_questions (cycle_id, key, prompt, input_type, required, sort_order, options)
  select new_cycle_id, q.key, q.prompt, q.input_type, q.required, q.sort_order, q.options
  from rush.application_questions q where q.cycle_id = source_cycle_id;
  get diagnostics questions_copied = row_count;
  insert into rush.audit_events (actor_id, cycle_id, action, resource, resource_id, metadata)
  values (actor, new_cycle_id, 'CYCLE_CLONED', 'RushCycle', new_cycle_id,
          jsonb_build_object('sourceCycleId', source_cycle_id, 'rounds', rounds_copied, 'questions', questions_copied));
  return new_cycle_id;
end;
$$;
