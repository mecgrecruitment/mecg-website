begin;
set local role postgres;
set local search_path = extensions, public;
select extensions.plan(10);

-- Exercise the revision-safe public surface with the original synthetic caller.
-- Each fixture action is a deliberate fresh edit based on the latest own roster.
create function pg_temp.rate_group_case_compat(target_round_id text,target_application_id text,scores jsonb,note text)
returns jsonb language plpgsql as $$
declare revision uuid;
begin
  select (applicant->>'revision')::uuid into revision
  from jsonb_array_elements(rush.group_case_roster_v2(target_round_id)->'groups') g,
    jsonb_array_elements(g->'applicants') applicant where applicant->>'applicationId'=target_application_id;
  return rush.rate_group_case_applicant_v2(target_round_id,target_application_id,scores,note,revision,gen_random_uuid())-'kind'-'revision'-'mutationId';
end $$;

insert into auth.users(id, email, raw_user_meta_data) values
  ('39000000-0000-4000-8000-000000000001', 'gc-owner@example.invalid', '{"display_name":"Group Case owner"}'::jsonb),
  ('39000000-0000-4000-8000-000000000002', 'gc-member-one@example.invalid', '{"display_name":"Group Case member one"}'::jsonb),
  ('39000000-0000-4000-8000-000000000003', 'gc-member-two@example.invalid', '{"display_name":"Group Case member two"}'::jsonb),
  ('39000000-0000-4000-8000-000000000004', 'gc-committee@example.invalid', '{"display_name":"Group Case committee"}'::jsonb);

-- Synthetic subjects are mapped explicitly through the production identity contract.
insert into rush.auth_identities(issuer,subject,app_user_id)
 select 'https://grading-contracts.example.invalid', id::text, id from rush.profiles
 where id::text like '39000000-%';

-- rush_cycles_one_non_terminal_idx allows one live cycle at a time.
update rush.rush_cycles set status = 'CLOSED' where status in ('DRAFT', 'OPEN', 'IN_PROCESS', 'DECISION_LOCK');
insert into rush.rush_cycles(id, name, status) values
  ('39000000-0000-4000-8000-000000000011', 'Group Case open cycle', 'OPEN'),
  ('39000000-0000-4000-8000-000000000012', 'Group Case closed cycle', 'CLOSED');
insert into rush.memberships(user_id, cycle_id, role) values
  ('39000000-0000-4000-8000-000000000001', '39000000-0000-4000-8000-000000000011', 'OWNER'),
  ('39000000-0000-4000-8000-000000000002', '39000000-0000-4000-8000-000000000011', 'MEMBER'),
  ('39000000-0000-4000-8000-000000000003', '39000000-0000-4000-8000-000000000011', 'MEMBER'),
  ('39000000-0000-4000-8000-000000000004', '39000000-0000-4000-8000-000000000011', 'RECRUITMENT_COMMITTEE');

insert into rush.pnms(id, name, contact, normalized_contact, uniqname) values
  ('39000000-0000-4000-8000-000000000021', 'Alpha Applicant', 'gcalpha@umich.edu', 'gcalpha@umich.edu', 'gcalpha'),
  ('39000000-0000-4000-8000-000000000022', 'Bravo Applicant', 'gcbravo@umich.edu', 'gcbravo@umich.edu', 'gcbravo'),
  ('39000000-0000-4000-8000-000000000023', 'Charlie Applicant', 'gccharlie@umich.edu', 'gccharlie@umich.edu', 'gccharlie');
insert into rush.applications(id, pnm_id, cycle_id, status, submitted_at) values
  ('39000000-0000-4000-8000-000000000031', '39000000-0000-4000-8000-000000000021', '39000000-0000-4000-8000-000000000011', 'GROUP_CASE', now()),
  ('39000000-0000-4000-8000-000000000032', '39000000-0000-4000-8000-000000000022', '39000000-0000-4000-8000-000000000011', 'GROUP_CASE', now()),
  ('39000000-0000-4000-8000-000000000033', '39000000-0000-4000-8000-000000000023', '39000000-0000-4000-8000-000000000011', 'GROUP_CASE', now());

-- rounds are unique per (cycle, kind), so the not-yet-active round lives in the closed cycle.
insert into rush.rounds(id, cycle_id, kind, name, status, weight) values
  ('39000000-0000-4000-8000-000000000051', '39000000-0000-4000-8000-000000000011', 'GROUP_CASE', 'Group Case', 'ACTIVE', 40),
  ('39000000-0000-4000-8000-000000000052', '39000000-0000-4000-8000-000000000012', 'GROUP_CASE', 'Published Group Case', 'PUBLISHED', 40);
insert into rush.rubrics(id, round_id, version, minimum_observed_criteria) values
  ('39000000-0000-4000-8000-000000000061', '39000000-0000-4000-8000-000000000051', 1, 5);
insert into rush.rubric_criteria(id, rubric_id, key, name, description, weight, required, position) values
  ('39000000-0000-4000-8000-000000000071', '39000000-0000-4000-8000-000000000061', 'collaboration', 'Team Collaboration', '', 25, true, 0),
  ('39000000-0000-4000-8000-000000000072', '39000000-0000-4000-8000-000000000061', 'problem_solving', 'Structured Problem-Solving', '', 13, false, 1),
  ('39000000-0000-4000-8000-000000000073', '39000000-0000-4000-8000-000000000061', 'leadership', 'Leadership & Initiative', '', 12, false, 2),
  ('39000000-0000-4000-8000-000000000074', '39000000-0000-4000-8000-000000000061', 'creativity', 'Creativity & Business Judgment', '', 12, false, 3),
  ('39000000-0000-4000-8000-000000000075', '39000000-0000-4000-8000-000000000061', 'composure', 'Composure & Time Management', '', 25, false, 4),
  ('39000000-0000-4000-8000-000000000076', '39000000-0000-4000-8000-000000000061', 'presentation', 'Presentation & Communication', '', 13, false, 5);
insert into rush.round_participations(round_id, application_id, rubric_id, required_evaluators, assignment_policy, advanced_by) values
  ('39000000-0000-4000-8000-000000000051', '39000000-0000-4000-8000-000000000031', '39000000-0000-4000-8000-000000000061', 1, '{}'::jsonb, '39000000-0000-4000-8000-000000000001'),
  ('39000000-0000-4000-8000-000000000051', '39000000-0000-4000-8000-000000000032', '39000000-0000-4000-8000-000000000061', 1, '{}'::jsonb, '39000000-0000-4000-8000-000000000001'),
  ('39000000-0000-4000-8000-000000000051', '39000000-0000-4000-8000-000000000033', '39000000-0000-4000-8000-000000000061', 1, '{}'::jsonb, '39000000-0000-4000-8000-000000000001');

set local role postgres;
set local "request.jwt.claim.sub" = '39000000-0000-4000-8000-000000000002';
set local "request.jwt.claims" = '{"iss":"https://grading-contracts.example.invalid","sub":"39000000-0000-4000-8000-000000000002","role":"authenticated"}';
set local role authenticated;
select set_config('test.group_case_receipt', pg_temp.rate_group_case_compat('39000000-0000-4000-8000-000000000051', '39000000-0000-4000-8000-000000000031', '{"39000000-0000-4000-8000-000000000071": null, "39000000-0000-4000-8000-000000000072": null, "39000000-0000-4000-8000-000000000073": null, "39000000-0000-4000-8000-000000000074": null, "39000000-0000-4000-8000-000000000075": null, "39000000-0000-4000-8000-000000000076": null}'::jsonb, 'Observation only')::text, true);
select extensions.is(current_setting('test.group_case_receipt')::jsonb->'quality', '{"valid":false,"coverage":0,"observedCount":0,"criteriaCount":6,"minimumObserved":5,"missingRequired":["Team Collaboration"]}'::jsonb, 'note-only receipt exposes canonical blockers');
select extensions.is((select applicant from jsonb_array_elements(rush.group_case_roster('39000000-0000-4000-8000-000000000051')->'groups') g, jsonb_array_elements(g->'applicants') applicant where applicant->>'applicationId' = '39000000-0000-4000-8000-000000000031')->'quality', current_setting('test.group_case_receipt')::jsonb->'quality', 'own roster reload agrees with save receipt');
select extensions.is((select applicant from jsonb_array_elements(rush.group_case_roster('39000000-0000-4000-8000-000000000051')->'groups') g, jsonb_array_elements(g->'applicants') applicant where applicant->>'applicationId' = '39000000-0000-4000-8000-000000000031')->>'note', 'Observation only', 'own roster retains observation-only evidence');
select extensions.ok(not has_function_privilege('authenticated', 'rush.evaluation_observation_quality(text)', 'EXECUTE'), 'canonical helper stays private');
set local role postgres;
set local "request.jwt.claim.sub" = '39000000-0000-4000-8000-000000000003';
set local "request.jwt.claims" = '{"iss":"https://grading-contracts.example.invalid","sub":"39000000-0000-4000-8000-000000000003","role":"authenticated"}';
set local role authenticated;
select extensions.is((select applicant from jsonb_array_elements(rush.group_case_roster('39000000-0000-4000-8000-000000000051')->'groups') g, jsonb_array_elements(g->'applicants') applicant where applicant->>'applicationId' = '39000000-0000-4000-8000-000000000031')->'quality', 'null'::jsonb, 'another member cannot see own reviewer quality');
select extensions.is((select applicant from jsonb_array_elements(rush.group_case_roster('39000000-0000-4000-8000-000000000051')->'groups') g, jsonb_array_elements(g->'applicants') applicant where applicant->>'applicationId' = '39000000-0000-4000-8000-000000000031')->>'note', '', 'another member cannot see observation evidence');
set local role postgres;
set local "request.jwt.claim.sub" = '39000000-0000-4000-8000-000000000002';
set local "request.jwt.claims" = '{"iss":"https://grading-contracts.example.invalid","sub":"39000000-0000-4000-8000-000000000002","role":"authenticated"}';
set local role authenticated;
select set_config('test.group_case_receipt', pg_temp.rate_group_case_compat('39000000-0000-4000-8000-000000000051', '39000000-0000-4000-8000-000000000031', '{"39000000-0000-4000-8000-000000000071": 4, "39000000-0000-4000-8000-000000000072": 4, "39000000-0000-4000-8000-000000000073": null, "39000000-0000-4000-8000-000000000074": 4, "39000000-0000-4000-8000-000000000075": 4, "39000000-0000-4000-8000-000000000076": null}'::jsonb, '')::text, true);
select extensions.is(current_setting('test.group_case_receipt')::jsonb#>>'{quality,valid}', 'false', '75 percent coverage still requires rubric observation minimum');
select set_config('test.group_case_receipt', pg_temp.rate_group_case_compat('39000000-0000-4000-8000-000000000051', '39000000-0000-4000-8000-000000000031', '{"39000000-0000-4000-8000-000000000071": null, "39000000-0000-4000-8000-000000000072": 4, "39000000-0000-4000-8000-000000000073": 4, "39000000-0000-4000-8000-000000000074": 4, "39000000-0000-4000-8000-000000000075": 4, "39000000-0000-4000-8000-000000000076": 4}'::jsonb, '')::text, true);
select extensions.is(current_setting('test.group_case_receipt')::jsonb#>'{quality,missingRequired}', '["Team Collaboration"]'::jsonb, 'five observations still expose required criterion blocker');
select set_config('test.group_case_receipt', pg_temp.rate_group_case_compat('39000000-0000-4000-8000-000000000051', '39000000-0000-4000-8000-000000000031', '{"39000000-0000-4000-8000-000000000071": 4, "39000000-0000-4000-8000-000000000072": 4, "39000000-0000-4000-8000-000000000073": 4, "39000000-0000-4000-8000-000000000074": 4, "39000000-0000-4000-8000-000000000075": null, "39000000-0000-4000-8000-000000000076": 4}'::jsonb, '')::text, true);
select extensions.is(current_setting('test.group_case_receipt')::jsonb#>>'{quality,valid}', 'true', 'five observations with required criterion and 75 percent weight qualify');
select extensions.is((select applicant from jsonb_array_elements(rush.group_case_roster('39000000-0000-4000-8000-000000000051')->'groups') g, jsonb_array_elements(g->'applicants') applicant where applicant->>'applicationId' = '39000000-0000-4000-8000-000000000031')->'quality', current_setting('test.group_case_receipt')::jsonb->'quality', 'qualifying roster and save verdict agree');
select * from extensions.finish();
rollback;
