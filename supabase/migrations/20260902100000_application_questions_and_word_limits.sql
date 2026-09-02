-- The Fall 2026 application uses three Board-provided prompts. Word limits are
-- data, not presentation copy: the browser explains them and the database
-- enforces them when an application is submitted.

alter table rush.application_questions
  add column if not exists word_limit integer
  check (word_limit is null or word_limit between 1 and 2000);

alter table rush.application_responses
  add column if not exists question_word_limit integer
  check (question_word_limit is null or question_word_limit between 1 and 2000);

create or replace function rush.response_word_count(value text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when value is null or pg_catalog.btrim(value) = '' then 0
    else pg_catalog.array_length(
      pg_catalog.regexp_split_to_array(pg_catalog.btrim(value), E'\\s+'),
      1
    )
  end;
$$;

create or replace function rush.enforce_application_response_word_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  configured_limit integer;
begin
  select q.word_limit into configured_limit
  from rush.applications a
  join rush.application_questions q
    on q.cycle_id = a.cycle_id and q.key = new.question_key
  where a.id = new.application_id;

  new.question_word_limit := configured_limit;
  if configured_limit is not null
     and rush.response_word_count(new.response_text) > configured_limit then
    raise exception 'answer exceeds word limit for %', new.question_key using errcode = '22023';
  end if;
  return new;
end;
$$;

revoke all on function rush.response_word_count(text), rush.enforce_application_response_word_limit() from public, anon, authenticated;
grant execute on function rush.response_word_count(text) to service_role;

drop trigger if exists application_response_word_limit_guard on rush.application_responses;
create trigger application_response_word_limit_guard
before insert or update of response_text, question_key, application_id
on rush.application_responses
for each row execute function rush.enforce_application_response_word_limit();

create or replace function rush.seed_cycle_questions(target_cycle_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into rush.application_questions
    (cycle_id, key, prompt, input_type, required, sort_order, word_limit)
  values
    (
      target_cycle_id,
      'why_mecg',
      'MECG emphasizes professional development, education, project experience and community experiences. Why do you feel you are a strong fit for this environment, and what motivates you to join?',
      'long_text', true, 0, 300
    ),
    (
      target_cycle_id,
      'community_improvement',
      'Identify a problem or opportunity for improvement in your local community. How would you approach addressing it, and what specific changes would you recommend?',
      'long_text', true, 1, 250
    ),
    (
      target_cycle_id,
      'unrelated_expertise',
      'If you could instantly become an expert in something completely unrelated to your major, what would you choose and why?',
      'long_text', true, 2, 50
    )
  on conflict (cycle_id, key) do update set
    prompt = excluded.prompt,
    input_type = excluded.input_type,
    required = excluded.required,
    sort_order = excluded.sort_order,
    word_limit = excluded.word_limit;
end;
$$;

create or replace function rush.set_application_questions(target_cycle_id text, questions jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := rush.actor_id();
  entry jsonb;
  position_index integer := 0;
  written integer := 0;
  configured_limit integer;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  if not rush.has_cycle_role(target_cycle_id, array['BOARD','OWNER']::rush.member_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from rush.rush_cycles where id = target_cycle_id) then
    raise exception 'cycle missing' using errcode = 'P0002';
  end if;
  if exists (
    select 1 from rush.applications
    where cycle_id = target_cycle_id and status <> 'DRAFT'
  ) then
    raise exception 'applications already submitted' using errcode = '55000';
  end if;

  if jsonb_typeof(questions) <> 'array' then raise exception 'invalid questions' using errcode = '22023'; end if;
  if jsonb_array_length(questions) > 25 then raise exception 'too many questions' using errcode = '22023'; end if;

  for entry in select value from jsonb_array_elements(questions) loop
    if jsonb_typeof(entry) <> 'object' then raise exception 'invalid question' using errcode = '22023'; end if;
    if coalesce(entry->>'key','') !~ '^[a-z][a-z0-9_]*$' or char_length(entry->>'key') > 80 then
      raise exception 'invalid question key' using errcode = '22023';
    end if;
    if char_length(trim(coalesce(entry->>'prompt',''))) not between 1 and 2000 then
      raise exception 'invalid question prompt' using errcode = '22023';
    end if;
    if coalesce(entry->>'inputType','long_text') not in ('short_text','long_text','url','select') then
      raise exception 'invalid question type' using errcode = '22023';
    end if;
    if jsonb_typeof(coalesce(entry->'options','[]'::jsonb)) <> 'array' then
      raise exception 'invalid question options' using errcode = '22023';
    end if;
    if pg_catalog.jsonb_array_length(coalesce(entry->'options','[]'::jsonb)) > 50
       or exists (
         select 1 from pg_catalog.jsonb_array_elements(coalesce(entry->'options','[]'::jsonb)) option(value)
         where pg_catalog.jsonb_typeof(option.value) <> 'string'
            or pg_catalog.char_length(pg_catalog.btrim(option.value #>> '{}')) not between 1 and 200
       ) then
      raise exception 'invalid question options' using errcode = '22023';
    end if;
    if (
      select pg_catalog.count(*)
      from pg_catalog.jsonb_array_elements_text(coalesce(entry->'options','[]'::jsonb)) option(value)
    ) <> (
      select pg_catalog.count(distinct pg_catalog.btrim(option.value))
      from pg_catalog.jsonb_array_elements_text(coalesce(entry->'options','[]'::jsonb)) option(value)
    ) then
      raise exception 'duplicate question options' using errcode = '23505';
    end if;
    if coalesce(entry->>'inputType','long_text') = 'select'
       and pg_catalog.jsonb_array_length(coalesce(entry->'options','[]'::jsonb)) = 0 then
      raise exception 'select question needs options' using errcode = '22023';
    end if;
    if entry ? 'maxWords' and jsonb_typeof(entry->'maxWords') <> 'null' then
      if jsonb_typeof(entry->'maxWords') <> 'number' or (entry->>'maxWords') !~ '^[0-9]+$' then
        raise exception 'invalid question word limit' using errcode = '22023';
      end if;
      configured_limit := (entry->>'maxWords')::integer;
      if configured_limit not between 1 and 2000 then
        raise exception 'invalid question word limit' using errcode = '22023';
      end if;
    end if;
  end loop;

  if (select count(distinct elem->>'key') from jsonb_array_elements(questions) elem)
     <> jsonb_array_length(questions) then
    raise exception 'duplicate question key' using errcode = '23505';
  end if;

  delete from rush.application_questions where cycle_id = target_cycle_id;
  for entry in select value from jsonb_array_elements(questions) loop
    configured_limit := case
      when entry ? 'maxWords' and jsonb_typeof(entry->'maxWords') <> 'null'
        then (entry->>'maxWords')::integer
      else null
    end;
    insert into rush.application_questions
      (cycle_id, key, prompt, input_type, required, sort_order, options, word_limit)
    values (
      target_cycle_id,
      entry->>'key',
      trim(entry->>'prompt'),
      coalesce(entry->>'inputType','long_text'),
      coalesce((entry->>'required')::boolean, true),
      position_index,
      coalesce(entry->'options','[]'::jsonb),
      configured_limit
    );
    position_index := position_index + 1;
    written := written + 1;
  end loop;

  -- Question edits are allowed while applicants have drafts. Retain answers
  -- whose keys still exist and discard only answers to removed questions.
  update rush.applications a
  set draft_payload = pg_catalog.jsonb_set(
    a.draft_payload,
    '{answers}',
    coalesce((
      select pg_catalog.jsonb_object_agg(answer.key, answer.value)
      from pg_catalog.jsonb_each(
        case when pg_catalog.jsonb_typeof(a.draft_payload->'answers') = 'object'
          then a.draft_payload->'answers' else '{}'::jsonb end
      ) answer
      where exists (
        select 1 from rush.application_questions q
        where q.cycle_id = target_cycle_id and q.key = answer.key
      )
    ), '{}'::jsonb),
    true
  )
  where a.cycle_id = target_cycle_id and a.status = 'DRAFT' and a.draft_payload is not null;

  insert into rush.audit_events (actor_id, cycle_id, action, resource, resource_id, metadata)
  values (actor, target_cycle_id, 'APPLICATION_QUESTIONS_SET', 'RushCycle', target_cycle_id,
          jsonb_build_object('count', written));
  return written;
end;
$$;

revoke all on function rush.set_application_questions(text, jsonb) from public, anon;
grant execute on function rush.set_application_questions(text, jsonb) to authenticated, service_role;

create or replace function rush.cycle_application_questions(target_cycle_id text)
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
        'key', q.key,
        'prompt', q.prompt,
        'inputType', q.input_type,
        'required', q.required,
        'options', q.options,
        'maxWords', q.word_limit
      ) order by q.sort_order)
      from rush.application_questions q
      where q.cycle_id = target_cycle_id
    ), '[]'::jsonb)
  end;
$$;

revoke all on function rush.cycle_application_questions(text) from public, anon;
grant execute on function rush.cycle_application_questions(text) to authenticated, service_role;

create or replace function rush.intake_schema()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := rush.actor_id();
  cycle_row rush.rush_cycles%rowtype;
  draft jsonb;
  needs_info boolean;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;

  select * into cycle_row from rush.rush_cycles
  where status = 'OPEN' and (opens_at is null or opens_at <= now()) and (closes_at is null or closes_at >= now())
  order by created_at desc limit 1;

  if cycle_row.id is null or not rush.application_portal_allows(actor) then
    return jsonb_build_object('open', false, 'cycleId', null, 'cycleName', null, 'questions', '[]'::jsonb, 'draft', null, 'needsInfo', false);
  end if;

  select a.draft_payload, (a.status = 'NEEDS_INFO') into draft, needs_info
  from rush.applications a
  join rush.pnms p on p.id = a.pnm_id
  where p.auth_user_id = actor and a.cycle_id = cycle_row.id and a.status in ('DRAFT', 'NEEDS_INFO');

  return jsonb_build_object(
    'open', true,
    'cycleId', cycle_row.id,
    'cycleName', cycle_row.name,
    'draft', draft,
    'needsInfo', coalesce(needs_info, false),
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'key', q.key,
        'prompt', q.prompt,
        'inputType', q.input_type,
        'required', q.required,
        'sortOrder', q.sort_order,
        'options', q.options,
        'maxWords', q.word_limit
      ) order by q.sort_order)
      from rush.application_questions q where q.cycle_id = cycle_row.id
    ), '[]'::jsonb)
  );
end;
$$;

-- Update only cohorts whose questions are still fair to change. Submitted
-- cohorts keep their historical prompts; all new cycles use the new seed.
do $migration$
declare
  target_cycle_id text;
begin
  for target_cycle_id in
    select c.id from rush.rush_cycles c
    where not exists (
      select 1 from rush.applications a
      where a.cycle_id = c.id and a.status <> 'DRAFT'
    )
  loop
    delete from rush.application_questions where cycle_id = target_cycle_id;
    perform rush.seed_cycle_questions(target_cycle_id);
    update rush.applications a
    set draft_payload = pg_catalog.jsonb_set(
      a.draft_payload,
      '{answers}',
      '{}'::jsonb,
      true
    )
    where a.cycle_id = target_cycle_id and a.status = 'DRAFT' and a.draft_payload is not null;
  end loop;
end;
$migration$;

-- Cycle cloning is the normal way to prepare the next recruitment period. The
-- clone must preserve the application contract, including the new limits.
create or replace function rush.clone_cycle(source_cycle_id text, cycle_name text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := rush.actor_id();
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

  insert into rush.application_questions
    (cycle_id, key, prompt, input_type, required, sort_order, options, word_limit)
  select new_cycle_id, q.key, q.prompt, q.input_type, q.required, q.sort_order, q.options, q.word_limit
  from rush.application_questions q where q.cycle_id = source_cycle_id;
  get diagnostics questions_copied = row_count;
  insert into rush.audit_events (actor_id, cycle_id, action, resource, resource_id, metadata)
  values (actor, new_cycle_id, 'CYCLE_CLONED', 'RushCycle', new_cycle_id,
          jsonb_build_object('sourceCycleId', source_cycle_id, 'rounds', rounds_copied, 'questions', questions_copied));
  return new_cycle_id;
end;
$$;

revoke all on function rush.clone_cycle(text, text) from public, anon;
grant execute on function rush.clone_cycle(text, text) to authenticated, service_role;
