do $migration$
declare
  cycle_id text;
  speed_round_id text;
  case_round_id text;
  speed_rubric_id text;
  case_rubric_id text;
begin
  if exists (select 1 from rush.rush_cycles) then
    return;
  end if;

  insert into rush.rush_cycles (name, status, opens_at)
  values ('Fall 2026 Rush', 'OPEN', now())
  returning id into cycle_id;

  insert into rush.rounds (cycle_id, kind, name, weight)
  values (cycle_id, 'SPEED_DATING', 'Speed Dating', 40)
  returning id into speed_round_id;

  insert into rush.rubrics (round_id, version)
  values (speed_round_id, 1)
  returning id into speed_rubric_id;

  insert into rush.rubric_criteria (rubric_id, key, name, description, weight, required, position) values
    (speed_rubric_id, 'communication', 'Clear communication and concision', 'Answers clearly, concisely, and adapts to the listener.', 25, true, 0),
    (speed_rubric_id, 'listening', 'Listening and question quality', 'Listens, follows up, and builds on the conversation.', 20, false, 1),
    (speed_rubric_id, 'reasoning', 'Structured reasoning', 'States assumptions and works through tradeoffs.', 20, false, 2),
    (speed_rubric_id, 'coachability', 'Collaboration and coachability', 'Receives feedback respectfully and incorporates it.', 20, false, 3),
    (speed_rubric_id, 'judgment', 'Judgment and integrity', 'Separates facts from assumptions and acknowledges limits.', 15, false, 4);

  insert into rush.rounds (cycle_id, kind, name, weight)
  values (cycle_id, 'GROUP_CASE', 'Group Case', 60)
  returning id into case_round_id;

  insert into rush.rubrics (round_id, version)
  values (case_round_id, 1)
  returning id into case_rubric_id;

  insert into rush.rubric_criteria (rubric_id, key, name, description, weight, required, position) values
    (case_rubric_id, 'framing', 'Problem framing and assumptions', 'Clarifies the objective, ambiguity, and assumptions.', 20, false, 0),
    (case_rubric_id, 'analysis', 'Analysis and evidence', 'Uses evidence and tests assumptions.', 20, false, 1),
    (case_rubric_id, 'collaboration', 'Collaboration and inclusion', 'Invites contributions and resolves disagreement constructively.', 25, true, 2),
    (case_rubric_id, 'communication', 'Communication and listening', 'Synthesizes clearly and keeps the group aligned.', 15, false, 3),
    (case_rubric_id, 'ownership', 'Ownership and reliability', 'Follows through without taking over.', 10, false, 4),
    (case_rubric_id, 'recommendation', 'Recommendation and judgment', 'Prioritizes actions, limitations, and next steps.', 10, false, 5);

  perform rush.seed_cycle_questions(cycle_id);
end;
$migration$;
