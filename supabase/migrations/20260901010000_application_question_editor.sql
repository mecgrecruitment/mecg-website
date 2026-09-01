-- Application prompts could only be changed by writing a migration. The table,
-- the RLS and the intake_schema reader all existed; there was simply no write
-- path, so every wording change needed a developer and a deploy.
--
-- Replace-the-whole-set rather than per-row CRUD: the form edits an ordered
-- list, sort_order is dense, and one statement cannot leave a half-applied
-- ordering behind.
--
-- Editing is refused once anyone has submitted. rush.application_responses
-- snapshots question_text at submit time, so past answers can never be
-- orphaned by an edit, but changing the prompts underneath a cohort that is
-- mid-application is a fairness problem rather than a data problem.
create or replace function rush.set_application_questions(target_cycle_id text, questions jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  entry jsonb;
  position_index integer := 0;
  written integer := 0;
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
  end loop;

  -- Alias must not be "entry": that is the loop variable above, and plpgsql
  -- resolves the ambiguity by refusing at runtime, not at create time.
  if (select count(distinct elem->>'key') from jsonb_array_elements(questions) elem)
     <> jsonb_array_length(questions) then
    raise exception 'duplicate question key' using errcode = '23505';
  end if;

  delete from rush.application_questions where cycle_id = target_cycle_id;
  for entry in select value from jsonb_array_elements(questions) loop
    insert into rush.application_questions (cycle_id, key, prompt, input_type, required, sort_order, options)
    values (
      target_cycle_id,
      entry->>'key',
      trim(entry->>'prompt'),
      coalesce(entry->>'inputType','long_text'),
      coalesce((entry->>'required')::boolean, true),
      position_index,
      coalesce(entry->'options','[]'::jsonb)
    );
    position_index := position_index + 1;
    written := written + 1;
  end loop;

  insert into rush.audit_events (actor_id, cycle_id, action, resource, resource_id, metadata)
  values (actor, target_cycle_id, 'APPLICATION_QUESTIONS_SET', 'RushCycle', target_cycle_id,
          jsonb_build_object('count', written));
  return written;
end;
$$;

revoke all on function rush.set_application_questions(text, jsonb) from public, anon;
grant execute on function rush.set_application_questions(text, jsonb) to authenticated, service_role;

-- The editor needs to read the current set for a cycle. questions_read_authenticated
-- is scoped to the open intake cycle, so board staff editing a DRAFT cycle
-- would otherwise see nothing to edit.
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
        'options', q.options
      ) order by q.sort_order)
      from rush.application_questions q
      where q.cycle_id = target_cycle_id
    ), '[]'::jsonb)
  end;
$$;

revoke all on function rush.cycle_application_questions(text) from public, anon;
grant execute on function rush.cycle_application_questions(text) to authenticated, service_role;
