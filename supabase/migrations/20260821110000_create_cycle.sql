create function rush.create_cycle(cycle_name text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  cycle_id text;
  speed_round_id text;
  case_round_id text;
  speed_rubric_id text;
  case_rubric_id text;
begin
  if actor is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  if char_length(trim(cycle_name)) not between 1 and 120 then
    raise exception 'invalid cycle name' using errcode = '22023';
  end if;
  if exists (select 1 from rush.rush_cycles where lower(name) = lower(trim(cycle_name))) then
    raise exception 'cycle exists' using errcode = '23505';
  end if;
  if exists (select 1 from rush.rush_cycles) and not exists (
    select 1 from rush.memberships where user_id = actor and active and role = 'OWNER'
  ) then raise exception 'forbidden' using errcode = '42501'; end if;
  if not exists (select 1 from rush.rush_cycles) and not exists (
    select 1 from public.members where user_id = actor and deleted_at is null and role = 'board'
  ) then raise exception 'only an existing board member can initialize rush' using errcode = '42501'; end if;

  insert into rush.rush_cycles (name) values (trim(cycle_name)) returning id into cycle_id;
  insert into rush.memberships (user_id, cycle_id, role) values (actor, cycle_id, 'OWNER');

  insert into rush.rounds (cycle_id, kind, name, weight)
  values (cycle_id, 'SPEED_DATING', 'Speed Dating', 40) returning id into speed_round_id;
  insert into rush.rubrics (round_id, version) values (speed_round_id, 1) returning id into speed_rubric_id;
  insert into rush.rubric_criteria (rubric_id, key, name, description, weight, required, position) values
    (speed_rubric_id, 'communication', 'Clear communication and concision', 'Answers clearly, concisely, and adapts to the listener.', 25, true, 0),
    (speed_rubric_id, 'listening', 'Listening and question quality', 'Listens, follows up, and builds on the conversation.', 20, false, 1),
    (speed_rubric_id, 'reasoning', 'Structured reasoning', 'States assumptions and works through tradeoffs.', 20, false, 2),
    (speed_rubric_id, 'coachability', 'Collaboration and coachability', 'Receives feedback respectfully and incorporates it.', 20, false, 3),
    (speed_rubric_id, 'judgment', 'Judgment and integrity', 'Separates facts from assumptions and acknowledges limits.', 15, false, 4);

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

  insert into rush.audit_events (actor_id, cycle_id, action, resource, resource_id)
  values (actor, cycle_id, 'CYCLE_CREATED', 'RushCycle', cycle_id);
  return cycle_id;
end;
$$;
revoke all on function rush.create_cycle(text) from public, anon;
grant execute on function rush.create_cycle(text) to authenticated, service_role;
