begin;
set local role postgres;
set local search_path = extensions, public;
select extensions.plan(16);

-- member votes; stranger has no membership; resting has an inactive profile;
-- committee sits on a CLOSED cycle's Recruitment Committee only.
insert into auth.users (id, email, raw_user_meta_data) values
  ('71000000-0000-4000-8000-000000000001', 'mhl-member@example.invalid', '{"display_name":"Hash member"}'),
  ('71000000-0000-4000-8000-000000000002', 'mhl-stranger@example.invalid', '{"display_name":"Stranger"}'),
  ('71000000-0000-4000-8000-000000000003', 'mhl-resting@example.invalid', '{"display_name":"Resting member"}'),
  ('71000000-0000-4000-8000-000000000004', 'mhl-committee@example.invalid', '{"display_name":"Closed committee"}'),
  ('71000000-0000-4000-8000-000000000005', 'mhl-grader@example.invalid', '{"display_name":"Grader"}');
insert into rush.auth_identities (issuer, subject, app_user_id)
select 'https://mhl.example.invalid', id::text, id from rush.profiles where id::text like '71000000-%';
update rush.profiles set active = false where id = '71000000-0000-4000-8000-000000000003';

update rush.rush_cycles set status = 'CLOSED' where status in ('DRAFT', 'OPEN', 'IN_PROCESS', 'DECISION_LOCK');
insert into rush.rush_cycles (id, name, status, hash_stage) values ('mhl-cycle', 'Hash live fixture', 'IN_PROCESS', 'GROUP_CASE');
insert into rush.rush_cycles (id, name, status) values ('mhl-closed', 'Closed fixture', 'CLOSED');
insert into rush.memberships (user_id, cycle_id, role) values
  ('71000000-0000-4000-8000-000000000001', 'mhl-cycle', 'MEMBER'),
  ('71000000-0000-4000-8000-000000000003', 'mhl-cycle', 'MEMBER'),
  ('71000000-0000-4000-8000-000000000004', 'mhl-closed', 'RECRUITMENT_COMMITTEE'),
  ('71000000-0000-4000-8000-000000000005', 'mhl-cycle', 'MEMBER');

insert into rush.pnms (id, name, contact, normalized_contact, major, class_year) values
  ('mhl-pnm-a', 'Avery Presented', 'mhl-a@example.invalid', 'mhl-a@example.invalid', 'Economics', 'SOPHOMORE'),
  ('mhl-pnm-b', 'Blair Other', 'mhl-b@example.invalid', 'mhl-b@example.invalid', null, null),
  ('mhl-pnm-c', 'Casey Offballot', 'mhl-c@example.invalid', 'mhl-c@example.invalid', null, null),
  ('mhl-pnm-d', 'Drew Conflicted', 'mhl-d@example.invalid', 'mhl-d@example.invalid', null, null);
insert into rush.applications (id, pnm_id, cycle_id, status) values
  ('mhl-app-a', 'mhl-pnm-a', 'mhl-cycle', 'GROUP_CASE'),
  ('mhl-app-b', 'mhl-pnm-b', 'mhl-cycle', 'GROUP_CASE'),
  ('mhl-app-c', 'mhl-pnm-c', 'mhl-cycle', 'SUBMITTED'),
  ('mhl-app-d', 'mhl-pnm-d', 'mhl-cycle', 'GROUP_CASE');
insert into rush.conflict_declarations (application_id, declarer_id, reason) values
  ('mhl-app-d', '71000000-0000-4000-8000-000000000001', 'roommate');
update rush.rush_cycles set hash_presenting_application_id = 'mhl-app-a' where id = 'mhl-cycle';

-- One Group Case note on the presented applicant, written by the grader.
insert into rush.rounds (id, cycle_id, kind, name, status, weight) values ('mhl-round', 'mhl-cycle', 'GROUP_CASE', 'Group Case', 'ACTIVE', 100);
insert into rush.rubrics (id, round_id, version, minimum_observed_criteria) values ('mhl-rubric', 'mhl-round', 1, 1);
insert into rush.evaluation_assignments (id, round_id, application_id, evaluator_id) values
  ('mhl-assignment', 'mhl-round', 'mhl-app-a', '71000000-0000-4000-8000-000000000005');
insert into rush.round_calibration_acknowledgements (round_id, rubric_id, evaluator_id) values ('mhl-round', 'mhl-rubric', '71000000-0000-4000-8000-000000000005');
insert into rush.evaluations (id, assignment_id, evaluator_id, rubric_id, status, evidence) values
  ('mhl-evaluation', 'mhl-assignment', '71000000-0000-4000-8000-000000000005', 'mhl-rubric', 'LOCKED', 'Pulled a quiet teammate in.');

select extensions.ok(
  exists(select 1 from pg_proc p where p.oid = 'rush.member_hash_live(text,text)'::regprocedure and p.prosecdef and p.proconfig @> array['search_path=""']),
  'member_hash_live is a hardened security definer'
);
select extensions.ok(
  has_function_privilege('authenticated', 'rush.member_hash_live(text,text)', 'EXECUTE')
    and not has_function_privilege('anon', 'rush.member_hash_live(text,text)', 'EXECUTE'),
  'only signed-in callers can poll the hash'
);

set local "request.jwt.claims" = '{"iss":"https://mhl.example.invalid","sub":"71000000-0000-4000-8000-000000000001","role":"authenticated"}';
set local role authenticated;
select extensions.is(rush.member_hash_live('mhl-cycle', '') -> 'presenting' ->> 'id', 'mhl-app-a', 'a voter sees the presented applicant');
select extensions.is(rush.member_hash_live('mhl-cycle', '') -> 'presenting' ->> 'major', 'Economics', 'the presented row carries the ballot metadata');
select extensions.is(rush.member_hash_live('mhl-cycle', '') ->> 'applicationId', 'mhl-app-a', 'with no request the notes follow the presenter');
select extensions.is(rush.member_hash_live('mhl-cycle', '') -> 'notes', '[{"note": "Pulled a quiet teammate in.", "source": "GROUP_CASE"}]'::jsonb, 'the presenter''s grader notes come back');
select extensions.is(
  rush.member_hash_live('mhl-cycle', '') -> 'notes',
  (select coalesce(jsonb_agg(jsonb_build_object('source', n.source, 'note', n.note)), '[]'::jsonb) from rush.hash_applicant_notes('mhl-app-a') n),
  'notes are exactly what hash_applicant_notes returns'
);
select extensions.is(rush.member_hash_live('mhl-cycle', 'mhl-app-b') ->> 'applicationId', 'mhl-app-b', 'a requested ballot applicant is shown');
select extensions.is(rush.member_hash_live('mhl-cycle', 'mhl-app-c') ->> 'applicationId', null, 'an applicant off the ballot is never shown');
select extensions.is(rush.member_hash_live('mhl-cycle', 'mhl-app-d') ->> 'applicationId', null, 'a conflicted applicant is never shown');
select extensions.is(rush.member_hash_live(null, '') ->> 'cycleId', 'mhl-cycle', 'without a selection the member''s workspace cycle is used');
select extensions.throws_ok($$select rush.member_hash_live('mhl-closed', '')$$, '42501', 'forbidden', 'a cycle the member does not belong to is refused');

set local "request.jwt.claims" = '{"iss":"https://mhl.example.invalid","sub":"71000000-0000-4000-8000-000000000002","role":"authenticated"}';
select extensions.throws_ok($$select rush.member_hash_live(null, '')$$, '42501', 'forbidden', 'a signed-in person without a membership is refused');

set local "request.jwt.claims" = '{"iss":"https://mhl.example.invalid","sub":"71000000-0000-4000-8000-000000000003","role":"authenticated"}';
select extensions.throws_ok($$select rush.member_hash_live('mhl-cycle', '')$$, '28000', 'unauthorized', 'an inactive profile is treated as signed out');

set local "request.jwt.claims" = '{"iss":"https://mhl.example.invalid","sub":"71000000-0000-4000-8000-000000000004","role":"authenticated"}';
select extensions.throws_ok($$select rush.member_hash_live('mhl-closed', '')$$, '42501', 'forbidden', 'a committee seat on a closed cycle has no workspace access');

set local "request.jwt.claims" = '{"iss":"https://mhl.example.invalid","sub":"71000000-0000-4000-8000-0000000000ff","role":"authenticated"}';
select extensions.throws_ok($$select rush.member_hash_live(null, '')$$, '28000', 'unauthorized', 'an unmapped sign-in is treated as signed out');

select * from extensions.finish();
rollback;
