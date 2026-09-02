-- Rubric criteria were seeded by rush.create_cycle and could never be changed
-- afterwards without a migration. Weights, wording and which criteria are
-- required are exactly the things a board wants to tune between cycles.
--
-- Criteria are referenced by rush.criterion_ratings.criterion_id, which has no
-- cascade, so editing a rubric that has already been scored against would
-- either fail on the foreign key or silently rewrite what a past score meant.
-- rush.rubrics is versioned per round for this reason: when the current rubric
-- has any evaluation against it, publish version + 1 instead of editing. Past
-- evaluations stay pinned to the wording they were scored under, and the member
-- workspace already picks the highest version.
--
-- Editing is also refused once the round is under way. Round status only moves
-- forward (DRAFT -> PUBLISHED -> ACTIVE -> FROZEN -> FINALIZED), so allowing
-- DRAFT and PUBLISHED means criteria settle before anyone can score against
-- them, and the version bump above covers the DRAFT-evaluation edge case.
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

  -- Alias must not be "entry": that is the loop variable above, and plpgsql
  -- resolves the ambiguity by refusing at runtime, not at create time.
  if (select count(distinct elem->>'key') from jsonb_array_elements(criteria) elem)
     <> jsonb_array_length(criteria) then
    raise exception 'duplicate criterion key' using errcode = '23505';
  end if;

  select b.id, b.version into latest_rubric_id, latest_version
  from rush.rubrics b where b.round_id = target_round_id order by b.version desc limit 1;

  if latest_rubric_id is null then
    insert into rush.rubrics (round_id, version) values (target_round_id, 1)
    returning id into target_rubric_id;
  elsif exists (select 1 from rush.evaluations e where e.rubric_id = latest_rubric_id) then
    insert into rush.rubrics (round_id, version) values (target_round_id, latest_version + 1)
    returning id into target_rubric_id;
  else
    target_rubric_id := latest_rubric_id;
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
revoke all on function rush.set_rubric_criteria(text, jsonb) from public, anon;
grant execute on function rush.set_rubric_criteria(text, jsonb) to authenticated, service_role;
-- The editor needs the current criteria for every round in a cycle. Reading
-- through PostgREST would work for board staff, but this keeps the shape the
-- editor posts back identical to the shape it reads, so a round trip cannot
-- quietly drop a field.
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
        select b2.id, b2.version from rush.rubrics b2
        where b2.round_id = r.id order by b2.version desc limit 1
      ) b on true
      where r.cycle_id = target_cycle_id
    ), '[]'::jsonb)
  end;
$$;
revoke all on function rush.cycle_rubrics(text) from public, anon;
grant execute on function rush.cycle_rubrics(text) to authenticated, service_role;
