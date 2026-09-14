-- Group Case rubric from the Fall recruitment guide ("Group Case Redesign"):
-- six dimensions scored 1 to 5, Team Collaboration and Composure weighted
-- twice. Weights are the guide's 2:1:1:1:2:1 on a 100 scale (25/13/12/12/25/13).
-- Collaboration stays the one required criterion; three observed criteria
-- remain the minimum. Data change for Group Case rubrics nobody has graded
-- against yet; a rubric with evaluations is left alone so scores keep their
-- criteria. The per-score anchors live in src/lib/rubrics.ts.

do $$
declare
  rubric_row record;
begin
  for rubric_row in
    select rb.id
    from rush.rubrics rb
    join rush.rounds r on r.id = rb.round_id and r.kind = 'GROUP_CASE'
    where rb.frozen_at is null
      and not exists (select 1 from rush.evaluations e where e.rubric_id = rb.id)
  loop
    delete from rush.rubric_criteria where rubric_id = rubric_row.id;
    insert into rush.rubric_criteria (rubric_id, key, name, description, weight, required, position) values
      (rubric_row.id, 'collaboration', 'Team Collaboration',
        'Builds on teammates'' ideas, pulls in quieter people, resolves disagreement productively and credits others. Weighted 2x.', 25, true, 0),
      (rubric_row.id, 'problem_solving', 'Structured Problem-Solving',
        'Breaks the problem into parts, uses the numbers in the data pack to justify the recommendation and anticipates the counterargument.', 13, false, 1),
      (rubric_row.id, 'leadership', 'Leadership & Initiative',
        'Steps up without being asked and without dominating; organizes the group''s approach and owns a piece of the deliverable.', 12, false, 2),
      (rubric_row.id, 'creativity', 'Creativity & Business Judgment',
        'Ideas are specific to this client and industry, reflect the stated constraints and show awareness of trade-offs.', 12, false, 3),
      (rubric_row.id, 'composure', 'Composure & Time Management',
        'Paces work against the clock, stays calm when plans change and helps the group land a finished deliverable on time. Weighted 2x.', 25, false, 4),
      (rubric_row.id, 'presentation', 'Presentation & Communication',
        'Clear, confident delivery; answers follow-up questions by reasoning in real time rather than restating the slide.', 13, false, 5);
    update rush.rubrics set minimum_observed_criteria = 3 where id = rubric_row.id;
  end loop;
end;
$$;
