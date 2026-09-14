begin;
set local role postgres;
set local search_path = extensions, public;
select extensions.plan(42);

insert into auth.users(id, email, raw_user_meta_data) values
  ('30000000-0000-4000-8000-000000000001', 'gc-owner@example.invalid', '{"display_name":"Group Case owner"}'::jsonb),
  ('30000000-0000-4000-8000-000000000002', 'gc-member-one@example.invalid', '{"display_name":"Group Case member one"}'::jsonb),
  ('30000000-0000-4000-8000-000000000003', 'gc-member-two@example.invalid', '{"display_name":"Group Case member two"}'::jsonb),
  ('30000000-0000-4000-8000-000000000004', 'gc-committee@example.invalid', '{"display_name":"Group Case committee"}'::jsonb);

-- rush_cycles_one_non_terminal_idx allows one live cycle at a time.
update rush.rush_cycles set status = 'CLOSED' where status in ('DRAFT', 'OPEN', 'IN_PROCESS', 'DECISION_LOCK');
insert into rush.rush_cycles(id, name, status) values
  ('30000000-0000-4000-8000-000000000011', 'Group Case open cycle', 'OPEN'),
  ('30000000-0000-4000-8000-000000000012', 'Group Case closed cycle', 'CLOSED');
insert into rush.memberships(user_id, cycle_id, role) values
  ('30000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000011', 'OWNER'),
  ('30000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000011', 'MEMBER'),
  ('30000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000011', 'MEMBER'),
  ('30000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000011', 'RECRUITMENT_COMMITTEE');

insert into rush.pnms(id, name, contact, normalized_contact, uniqname) values
  ('30000000-0000-4000-8000-000000000021', 'Alpha Applicant', 'gcalpha@umich.edu', 'gcalpha@umich.edu', 'gcalpha'),
  ('30000000-0000-4000-8000-000000000022', 'Bravo Applicant', 'gcbravo@umich.edu', 'gcbravo@umich.edu', 'gcbravo'),
  ('30000000-0000-4000-8000-000000000023', 'Charlie Applicant', 'gccharlie@umich.edu', 'gccharlie@umich.edu', 'gccharlie');
insert into rush.applications(id, pnm_id, cycle_id, status, submitted_at) values
  ('30000000-0000-4000-8000-000000000031', '30000000-0000-4000-8000-000000000021', '30000000-0000-4000-8000-000000000011', 'GROUP_CASE', now()),
  ('30000000-0000-4000-8000-000000000032', '30000000-0000-4000-8000-000000000022', '30000000-0000-4000-8000-000000000011', 'GROUP_CASE', now()),
  ('30000000-0000-4000-8000-000000000033', '30000000-0000-4000-8000-000000000023', '30000000-0000-4000-8000-000000000011', 'GROUP_CASE', now());

-- rounds are unique per (cycle, kind), so the not-yet-active round lives in the closed cycle.
insert into rush.rounds(id, cycle_id, kind, name, status, weight) values
  ('30000000-0000-4000-8000-000000000051', '30000000-0000-4000-8000-000000000011', 'GROUP_CASE', 'Group Case', 'ACTIVE', 40),
  ('30000000-0000-4000-8000-000000000052', '30000000-0000-4000-8000-000000000012', 'GROUP_CASE', 'Published Group Case', 'PUBLISHED', 40);
insert into rush.rubrics(id, round_id, version) values
  ('30000000-0000-4000-8000-000000000061', '30000000-0000-4000-8000-000000000051', 1);
insert into rush.rubric_criteria(id, rubric_id, key, name, description, weight, required, position) values
  ('30000000-0000-4000-8000-000000000071', '30000000-0000-4000-8000-000000000061', 'collaboration', 'Team Collaboration', '', 25, true, 0),
  ('30000000-0000-4000-8000-000000000072', '30000000-0000-4000-8000-000000000061', 'problem_solving', 'Structured Problem-Solving', '', 13, false, 1),
  ('30000000-0000-4000-8000-000000000073', '30000000-0000-4000-8000-000000000061', 'leadership', 'Leadership & Initiative', '', 12, false, 2),
  ('30000000-0000-4000-8000-000000000074', '30000000-0000-4000-8000-000000000061', 'creativity', 'Creativity & Business Judgment', '', 12, false, 3),
  ('30000000-0000-4000-8000-000000000075', '30000000-0000-4000-8000-000000000061', 'composure', 'Composure & Time Management', '', 25, false, 4),
  ('30000000-0000-4000-8000-000000000076', '30000000-0000-4000-8000-000000000061', 'presentation', 'Presentation & Communication', '', 13, false, 5);
insert into rush.round_participations(round_id, application_id, rubric_id, required_evaluators, assignment_policy, advanced_by) values
  ('30000000-0000-4000-8000-000000000051', '30000000-0000-4000-8000-000000000031', '30000000-0000-4000-8000-000000000061', 1, '{}'::jsonb, '30000000-0000-4000-8000-000000000001'),
  ('30000000-0000-4000-8000-000000000051', '30000000-0000-4000-8000-000000000032', '30000000-0000-4000-8000-000000000061', 1, '{}'::jsonb, '30000000-0000-4000-8000-000000000001'),
  ('30000000-0000-4000-8000-000000000051', '30000000-0000-4000-8000-000000000033', '30000000-0000-4000-8000-000000000061', 1, '{}'::jsonb, '30000000-0000-4000-8000-000000000001');

-- 1. First tap as MEMBER 1
set local "request.jwt.claim.sub" = '30000000-0000-4000-8000-000000000002';
set local "request.jwt.claims" = '{"iss":"http://127.0.0.1:54321/auth/v1","sub":"30000000-0000-4000-8000-000000000002","role":"authenticated"}';
set local role authenticated;
select extensions.is(
  (select count(*) from jsonb_object_keys(rush.rate_group_case_applicant(
    '30000000-0000-4000-8000-000000000051', '30000000-0000-4000-8000-000000000031',
    '{"30000000-0000-4000-8000-000000000071":4,"30000000-0000-4000-8000-000000000072":null,"30000000-0000-4000-8000-000000000073":null,"30000000-0000-4000-8000-000000000074":null,"30000000-0000-4000-8000-000000000075":null,"30000000-0000-4000-8000-000000000076":null}'::jsonb,
    ''
  ) -> 'scores')),
  6::bigint,
  'the first tap returns all six criteria'
);
set local role postgres;
select extensions.is(
  (select count(*) from rush.evaluation_assignments where round_id = '30000000-0000-4000-8000-000000000051' and application_id = '30000000-0000-4000-8000-000000000031' and evaluator_id = '30000000-0000-4000-8000-000000000002' and status = 'SUBMITTED'),
  1::bigint, 'the first tap creates one submitted assignment'
);
select extensions.is(
  (select count(*) from rush.evaluations e join rush.evaluation_assignments a on a.id = e.assignment_id
   where a.round_id = '30000000-0000-4000-8000-000000000051' and a.application_id = '30000000-0000-4000-8000-000000000031' and a.evaluator_id = '30000000-0000-4000-8000-000000000002'
     and e.status = 'SUBMITTED' and e.evidence is null),
  1::bigint, 'the first tap creates one submitted evaluation with no note'
);
select extensions.is(
  (select count(*) from rush.round_calibration_acknowledgements where round_id = '30000000-0000-4000-8000-000000000051' and rubric_id = '30000000-0000-4000-8000-000000000061' and evaluator_id = '30000000-0000-4000-8000-000000000002'),
  1::bigint, 'the first tap acknowledges the rubric for the member'
);

-- 2. Second tap updates in place
set local role authenticated;
select extensions.is(
  rush.rate_group_case_applicant(
    '30000000-0000-4000-8000-000000000051', '30000000-0000-4000-8000-000000000031',
    '{"30000000-0000-4000-8000-000000000071":3,"30000000-0000-4000-8000-000000000072":5,"30000000-0000-4000-8000-000000000073":null,"30000000-0000-4000-8000-000000000074":null,"30000000-0000-4000-8000-000000000075":null,"30000000-0000-4000-8000-000000000076":null}'::jsonb,
    'smoke'
  ) ->> 'note',
  'smoke', 'the second tap returns the note'
);
set local role postgres;
select extensions.is(
  (select count(*) from rush.evaluations e join rush.evaluation_assignments a on a.id = e.assignment_id
   where a.round_id = '30000000-0000-4000-8000-000000000051' and a.application_id = '30000000-0000-4000-8000-000000000031' and a.evaluator_id = '30000000-0000-4000-8000-000000000002'),
  1::bigint, 'the second tap does not create a second evaluation'
);
select extensions.is(
  (select jsonb_object_agg(r.criterion_id, r.score) from rush.criterion_ratings r join rush.evaluations e on e.id = r.evaluation_id join rush.evaluation_assignments a on a.id = e.assignment_id
   where a.application_id = '30000000-0000-4000-8000-000000000031' and a.evaluator_id = '30000000-0000-4000-8000-000000000002'),
  '{"30000000-0000-4000-8000-000000000071":3,"30000000-0000-4000-8000-000000000072":5,"30000000-0000-4000-8000-000000000073":null,"30000000-0000-4000-8000-000000000074":null,"30000000-0000-4000-8000-000000000075":null,"30000000-0000-4000-8000-000000000076":null}'::jsonb,
  'the second tap overwrites the criterion ratings'
);
select extensions.is(
  (select e.evidence from rush.evaluations e join rush.evaluation_assignments a on a.id = e.assignment_id
   where a.application_id = '30000000-0000-4000-8000-000000000031' and a.evaluator_id = '30000000-0000-4000-8000-000000000002'),
  'smoke', 'the note is stored as evaluation evidence'
);

-- 3. Clearing every star on an already-graded applicant is a valid save
set local role authenticated;
select extensions.is(
  rush.rate_group_case_applicant(
    '30000000-0000-4000-8000-000000000051', '30000000-0000-4000-8000-000000000031',
    '{"30000000-0000-4000-8000-000000000071":null,"30000000-0000-4000-8000-000000000072":null,"30000000-0000-4000-8000-000000000073":null,"30000000-0000-4000-8000-000000000074":null,"30000000-0000-4000-8000-000000000075":null,"30000000-0000-4000-8000-000000000076":null}'::jsonb,
    ''
  ) ->> 'note',
  '', 'clearing every star on a graded applicant succeeds'
);
set local role postgres;
select extensions.is(
  (select count(*) from rush.criterion_ratings r join rush.evaluations e on e.id = r.evaluation_id join rush.evaluation_assignments a on a.id = e.assignment_id
   where a.application_id = '30000000-0000-4000-8000-000000000031' and a.evaluator_id = '30000000-0000-4000-8000-000000000002' and r.score is not null),
  0::bigint, 'clearing leaves every criterion rating null'
);

-- 4, 5, 6. Rejected saves
set local role authenticated;
select extensions.throws_ok(
  $$select rush.rate_group_case_applicant('30000000-0000-4000-8000-000000000051', '30000000-0000-4000-8000-000000000032', '{"30000000-0000-4000-8000-000000000071":null,"30000000-0000-4000-8000-000000000072":null,"30000000-0000-4000-8000-000000000073":null,"30000000-0000-4000-8000-000000000074":null,"30000000-0000-4000-8000-000000000075":null,"30000000-0000-4000-8000-000000000076":null}'::jsonb, '')$$,
  '22023', 'pick at least one star', 'an empty first save is rejected'
);
select extensions.throws_ok(
  $$select rush.rate_group_case_applicant('30000000-0000-4000-8000-000000000051', '30000000-0000-4000-8000-000000000032', '{"30000000-0000-4000-8000-000000000071":6}'::jsonb, '')$$,
  '22023', 'scores must be 1 through 5 or null', 'a score above 5 is rejected'
);
select extensions.throws_ok(
  $$select rush.rate_group_case_applicant('30000000-0000-4000-8000-000000000051', '30000000-0000-4000-8000-000000000032', '{"30000000-0000-4000-8000-000000000099":4}'::jsonb, '')$$,
  '22023', 'unknown criterion', 'an unknown criterion is rejected'
);
select extensions.throws_ok(
  $$select rush.rate_group_case_applicant('30000000-0000-4000-8000-000000000052', '30000000-0000-4000-8000-000000000031', '{"30000000-0000-4000-8000-000000000071":4}'::jsonb, '')$$,
  '55000', 'round is not open for grading', 'a published round cannot be graded'
);

-- 7. Conflict declaration hides the applicant and blocks rating
set local role postgres;
insert into rush.conflict_declarations(application_id, declarer_id, reason) values
  ('30000000-0000-4000-8000-000000000033', '30000000-0000-4000-8000-000000000002', 'Roommate');
set local role authenticated;
select extensions.throws_ok(
  $$select rush.rate_group_case_applicant('30000000-0000-4000-8000-000000000051', '30000000-0000-4000-8000-000000000033', '{"30000000-0000-4000-8000-000000000071":4}'::jsonb, '')$$,
  '42501', 'conflict declared', 'a declared conflict blocks rating'
);
select extensions.ok(
  not exists (
    select 1 from jsonb_array_elements(rush.group_case_roster('30000000-0000-4000-8000-000000000051') -> 'groups') g,
      jsonb_array_elements(g -> 'applicants') a
    where a ->> 'applicationId' = '30000000-0000-4000-8000-000000000033'
  ),
  'a declared conflict hides the applicant from the roster'
);

-- 8. A committee-only member cannot grade
set local "request.jwt.claim.sub" = '30000000-0000-4000-8000-000000000004';
set local "request.jwt.claims" = '{"iss":"http://127.0.0.1:54321/auth/v1","sub":"30000000-0000-4000-8000-000000000004","role":"authenticated"}';
select extensions.throws_ok(
  $$select rush.rate_group_case_applicant('30000000-0000-4000-8000-000000000051', '30000000-0000-4000-8000-000000000031', '{"30000000-0000-4000-8000-000000000071":4}'::jsonb, '')$$,
  '42501', 'forbidden', 'a recruitment committee member cannot grade'
);

-- 9. Roster shape as MEMBER 1
set local "request.jwt.claim.sub" = '30000000-0000-4000-8000-000000000002';
set local "request.jwt.claims" = '{"iss":"http://127.0.0.1:54321/auth/v1","sub":"30000000-0000-4000-8000-000000000002","role":"authenticated"}';
select extensions.is(rush.group_case_roster('30000000-0000-4000-8000-000000000051') ->> 'roundStatus', 'ACTIVE', 'the roster carries the round status');
select extensions.is(jsonb_array_length(rush.group_case_roster('30000000-0000-4000-8000-000000000051') -> 'criteria'), 6, 'the roster carries all six criteria');
select extensions.is(rush.group_case_roster('30000000-0000-4000-8000-000000000051') -> 'progress' ->> 'total', '2', 'the roster counts only unconflicted applicants');
select extensions.is(rush.group_case_roster('30000000-0000-4000-8000-000000000051') ->> 'canSeeSpeedDating', 'false', 'a member cannot see Speed Dating scores');
select extensions.is(jsonb_array_length(rush.group_case_roster('30000000-0000-4000-8000-000000000051') -> 'groups'), 1, 'ungrouped applicants form one bucket');
select extensions.is(rush.group_case_roster('30000000-0000-4000-8000-000000000051') -> 'groups' -> 0 ->> 'groupName', 'Not in a group', 'the ungrouped bucket is named');

-- 10. A named case group sorts first, the ungrouped bucket last
set local "request.jwt.claim.sub" = '30000000-0000-4000-8000-000000000001';
set local "request.jwt.claims" = '{"iss":"http://127.0.0.1:54321/auth/v1","sub":"30000000-0000-4000-8000-000000000001","role":"authenticated"}';
select rush.assign_case_group(
  rush.create_case_group('30000000-0000-4000-8000-000000000011', 'Case Team A'),
  '30000000-0000-4000-8000-000000000031'
);
select extensions.is(rush.group_case_roster('30000000-0000-4000-8000-000000000051') ->> 'canSeeSpeedDating', 'true', 'the owner can see Speed Dating scores');
set local "request.jwt.claim.sub" = '30000000-0000-4000-8000-000000000002';
set local "request.jwt.claims" = '{"iss":"http://127.0.0.1:54321/auth/v1","sub":"30000000-0000-4000-8000-000000000002","role":"authenticated"}';
select extensions.is(jsonb_array_length(rush.group_case_roster('30000000-0000-4000-8000-000000000051') -> 'groups'), 2, 'a case group adds a second bucket');
select extensions.is(rush.group_case_roster('30000000-0000-4000-8000-000000000051') -> 'groups' -> 0 ->> 'groupName', 'Case Team A', 'the named group sorts first');
select extensions.is(rush.group_case_roster('30000000-0000-4000-8000-000000000051') -> 'groups' -> 1 ->> 'groupName', 'Not in a group', 'the ungrouped bucket sorts last');
select extensions.is(rush.group_case_roster('30000000-0000-4000-8000-000000000051') -> 'groups' -> 0 -> 'applicants' -> 0 ->> 'applicationId', '30000000-0000-4000-8000-000000000031', 'the assigned applicant sits in the named group');
select extensions.is(rush.group_case_roster('30000000-0000-4000-8000-000000000051') -> 'groups' -> 0 -> 'applicants' -> 0 ->> 'note', '', 'the member sees their own note, cleared along with the stars');
select extensions.is(rush.group_case_roster('30000000-0000-4000-8000-000000000051') -> 'groups' -> 0 -> 'applicants' -> 0 -> 'scores', '{"30000000-0000-4000-8000-000000000071":null,"30000000-0000-4000-8000-000000000072":null,"30000000-0000-4000-8000-000000000073":null,"30000000-0000-4000-8000-000000000074":null,"30000000-0000-4000-8000-000000000075":null,"30000000-0000-4000-8000-000000000076":null}'::jsonb, 'the member sees their own cleared scores');

-- 11. Another member does not see MEMBER 1's scores
set local "request.jwt.claim.sub" = '30000000-0000-4000-8000-000000000003';
set local "request.jwt.claims" = '{"iss":"http://127.0.0.1:54321/auth/v1","sub":"30000000-0000-4000-8000-000000000003","role":"authenticated"}';
select extensions.is(rush.group_case_roster('30000000-0000-4000-8000-000000000051') -> 'groups' -> 0 -> 'applicants' -> 0 -> 'scores', '{}'::jsonb, 'another member sees empty scores');
select extensions.is(rush.group_case_roster('30000000-0000-4000-8000-000000000051') -> 'groups' -> 0 -> 'applicants' -> 0 ->> 'note', '', 'another member sees no note');
select extensions.is(rush.group_case_roster('30000000-0000-4000-8000-000000000051') -> 'progress' ->> 'total', '3', 'a member without conflicts sees all three applicants');

-- 12. Board results
-- Member two rates Bravo: Collaboration 5 (weight 25), Problem-Solving 3 (weight 13), the other four not observed.
-- weighted = 8 * (25*5 + 13*3) / (25 + 13) = 8 * 164 / 38 = 34.526... -> 34.5 (unweighted would read 32.0).
select rush.rate_group_case_applicant(
  '30000000-0000-4000-8000-000000000051', '30000000-0000-4000-8000-000000000032',
  '{"30000000-0000-4000-8000-000000000071":5,"30000000-0000-4000-8000-000000000072":3}'::jsonb,
  'sharp'
);
select extensions.throws_ok(
  $$select rush.group_case_results('30000000-0000-4000-8000-000000000051')$$,
  '42501', 'board role required', 'a member cannot read Group Case results'
);
set local "request.jwt.claim.sub" = '30000000-0000-4000-8000-000000000001';
set local "request.jwt.claims" = '{"iss":"http://127.0.0.1:54321/auth/v1","sub":"30000000-0000-4000-8000-000000000001","role":"authenticated"}';
select extensions.is(rush.group_case_results('30000000-0000-4000-8000-000000000051') -> 'summary' ->> 'applicants', '3', 'the owner sees all three applicants');
-- Member one's evaluation on Alpha has every star cleared and no note, so only member two counts.
select extensions.is(rush.group_case_results('30000000-0000-4000-8000-000000000051') -> 'summary' ->> 'graders', '1', 'a cleared rating does not count as a grader');
select extensions.is(
  (select a ->> 'mean' from jsonb_array_elements(rush.group_case_results('30000000-0000-4000-8000-000000000051') -> 'applicants') a where a ->> 'applicationId' = '30000000-0000-4000-8000-000000000032'),
  '34.5', 'the weighted mean counts only the criteria the grader scored'
);
select extensions.is(
  (select a -> 'evaluations' -> 0 ->> 'scoredCount' from jsonb_array_elements(rush.group_case_results('30000000-0000-4000-8000-000000000051') -> 'applicants') a where a ->> 'applicationId' = '30000000-0000-4000-8000-000000000032'),
  '2', 'the evaluation reports how many criteria were scored'
);
select extensions.is(rush.group_case_results('30000000-0000-4000-8000-000000000051') -> 'applicants' -> 0 ->> 'applicationId', '30000000-0000-4000-8000-000000000032', 'the rated applicant ranks first');
select extensions.is(
  (select a ->> 'count' from jsonb_array_elements(rush.group_case_results('30000000-0000-4000-8000-000000000051') -> 'applicants') a where a ->> 'applicationId' = '30000000-0000-4000-8000-000000000033'),
  '0', 'an unrated applicant has no evaluations'
);
select extensions.is(
  (select a -> 'mean' from jsonb_array_elements(rush.group_case_results('30000000-0000-4000-8000-000000000051') -> 'applicants') a where a ->> 'applicationId' = '30000000-0000-4000-8000-000000000033'),
  'null'::jsonb, 'an unrated applicant has no mean'
);
select extensions.is(
  (select a ->> 'groupName' from jsonb_array_elements(rush.group_case_results('30000000-0000-4000-8000-000000000051') -> 'applicants') a where a ->> 'applicationId' = '30000000-0000-4000-8000-000000000031'),
  'Case Team A', 'the results carry the case group name'
);

select * from extensions.finish();
rollback;
