-- rush.create_cycle seeds a fresh cycle from hard-coded defaults, which was
-- enough while nothing could be edited. Now that prompts and rubric criteria
-- are editable, a board that spent a cycle tuning them would lose all of it
-- next semester and start again from the seeds.
--
-- Clone copies the parts that describe how a cycle is run: rounds, the current
-- rubric for each round, the application questions, and who has access. It
-- copies nothing applicant-shaped. No pnms, applications, documents,
-- evaluations, decisions, events or check-ins, because those belong to the
-- cohort that lived through the old cycle.
--
-- Rubric versions restart at 1. Versions exist to keep a score comparable to
-- the wording it was given under, and that scope is a round, so carrying a
-- version number across cycles would say something untrue about the history.
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

  -- Same bar as create_cycle: an active OWNER somewhere, not merely an owner of
  -- the cycle being copied.
  if not exists (
    select 1
    from rush.memberships m
    join rush.profiles p on p.id = m.user_id
    where m.user_id = actor and m.active and m.role = 'OWNER' and p.active
  ) then raise exception 'forbidden' using errcode = '42501'; end if;

  insert into rush.rush_cycles (name) values (trim(cycle_name)) returning id into new_cycle_id;

  -- Carry the roster forward, then make sure the actor owns the result even if
  -- they were not on the source cycle.
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

    select b.id into source_rubric_id
    from rush.rubrics b where b.round_id = round_row.id order by b.version desc limit 1;

    if source_rubric_id is not null then
      insert into rush.rubrics (round_id, version) values (new_round_id, 1)
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

revoke all on function rush.clone_cycle(text, text) from public, anon;
grant execute on function rush.clone_cycle(text, text) to authenticated, service_role;
