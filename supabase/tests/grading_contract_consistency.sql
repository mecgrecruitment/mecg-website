begin;
set local role postgres;
set local search_path = extensions, public;
select extensions.plan(37);

-- Retain these grading fixtures through the revision-guarded public boundary.
create function pg_temp.submit_evaluation_compat(target_assignment_id text,submitted_ratings jsonb,submitted_evidence text)
returns table(evaluation_id text,score numeric) language plpgsql as $$
declare receipt jsonb;
begin
  receipt:=rush.submit_evaluation_v2(target_assignment_id,submitted_ratings,submitted_evidence,
    (rush.get_evaluation_draft_v2(target_assignment_id)->>'revision')::uuid);
  if receipt->>'kind'<>'submitted' then raise exception 'fixture revision conflict' using errcode='40001'; end if;
  evaluation_id:=receipt->>'evaluationId';score:=(receipt->>'score')::numeric;return next;
end $$;

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
  ('31000000-0000-4000-8000-000000000001', 'gc-owner@example.invalid', '{"display_name":"Group Case owner"}'::jsonb),
  ('31000000-0000-4000-8000-000000000002', 'gc-member-one@example.invalid', '{"display_name":"Group Case member one"}'::jsonb),
  ('31000000-0000-4000-8000-000000000003', 'gc-member-two@example.invalid', '{"display_name":"Group Case member two"}'::jsonb),
  ('31000000-0000-4000-8000-000000000004', 'gc-committee@example.invalid', '{"display_name":"Group Case committee"}'::jsonb);

-- Synthetic subjects are mapped explicitly through the production identity contract.
insert into rush.auth_identities(issuer,subject,app_user_id)
 select 'https://grading-contracts.example.invalid', id::text, id from rush.profiles
 where id::text like '31000000-%';

-- rush_cycles_one_non_terminal_idx allows one live cycle at a time.
update rush.rush_cycles set status = 'CLOSED' where status in ('DRAFT', 'OPEN', 'IN_PROCESS', 'DECISION_LOCK');
insert into rush.rush_cycles(id, name, status) values
  ('31000000-0000-4000-8000-000000000011', 'Group Case open cycle', 'OPEN'),
  ('31000000-0000-4000-8000-000000000012', 'Group Case closed cycle', 'CLOSED');
insert into rush.memberships(user_id, cycle_id, role) values
  ('31000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000011', 'OWNER'),
  ('31000000-0000-4000-8000-000000000002', '31000000-0000-4000-8000-000000000011', 'MEMBER'),
  ('31000000-0000-4000-8000-000000000003', '31000000-0000-4000-8000-000000000011', 'MEMBER'),
  ('31000000-0000-4000-8000-000000000004', '31000000-0000-4000-8000-000000000011', 'RECRUITMENT_COMMITTEE');

insert into rush.pnms(id, name, contact, normalized_contact, uniqname) values
  ('31000000-0000-4000-8000-000000000021', 'Alpha Applicant', 'gcalpha@umich.edu', 'gcalpha@umich.edu', 'gcalpha'),
  ('31000000-0000-4000-8000-000000000022', 'Bravo Applicant', 'gcbravo@umich.edu', 'gcbravo@umich.edu', 'gcbravo'),
  ('31000000-0000-4000-8000-000000000023', 'Charlie Applicant', 'gccharlie@umich.edu', 'gccharlie@umich.edu', 'gccharlie');
insert into rush.applications(id, pnm_id, cycle_id, status, submitted_at) values
  ('31000000-0000-4000-8000-000000000031', '31000000-0000-4000-8000-000000000021', '31000000-0000-4000-8000-000000000011', 'GROUP_CASE', now()),
  ('31000000-0000-4000-8000-000000000032', '31000000-0000-4000-8000-000000000022', '31000000-0000-4000-8000-000000000011', 'GROUP_CASE', now()),
  ('31000000-0000-4000-8000-000000000033', '31000000-0000-4000-8000-000000000023', '31000000-0000-4000-8000-000000000011', 'GROUP_CASE', now());

-- rounds are unique per (cycle, kind), so the not-yet-active round lives in the closed cycle.
insert into rush.rounds(id, cycle_id, kind, name, status, weight) values
  ('31000000-0000-4000-8000-000000000051', '31000000-0000-4000-8000-000000000011', 'GROUP_CASE', 'Group Case', 'ACTIVE', 40),
  ('31000000-0000-4000-8000-000000000052', '31000000-0000-4000-8000-000000000012', 'GROUP_CASE', 'Published Group Case', 'PUBLISHED', 40);
insert into rush.rubrics(id, round_id, version, minimum_observed_criteria) values
  ('31000000-0000-4000-8000-000000000061', '31000000-0000-4000-8000-000000000051', 1, 5);
insert into rush.rubric_criteria(id, rubric_id, key, name, description, weight, required, position) values
  ('31000000-0000-4000-8000-000000000071', '31000000-0000-4000-8000-000000000061', 'collaboration', 'Team Collaboration', '', 25, true, 0),
  ('31000000-0000-4000-8000-000000000072', '31000000-0000-4000-8000-000000000061', 'problem_solving', 'Structured Problem-Solving', '', 13, false, 1),
  ('31000000-0000-4000-8000-000000000073', '31000000-0000-4000-8000-000000000061', 'leadership', 'Leadership & Initiative', '', 12, false, 2),
  ('31000000-0000-4000-8000-000000000074', '31000000-0000-4000-8000-000000000061', 'creativity', 'Creativity & Business Judgment', '', 12, false, 3),
  ('31000000-0000-4000-8000-000000000075', '31000000-0000-4000-8000-000000000061', 'composure', 'Composure & Time Management', '', 25, false, 4),
  ('31000000-0000-4000-8000-000000000076', '31000000-0000-4000-8000-000000000061', 'presentation', 'Presentation & Communication', '', 13, false, 5);
insert into rush.round_participations(round_id, application_id, rubric_id, required_evaluators, assignment_policy, advanced_by) values
  ('31000000-0000-4000-8000-000000000051', '31000000-0000-4000-8000-000000000031', '31000000-0000-4000-8000-000000000061', 1, '{}'::jsonb, '31000000-0000-4000-8000-000000000001'),
  ('31000000-0000-4000-8000-000000000051', '31000000-0000-4000-8000-000000000032', '31000000-0000-4000-8000-000000000061', 1, '{}'::jsonb, '31000000-0000-4000-8000-000000000001'),
  ('31000000-0000-4000-8000-000000000051', '31000000-0000-4000-8000-000000000033', '31000000-0000-4000-8000-000000000061', 1, '{}'::jsonb, '31000000-0000-4000-8000-000000000001');

-- The fixture intentionally requires five observations, demonstrating that the
-- rubric minimum is independent of weighted coverage (not a policy change).
insert into rush.rounds(id, cycle_id, kind, name, status, weight) values
 ('contract-sd', '31000000-0000-4000-8000-000000000011', 'SPEED_DATING', 'Contract Speed Dating', 'ACTIVE', 40);
insert into rush.rubrics(id, round_id, version, minimum_observed_criteria) values ('contract-sd-rubric','contract-sd',1,1);
insert into rush.rubric_criteria(id,rubric_id,key,name,weight,required,position) values
 ('contract-sd-criterion','contract-sd-rubric','overall','Overall',100,true,0);
insert into rush.round_participations(round_id,application_id,rubric_id,required_evaluators,assignment_policy,advanced_by)
 select 'contract-sd', id, 'contract-sd-rubric', 2, '{}'::jsonb, '31000000-0000-4000-8000-000000000001'
 from rush.applications where cycle_id='31000000-0000-4000-8000-000000000011';

set local role postgres;
set local "request.jwt.claim.sub" = '31000000-0000-4000-8000-000000000002';
set local "request.jwt.claims" = '{"iss":"https://grading-contracts.example.invalid","sub":"31000000-0000-4000-8000-000000000002","role":"authenticated"}';
set local role authenticated;
select pg_temp.rate_group_case_compat('31000000-0000-4000-8000-000000000051','31000000-0000-4000-8000-000000000031','{"31000000-0000-4000-8000-000000000071": null, "31000000-0000-4000-8000-000000000072": null, "31000000-0000-4000-8000-000000000073": null, "31000000-0000-4000-8000-000000000074": null, "31000000-0000-4000-8000-000000000075": null, "31000000-0000-4000-8000-000000000076": null}'::jsonb,'Only a note');
set local role postgres;
set local "request.jwt.claim.sub" = '31000000-0000-4000-8000-000000000001';
set local "request.jwt.claims" = '{"iss":"https://grading-contracts.example.invalid","sub":"31000000-0000-4000-8000-000000000001","role":"authenticated"}';
set local role authenticated;
select extensions.is((select a #>> '{savedCount}' from jsonb_array_elements(rush.group_case_results('31000000-0000-4000-8000-000000000051')->'applicants') a where a->>'applicationId'='31000000-0000-4000-8000-000000000031'), '1', 'note-only evidence remains saved');
select extensions.is((select a #>> '{count}' from jsonb_array_elements(rush.group_case_results('31000000-0000-4000-8000-000000000051')->'applicants') a where a->>'applicationId'='31000000-0000-4000-8000-000000000031'), '0', 'note-only evidence is not valid');
select extensions.is((select a #>> '{mean}' from jsonb_array_elements(rush.group_case_results('31000000-0000-4000-8000-000000000051')->'applicants') a where a->>'applicationId'='31000000-0000-4000-8000-000000000031'), null::text, 'note-only evidence cannot supply a round mean');
select extensions.is((select a #>> '{evaluations,0,coverage}' from jsonb_array_elements(rush.group_case_results('31000000-0000-4000-8000-000000000051')->'applicants') a where a->>'applicationId'='31000000-0000-4000-8000-000000000031'), '0', 'note-only coverage is zero');
select extensions.is((select a #>> '{evaluations,0,weighted}' from jsonb_array_elements(rush.group_case_results('31000000-0000-4000-8000-000000000051')->'applicants') a where a->>'applicationId'='31000000-0000-4000-8000-000000000031'), null::text, 'note-only evidence has no weighted score');
select extensions.is((select a #>> '{completionStatus}' from jsonb_array_elements(rush.group_case_results('31000000-0000-4000-8000-000000000051')->'applicants') a where a->>'applicationId'='31000000-0000-4000-8000-000000000031'), 'PENDING', 'note-only evidence stays pending');
set local role postgres;
set local "request.jwt.claim.sub" = '31000000-0000-4000-8000-000000000002';
set local "request.jwt.claims" = '{"iss":"https://grading-contracts.example.invalid","sub":"31000000-0000-4000-8000-000000000002","role":"authenticated"}';
set local role authenticated;
select pg_temp.rate_group_case_compat('31000000-0000-4000-8000-000000000051','31000000-0000-4000-8000-000000000031','{"31000000-0000-4000-8000-000000000071": null, "31000000-0000-4000-8000-000000000072": null, "31000000-0000-4000-8000-000000000073": null, "31000000-0000-4000-8000-000000000074": null, "31000000-0000-4000-8000-000000000075": null, "31000000-0000-4000-8000-000000000076": 5}'::jsonb,'');
set local role postgres;
set local "request.jwt.claim.sub" = '31000000-0000-4000-8000-000000000001';
set local "request.jwt.claims" = '{"iss":"https://grading-contracts.example.invalid","sub":"31000000-0000-4000-8000-000000000001","role":"authenticated"}';
set local role authenticated;
select extensions.is((select a #>> '{evaluations,0,coverage}' from jsonb_array_elements(rush.group_case_results('31000000-0000-4000-8000-000000000051')->'applicants') a where a->>'applicationId'='31000000-0000-4000-8000-000000000031'), '0.13000000000000000000', 'presentation-only coverage retains actual weight');
select extensions.is((select a #>> '{evaluations,0,weighted}' from jsonb_array_elements(rush.group_case_results('31000000-0000-4000-8000-000000000051')->'applicants') a where a->>'applicationId'='31000000-0000-4000-8000-000000000031'), null::text, 'single perfect presentation cannot become 40 out of 40');
select extensions.is((select a #>> '{evaluations,0,missingRequired,0}' from jsonb_array_elements(rush.group_case_results('31000000-0000-4000-8000-000000000051')->'applicants') a where a->>'applicationId'='31000000-0000-4000-8000-000000000031'), 'Team Collaboration', 'missing required criterion is named');
set local role postgres;
set local "request.jwt.claim.sub" = '31000000-0000-4000-8000-000000000002';
set local "request.jwt.claims" = '{"iss":"https://grading-contracts.example.invalid","sub":"31000000-0000-4000-8000-000000000002","role":"authenticated"}';
set local role authenticated;
select pg_temp.rate_group_case_compat('31000000-0000-4000-8000-000000000051','31000000-0000-4000-8000-000000000031','{"31000000-0000-4000-8000-000000000071": null, "31000000-0000-4000-8000-000000000072": 5, "31000000-0000-4000-8000-000000000073": 5, "31000000-0000-4000-8000-000000000074": 5, "31000000-0000-4000-8000-000000000075": 5, "31000000-0000-4000-8000-000000000076": 5}'::jsonb,'');
set local role postgres;
set local "request.jwt.claim.sub" = '31000000-0000-4000-8000-000000000001';
set local "request.jwt.claims" = '{"iss":"https://grading-contracts.example.invalid","sub":"31000000-0000-4000-8000-000000000001","role":"authenticated"}';
set local role authenticated;
select extensions.is((select a #>> '{evaluations,0,valid}' from jsonb_array_elements(rush.group_case_results('31000000-0000-4000-8000-000000000051')->'applicants') a where a->>'applicationId'='31000000-0000-4000-8000-000000000031'), 'false', '75 percent coverage cannot bypass required collaboration');
set local role postgres;
set local "request.jwt.claim.sub" = '31000000-0000-4000-8000-000000000002';
set local "request.jwt.claims" = '{"iss":"https://grading-contracts.example.invalid","sub":"31000000-0000-4000-8000-000000000002","role":"authenticated"}';
set local role authenticated;
select pg_temp.rate_group_case_compat('31000000-0000-4000-8000-000000000051','31000000-0000-4000-8000-000000000031','{"31000000-0000-4000-8000-000000000071": 4, "31000000-0000-4000-8000-000000000072": 4, "31000000-0000-4000-8000-000000000073": 4, "31000000-0000-4000-8000-000000000074": null, "31000000-0000-4000-8000-000000000075": 4, "31000000-0000-4000-8000-000000000076": null}'::jsonb,'');
set local role postgres;
set local "request.jwt.claim.sub" = '31000000-0000-4000-8000-000000000001';
set local "request.jwt.claims" = '{"iss":"https://grading-contracts.example.invalid","sub":"31000000-0000-4000-8000-000000000001","role":"authenticated"}';
set local role authenticated;
select extensions.is((select a #>> '{evaluations,0,valid}' from jsonb_array_elements(rush.group_case_results('31000000-0000-4000-8000-000000000051')->'applicants') a where a->>'applicationId'='31000000-0000-4000-8000-000000000031'), 'false', '75 percent with four observations cannot bypass a five-criterion minimum');
set local role postgres;
set local "request.jwt.claim.sub" = '31000000-0000-4000-8000-000000000002';
set local "request.jwt.claims" = '{"iss":"https://grading-contracts.example.invalid","sub":"31000000-0000-4000-8000-000000000002","role":"authenticated"}';
set local role authenticated;
select pg_temp.rate_group_case_compat('31000000-0000-4000-8000-000000000051','31000000-0000-4000-8000-000000000031','{"31000000-0000-4000-8000-000000000071": 4, "31000000-0000-4000-8000-000000000072": 4, "31000000-0000-4000-8000-000000000073": 4, "31000000-0000-4000-8000-000000000074": 4, "31000000-0000-4000-8000-000000000075": null, "31000000-0000-4000-8000-000000000076": 4}'::jsonb,'');
set local role postgres;
set local "request.jwt.claim.sub" = '31000000-0000-4000-8000-000000000001';
set local "request.jwt.claims" = '{"iss":"https://grading-contracts.example.invalid","sub":"31000000-0000-4000-8000-000000000001","role":"authenticated"}';
set local role authenticated;
select extensions.is((select a #>> '{evaluations,0,valid}' from jsonb_array_elements(rush.group_case_results('31000000-0000-4000-8000-000000000051')->'applicants') a where a->>'applicationId'='31000000-0000-4000-8000-000000000031'), 'true', 'exactly 75 percent and five observations passes');
select extensions.is((select a #>> '{count}' from jsonb_array_elements(rush.group_case_results('31000000-0000-4000-8000-000000000051')->'applicants') a where a->>'applicationId'='31000000-0000-4000-8000-000000000031'), '1', 'one valid evaluator is counted');
select extensions.is((select a #>> '{mean}' from jsonb_array_elements(rush.group_case_results('31000000-0000-4000-8000-000000000051')->'applicants') a where a->>'applicationId'='31000000-0000-4000-8000-000000000031'), null::text, 'one valid evaluator does not complete a round');
set local role postgres;
set local "request.jwt.claim.sub" = '31000000-0000-4000-8000-000000000002';
set local "request.jwt.claims" = '{"iss":"https://grading-contracts.example.invalid","sub":"31000000-0000-4000-8000-000000000002","role":"authenticated"}';
set local role authenticated;
select pg_temp.rate_group_case_compat('31000000-0000-4000-8000-000000000051','31000000-0000-4000-8000-000000000031','{"31000000-0000-4000-8000-000000000071": 4, "31000000-0000-4000-8000-000000000072": 4, "31000000-0000-4000-8000-000000000073": 4, "31000000-0000-4000-8000-000000000074": 4, "31000000-0000-4000-8000-000000000075": null, "31000000-0000-4000-8000-000000000076": 4}'::jsonb,'Updated note');
set local role postgres;
set local "request.jwt.claim.sub" = '31000000-0000-4000-8000-000000000001';
set local "request.jwt.claims" = '{"iss":"https://grading-contracts.example.invalid","sub":"31000000-0000-4000-8000-000000000001","role":"authenticated"}';
set local role authenticated;
select extensions.is((select a #>> '{count}' from jsonb_array_elements(rush.group_case_results('31000000-0000-4000-8000-000000000051')->'applicants') a where a->>'applicationId'='31000000-0000-4000-8000-000000000031'), '1', 'repeated saves by one evaluator cannot meet independence');
set local role postgres;
select extensions.throws_ok($$insert into rush.evaluation_assignments(round_id,application_id,evaluator_id)
 values ('31000000-0000-4000-8000-000000000051','31000000-0000-4000-8000-000000000031','31000000-0000-4000-8000-000000000002')$$,
 '23505',null,'the database rejects a second assignment for the same evaluator');
-- A correction version remains one independent evaluator, not two evaluations.
insert into rush.evaluations(assignment_id,evaluator_id,rubric_id,version,status,evidence,submitted_at)
 select assignment_id,evaluator_id,rubric_id,version+1,status,evidence,submitted_at
 from rush.evaluations where assignment_id=(select id from rush.evaluation_assignments
 where round_id='31000000-0000-4000-8000-000000000051' and application_id='31000000-0000-4000-8000-000000000031'
 and evaluator_id='31000000-0000-4000-8000-000000000002');
insert into rush.criterion_ratings(evaluation_id,criterion_id,score)
 select newer.id,rating.criterion_id,rating.score
 from rush.evaluations older join rush.evaluations newer on newer.assignment_id=older.assignment_id and newer.version=older.version+1
 join rush.criterion_ratings rating on rating.evaluation_id=older.id
 where newer.evaluator_id='31000000-0000-4000-8000-000000000002';
select extensions.is((select a->>'count' from jsonb_array_elements(rush.group_case_results('31000000-0000-4000-8000-000000000051')->'applicants') a where a->>'applicationId'='31000000-0000-4000-8000-000000000031'),'1','multiple versions by one evaluator remain one valid evaluation');
set local role postgres;
set local "request.jwt.claim.sub" = '31000000-0000-4000-8000-000000000003';
set local "request.jwt.claims" = '{"iss":"https://grading-contracts.example.invalid","sub":"31000000-0000-4000-8000-000000000003","role":"authenticated"}';
set local role authenticated;
select pg_temp.rate_group_case_compat('31000000-0000-4000-8000-000000000051','31000000-0000-4000-8000-000000000031','{"31000000-0000-4000-8000-000000000071": 5, "31000000-0000-4000-8000-000000000072": 5, "31000000-0000-4000-8000-000000000073": 5, "31000000-0000-4000-8000-000000000074": 5, "31000000-0000-4000-8000-000000000075": null, "31000000-0000-4000-8000-000000000076": 5}'::jsonb,'');
set local role postgres;
set local "request.jwt.claim.sub" = '31000000-0000-4000-8000-000000000001';
set local "request.jwt.claims" = '{"iss":"https://grading-contracts.example.invalid","sub":"31000000-0000-4000-8000-000000000001","role":"authenticated"}';
set local role authenticated;
select extensions.is((select a #>> '{count}' from jsonb_array_elements(rush.group_case_results('31000000-0000-4000-8000-000000000051')->'applicants') a where a->>'applicationId'='31000000-0000-4000-8000-000000000031'), '2', 'a second independent valid evaluator meets the count');
select extensions.is((select a #>> '{mean}' from jsonb_array_elements(rush.group_case_results('31000000-0000-4000-8000-000000000051')->'applicants') a where a->>'applicationId'='31000000-0000-4000-8000-000000000031'), '36.0', 'valid scores retain the existing 8 through 40 scale');
select extensions.is((select a #>> '{completionStatus}' from jsonb_array_elements(rush.group_case_results('31000000-0000-4000-8000-000000000051')->'applicants') a where a->>'applicationId'='31000000-0000-4000-8000-000000000031'), 'REVIEW', '25-point disagreement on the 100-point scale enters review');
set local role postgres;
set local "request.jwt.claim.sub" = '31000000-0000-4000-8000-000000000002';
set local "request.jwt.claims" = '{"iss":"https://grading-contracts.example.invalid","sub":"31000000-0000-4000-8000-000000000002","role":"authenticated"}';
set local role authenticated;
select pg_temp.rate_group_case_compat('31000000-0000-4000-8000-000000000051','31000000-0000-4000-8000-000000000032','{"31000000-0000-4000-8000-000000000071": null, "31000000-0000-4000-8000-000000000072": null, "31000000-0000-4000-8000-000000000073": null, "31000000-0000-4000-8000-000000000074": null, "31000000-0000-4000-8000-000000000075": null, "31000000-0000-4000-8000-000000000076": null}'::jsonb,'Observation only');
set local role postgres;
set local "request.jwt.claim.sub" = '31000000-0000-4000-8000-000000000003';
set local "request.jwt.claims" = '{"iss":"https://grading-contracts.example.invalid","sub":"31000000-0000-4000-8000-000000000003","role":"authenticated"}';
set local role authenticated;
select pg_temp.rate_group_case_compat('31000000-0000-4000-8000-000000000051','31000000-0000-4000-8000-000000000032','{"31000000-0000-4000-8000-000000000071": null, "31000000-0000-4000-8000-000000000072": null, "31000000-0000-4000-8000-000000000073": null, "31000000-0000-4000-8000-000000000074": null, "31000000-0000-4000-8000-000000000075": null, "31000000-0000-4000-8000-000000000076": null}'::jsonb,'Independent note only');
set local role postgres;
set local "request.jwt.claim.sub" = '31000000-0000-4000-8000-000000000001';
set local "request.jwt.claims" = '{"iss":"https://grading-contracts.example.invalid","sub":"31000000-0000-4000-8000-000000000001","role":"authenticated"}';
set local role postgres;
update rush.evaluations evaluation set status='LOCKED'
 from rush.evaluation_assignments assignment where assignment.id=evaluation.assignment_id
 and assignment.round_id='31000000-0000-4000-8000-000000000051';
update rush.rounds set status='FROZEN' where id='31000000-0000-4000-8000-000000000051';
-- Ignore the other weighted round solely for the following readiness isolation.
update rush.rounds set weight=0 where id='contract-sd';
select extensions.ok(rush.is_decision_ready('31000000-0000-4000-8000-000000000031'), 'two valid locked evaluations retain decision evidence readiness');
select extensions.ok(not rush.is_decision_ready('31000000-0000-4000-8000-000000000032'), 'two locked note-only saves do not establish decision readiness');
-- A voided evaluation must not remain evidence-ready.
update rush.evaluations evaluation set voided_at=now()
 from rush.evaluation_assignments assignment where assignment.id=evaluation.assignment_id
 and assignment.application_id='31000000-0000-4000-8000-000000000031'
 and assignment.evaluator_id='31000000-0000-4000-8000-000000000003';
select extensions.ok(not rush.is_decision_ready('31000000-0000-4000-8000-000000000031'), 'voided evaluations cannot satisfy decision evidence');
set local role postgres;
set local "request.jwt.claim.sub" = '31000000-0000-4000-8000-000000000002';
set local "request.jwt.claims" = '{"iss":"https://grading-contracts.example.invalid","sub":"31000000-0000-4000-8000-000000000002","role":"authenticated"}';
set local role authenticated;
select rush.rate_speed_dating_applicant('contract-sd','31000000-0000-4000-8000-000000000031',1,4,'');
set local role postgres;
set local "request.jwt.claim.sub" = '31000000-0000-4000-8000-000000000001';
set local "request.jwt.claims" = '{"iss":"https://grading-contracts.example.invalid","sub":"31000000-0000-4000-8000-000000000001","role":"authenticated"}';
set local role postgres;
update rush.applications set status='WITHDRAWN' where id='31000000-0000-4000-8000-000000000031';
set local role postgres;
set local "request.jwt.claim.sub" = '31000000-0000-4000-8000-000000000002';
set local "request.jwt.claims" = '{"iss":"https://grading-contracts.example.invalid","sub":"31000000-0000-4000-8000-000000000002","role":"authenticated"}';
set local role authenticated;
select extensions.throws_ok($$select rush.rate_speed_dating_applicant('contract-sd','31000000-0000-4000-8000-000000000031',1,5,'stale')$$,'22023','applicant is not in this round','a stale Speed Dating screen cannot rate a withdrawn applicant');
set local role postgres;
set local "request.jwt.claim.sub" = '31000000-0000-4000-8000-000000000001';
set local "request.jwt.claims" = '{"iss":"https://grading-contracts.example.invalid","sub":"31000000-0000-4000-8000-000000000001","role":"authenticated"}';
set local role postgres;
update rush.applications set status='DRAFT' where id='31000000-0000-4000-8000-000000000033';
set local role postgres;
set local "request.jwt.claim.sub" = '31000000-0000-4000-8000-000000000002';
set local "request.jwt.claims" = '{"iss":"https://grading-contracts.example.invalid","sub":"31000000-0000-4000-8000-000000000002","role":"authenticated"}';
set local role authenticated;
select extensions.throws_ok($$select rush.rate_speed_dating_applicant('contract-sd','31000000-0000-4000-8000-000000000033',1,5,'')$$,'22023','applicant is not in this round','a draft applicant cannot receive Speed Dating ratings');
set local role postgres;
insert into rush.evaluation_assignments(id,round_id,application_id,evaluator_id) values
 ('legacy-withdrawn','contract-sd','31000000-0000-4000-8000-000000000031','31000000-0000-4000-8000-000000000003'),
 ('legacy-draft','contract-sd','31000000-0000-4000-8000-000000000033','31000000-0000-4000-8000-000000000003'),
 ('legacy-active','contract-sd','31000000-0000-4000-8000-000000000032','31000000-0000-4000-8000-000000000003');
insert into rush.round_calibration_acknowledgements(round_id,rubric_id,evaluator_id)
 values ('contract-sd','contract-sd-rubric','31000000-0000-4000-8000-000000000003');
set local "request.jwt.claim.sub"='31000000-0000-4000-8000-000000000003';
set local "request.jwt.claims"='{"iss":"https://grading-contracts.example.invalid","sub":"31000000-0000-4000-8000-000000000003","role":"authenticated"}';
set local role authenticated;
select extensions.throws_ok($$select * from pg_temp.submit_evaluation_compat('legacy-withdrawn','[{"criterionId":"contract-sd-criterion","score":4,"note":""}]','')$$,
 '22023','applicant is not eligible for evaluation','the legacy assignment form rejects a withdrawn applicant');
select extensions.throws_ok($$select * from pg_temp.submit_evaluation_compat('legacy-draft','[{"criterionId":"contract-sd-criterion","score":4,"note":""}]','')$$,
 '22023','applicant is not eligible for evaluation','the legacy assignment form rejects a draft applicant');
select extensions.is((select score from pg_temp.submit_evaluation_compat('legacy-active','[{"criterionId":"contract-sd-criterion","score":4,"note":""}]','')),
 75::numeric,'an eligible calibrated active assignment can still submit through the legacy form');
set local role postgres;
set local "request.jwt.claim.sub" = '31000000-0000-4000-8000-000000000001';
set local "request.jwt.claims" = '{"iss":"https://grading-contracts.example.invalid","sub":"31000000-0000-4000-8000-000000000001","role":"authenticated"}';
set local role postgres;
update rush.rounds set closes_at=now()-interval '1 second' where id='contract-sd';
set local role postgres;
set local "request.jwt.claim.sub" = '31000000-0000-4000-8000-000000000002';
set local "request.jwt.claims" = '{"iss":"https://grading-contracts.example.invalid","sub":"31000000-0000-4000-8000-000000000002","role":"authenticated"}';
set local role authenticated;
select extensions.throws_ok($$select rush.rate_speed_dating_applicant('contract-sd','31000000-0000-4000-8000-000000000032',1,5,'')$$,'55000','round is not open for grading','Speed Dating rejects late inline saves');
set local role postgres;
set local "request.jwt.claim.sub" = '31000000-0000-4000-8000-000000000001';
set local "request.jwt.claims" = '{"iss":"https://grading-contracts.example.invalid","sub":"31000000-0000-4000-8000-000000000001","role":"authenticated"}';
set local role postgres;
update rush.rounds set status='ACTIVE',closes_at=now()-interval '1 second' where id='31000000-0000-4000-8000-000000000051';
set local role postgres;
set local "request.jwt.claim.sub" = '31000000-0000-4000-8000-000000000002';
set local "request.jwt.claims" = '{"iss":"https://grading-contracts.example.invalid","sub":"31000000-0000-4000-8000-000000000002","role":"authenticated"}';
set local role authenticated;
select extensions.throws_ok($$select pg_temp.rate_group_case_compat('31000000-0000-4000-8000-000000000051','31000000-0000-4000-8000-000000000032','{}','late')$$,'55000','round is not open for grading','Group Case rejects late inline saves');
select extensions.throws_ok($$select * from rush.evaluation_observation_quality('anything')$$,'42501','permission denied for function evaluation_observation_quality','quality helper remains internal to guarded RPCs');
set local role postgres;
set local "request.jwt.claim.sub" = '31000000-0000-4000-8000-000000000001';
set local "request.jwt.claims" = '{"iss":"https://grading-contracts.example.invalid","sub":"31000000-0000-4000-8000-000000000001","role":"authenticated"}';
set local role postgres;
update rush.rounds set closes_at=null,status='FROZEN' where id='contract-sd';
set local role postgres;
set local "request.jwt.claim.sub" = '31000000-0000-4000-8000-000000000002';
set local "request.jwt.claims" = '{"iss":"https://grading-contracts.example.invalid","sub":"31000000-0000-4000-8000-000000000002","role":"authenticated"}';
set local role authenticated;
select extensions.throws_ok($$select rush.rate_speed_dating_applicant('contract-sd','31000000-0000-4000-8000-000000000032',1,5,'')$$,'55000','round is not open for grading','Speed Dating rejects frozen inline saves');
set local role postgres;
set local "request.jwt.claim.sub" = '31000000-0000-4000-8000-000000000001';
set local "request.jwt.claims" = '{"iss":"https://grading-contracts.example.invalid","sub":"31000000-0000-4000-8000-000000000001","role":"authenticated"}';
set local role postgres;
update rush.rounds set closes_at=null,status='PUBLISHED' where id='31000000-0000-4000-8000-000000000051';
set local role postgres;
set local "request.jwt.claim.sub" = '31000000-0000-4000-8000-000000000002';
set local "request.jwt.claims" = '{"iss":"https://grading-contracts.example.invalid","sub":"31000000-0000-4000-8000-000000000002","role":"authenticated"}';
set local role authenticated;
select extensions.throws_ok($$select pg_temp.rate_group_case_compat('31000000-0000-4000-8000-000000000051','31000000-0000-4000-8000-000000000032','{}','early')$$,'55000','round is not open for grading','Group Case rejects published inline saves');
set local role postgres;
set local "request.jwt.claim.sub" = '31000000-0000-4000-8000-000000000001';
set local "request.jwt.claims" = '{"iss":"https://grading-contracts.example.invalid","sub":"31000000-0000-4000-8000-000000000001","role":"authenticated"}';
set local role postgres;
select extensions.is((select rating.score from rush.criterion_ratings rating
 join rush.evaluations evaluation on evaluation.id=rating.evaluation_id
 join rush.evaluation_assignments assignment on assignment.id=evaluation.assignment_id
 where assignment.round_id='contract-sd' and assignment.application_id='31000000-0000-4000-8000-000000000031'),4,'rejected stale saves preserve the original observation');
select extensions.is((select count(*) from rush.evaluation_assignments where round_id='contract-sd' and application_id='31000000-0000-4000-8000-000000000033' and evaluator_id='31000000-0000-4000-8000-000000000002'),0::bigint,'rejected draft saves create no assignment');
select extensions.is((select weight from rush.rounds where id='31000000-0000-4000-8000-000000000051'),40,'grading consistency does not rewrite configured round weights');
select extensions.is((select sum(weight) from rush.rubric_criteria where rubric_id='31000000-0000-4000-8000-000000000061'),100::bigint,'grading consistency preserves rubric weights');
select * from extensions.finish();
rollback;
