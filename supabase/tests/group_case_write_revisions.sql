begin;
set local role postgres;
set local search_path = extensions, public;
select extensions.plan(30);

insert into auth.users(id, email, raw_user_meta_data) values
  ('59000000-0000-4000-8000-000000000001', 'gc-owner@example.invalid', '{"display_name":"Group Case owner"}'::jsonb),
  ('59000000-0000-4000-8000-000000000002', 'gc-member-one@example.invalid', '{"display_name":"Group Case member one"}'::jsonb),
  ('59000000-0000-4000-8000-000000000003', 'gc-member-two@example.invalid', '{"display_name":"Group Case member two"}'::jsonb),
  ('59000000-0000-4000-8000-000000000004', 'gc-committee@example.invalid', '{"display_name":"Group Case committee"}'::jsonb);

-- Synthetic subjects are mapped explicitly through the production identity contract.
insert into rush.auth_identities(issuer,subject,app_user_id)
 select 'https://grading-contracts.example.invalid', id::text, id from rush.profiles
 where id::text like '59000000-%';

-- rush_cycles_one_non_terminal_idx allows one live cycle at a time.
update rush.rush_cycles set status = 'CLOSED' where status in ('DRAFT', 'OPEN', 'IN_PROCESS', 'DECISION_LOCK');
insert into rush.rush_cycles(id, name, status) values
  ('59000000-0000-4000-8000-000000000011', 'Group Case open cycle', 'OPEN'),
  ('59000000-0000-4000-8000-000000000012', 'Group Case closed cycle', 'CLOSED');
insert into rush.memberships(user_id, cycle_id, role) values
  ('59000000-0000-4000-8000-000000000001', '59000000-0000-4000-8000-000000000011', 'OWNER'),
  ('59000000-0000-4000-8000-000000000002', '59000000-0000-4000-8000-000000000011', 'MEMBER'),
  ('59000000-0000-4000-8000-000000000003', '59000000-0000-4000-8000-000000000011', 'MEMBER'),
  ('59000000-0000-4000-8000-000000000004', '59000000-0000-4000-8000-000000000011', 'RECRUITMENT_COMMITTEE');

insert into rush.pnms(id, name, contact, normalized_contact, uniqname) values
  ('59000000-0000-4000-8000-000000000021', 'Alpha Applicant', 'gcalpha@umich.edu', 'gcalpha@umich.edu', 'gcalpha'),
  ('59000000-0000-4000-8000-000000000022', 'Bravo Applicant', 'gcbravo@umich.edu', 'gcbravo@umich.edu', 'gcbravo'),
  ('59000000-0000-4000-8000-000000000023', 'Charlie Applicant', 'gccharlie@umich.edu', 'gccharlie@umich.edu', 'gccharlie');
insert into rush.applications(id, pnm_id, cycle_id, status, submitted_at) values
  ('59000000-0000-4000-8000-000000000031', '59000000-0000-4000-8000-000000000021', '59000000-0000-4000-8000-000000000011', 'GROUP_CASE', now()),
  ('59000000-0000-4000-8000-000000000032', '59000000-0000-4000-8000-000000000022', '59000000-0000-4000-8000-000000000011', 'GROUP_CASE', now()),
  ('59000000-0000-4000-8000-000000000033', '59000000-0000-4000-8000-000000000023', '59000000-0000-4000-8000-000000000011', 'GROUP_CASE', now());

-- rounds are unique per (cycle, kind), so the not-yet-active round lives in the closed cycle.
insert into rush.rounds(id, cycle_id, kind, name, status, weight) values
  ('59000000-0000-4000-8000-000000000051', '59000000-0000-4000-8000-000000000011', 'GROUP_CASE', 'Group Case', 'ACTIVE', 40),
  ('59000000-0000-4000-8000-000000000052', '59000000-0000-4000-8000-000000000012', 'GROUP_CASE', 'Published Group Case', 'PUBLISHED', 40);
insert into rush.rubrics(id, round_id, version, minimum_observed_criteria) values
  ('59000000-0000-4000-8000-000000000061', '59000000-0000-4000-8000-000000000051', 1, 5);
insert into rush.rubric_criteria(id, rubric_id, key, name, description, weight, required, position) values
  ('59000000-0000-4000-8000-000000000071', '59000000-0000-4000-8000-000000000061', 'collaboration', 'Team Collaboration', '', 25, true, 0),
  ('59000000-0000-4000-8000-000000000072', '59000000-0000-4000-8000-000000000061', 'problem_solving', 'Structured Problem-Solving', '', 13, false, 1),
  ('59000000-0000-4000-8000-000000000073', '59000000-0000-4000-8000-000000000061', 'leadership', 'Leadership & Initiative', '', 12, false, 2),
  ('59000000-0000-4000-8000-000000000074', '59000000-0000-4000-8000-000000000061', 'creativity', 'Creativity & Business Judgment', '', 12, false, 3),
  ('59000000-0000-4000-8000-000000000075', '59000000-0000-4000-8000-000000000061', 'composure', 'Composure & Time Management', '', 25, false, 4),
  ('59000000-0000-4000-8000-000000000076', '59000000-0000-4000-8000-000000000061', 'presentation', 'Presentation & Communication', '', 13, false, 5);
insert into rush.round_participations(round_id, application_id, rubric_id, required_evaluators, assignment_policy, advanced_by) values
  ('59000000-0000-4000-8000-000000000051', '59000000-0000-4000-8000-000000000031', '59000000-0000-4000-8000-000000000061', 1, '{}'::jsonb, '59000000-0000-4000-8000-000000000001'),
  ('59000000-0000-4000-8000-000000000051', '59000000-0000-4000-8000-000000000032', '59000000-0000-4000-8000-000000000061', 1, '{}'::jsonb, '59000000-0000-4000-8000-000000000001'),
  ('59000000-0000-4000-8000-000000000051', '59000000-0000-4000-8000-000000000033', '59000000-0000-4000-8000-000000000061', 1, '{}'::jsonb, '59000000-0000-4000-8000-000000000001');


set local "request.jwt.claims" = '{"iss":"https://grading-contracts.example.invalid","sub":"59000000-0000-4000-8000-000000000002","role":"authenticated"}';
select extensions.ok(not has_function_privilege('authenticated','rush.rate_group_case_applicant(text,text,jsonb,text)','EXECUTE'),'unconditional browser write is revoked');
select extensions.ok(not has_function_privilege('anon','rush.rate_group_case_applicant_v2(text,text,jsonb,text,uuid,uuid)','EXECUTE'),'anonymous revision writes are denied');
select extensions.ok(not has_function_privilege('authenticated','rush.group_case_rating_snapshot(text,text,uuid)','EXECUTE'),'canonical own snapshot helper is private');
select extensions.ok(not has_table_privilege('authenticated','rush.group_case_write_revisions','SELECT'),'revision state is private');
set local role authenticated;
select extensions.is((rush.group_case_roster_v2('59000000-0000-4000-8000-000000000051')#>'{groups,0,applicants,0}')?'revision',true,'roster always contains revision field');
select extensions.is(rush.group_case_roster_v2('59000000-0000-4000-8000-000000000051')#>'{groups,0,applicants,0,revision}','null'::jsonb,'unsaved observation has null revision');
select set_config('test.gc_first',rush.rate_group_case_applicant_v2('59000000-0000-4000-8000-000000000051','59000000-0000-4000-8000-000000000031','{"59000000-0000-4000-8000-000000000071":4}','First',null,'10000000-0000-4000-8000-000000000001')::text,true);
select extensions.is(current_setting('test.gc_first')::jsonb->>'kind','saved','first revision save succeeds');
select extensions.ok((current_setting('test.gc_first')::jsonb->>'revision') is not null,'save issues revision token');
select extensions.is(rush.rate_group_case_applicant_v2('59000000-0000-4000-8000-000000000051','59000000-0000-4000-8000-000000000031','{"59000000-0000-4000-8000-000000000071":4}','First',null,'10000000-0000-4000-8000-000000000001'),current_setting('test.gc_first')::jsonb,'exact mutation retry returns identical confirmed result');
select extensions.throws_ok($$select rush.rate_group_case_applicant_v2('59000000-0000-4000-8000-000000000051','59000000-0000-4000-8000-000000000031','{"59000000-0000-4000-8000-000000000071":5}','First',null,'10000000-0000-4000-8000-000000000001')$$,'22023','mutation id reused with different payload','same mutation cannot change payload');
select extensions.is(rush.rate_group_case_applicant_v2('59000000-0000-4000-8000-000000000051','59000000-0000-4000-8000-000000000031','{"59000000-0000-4000-8000-000000000071":5}','Other tab',null,'10000000-0000-4000-8000-000000000002')->>'kind','conflict','stale first-save token conflicts');
select set_config('test.gc_second',rush.rate_group_case_applicant_v2('59000000-0000-4000-8000-000000000051','59000000-0000-4000-8000-000000000031','{"59000000-0000-4000-8000-000000000071":5}','Newer',(current_setting('test.gc_first')::jsonb->>'revision')::uuid,'10000000-0000-4000-8000-000000000003')::text,true);
select extensions.is(current_setting('test.gc_second')::jsonb->>'kind','saved','current revision supports new mutation');
select extensions.is(rush.rate_group_case_applicant_v2('59000000-0000-4000-8000-000000000051','59000000-0000-4000-8000-000000000031','{"59000000-0000-4000-8000-000000000071":4}','First',null,'10000000-0000-4000-8000-000000000001')->>'kind','conflict','old mutation after new revision never reapplies');
select extensions.is(rush.group_case_roster_v2('59000000-0000-4000-8000-000000000051')#>>'{groups,0,applicants,0,note}','Newer','old replay does not overwrite newer note');
select extensions.is(rush.group_case_roster_v2('59000000-0000-4000-8000-000000000051')#>'{groups,0,applicants,0,quality}',current_setting('test.gc_second')::jsonb->'quality','v2 save and roster use unchanged canonical quality');
set local role postgres;
select extensions.is((select count(*) from rush.audit_events where action='GROUP_CASE_RATED' and resource_id='59000000-0000-4000-8000-000000000031'),2::bigint,'replay and conflicts create no extra rating audit writes');
update rush.rounds set status='FROZEN' where id='59000000-0000-4000-8000-000000000051';
set local role authenticated;
select extensions.is(rush.rate_group_case_applicant_v2('59000000-0000-4000-8000-000000000051','59000000-0000-4000-8000-000000000031','{"59000000-0000-4000-8000-000000000071":5}','Newer',(current_setting('test.gc_first')::jsonb->>'revision')::uuid,'10000000-0000-4000-8000-000000000003'),current_setting('test.gc_second')::jsonb,'closed round exact replay confirms committed save without writing');
select extensions.throws_ok($$select rush.rate_group_case_applicant_v2('59000000-0000-4000-8000-000000000051','59000000-0000-4000-8000-000000000031','{"59000000-0000-4000-8000-000000000071":3}','Late',(current_setting('test.gc_second')::jsonb->>'revision')::uuid,'10000000-0000-4000-8000-000000000004')$$,'55000','round is not open for grading','closed round rejects a new write');
set local role postgres;
update rush.rounds set status='ACTIVE',closes_at=now()-interval '1 minute' where id='59000000-0000-4000-8000-000000000051';
set local role authenticated;
select extensions.is(rush.rate_group_case_applicant_v2('59000000-0000-4000-8000-000000000051','59000000-0000-4000-8000-000000000031','{"59000000-0000-4000-8000-000000000071":5}','Newer',(current_setting('test.gc_first')::jsonb->>'revision')::uuid,'10000000-0000-4000-8000-000000000003')->>'kind','saved','expired deadline permits read-only exact confirmation');
select extensions.throws_ok($$select rush.rate_group_case_applicant_v2('59000000-0000-4000-8000-000000000051','59000000-0000-4000-8000-000000000031','{"59000000-0000-4000-8000-000000000071":3}','Late',(current_setting('test.gc_second')::jsonb->>'revision')::uuid,'10000000-0000-4000-8000-000000000004')$$,'55000','round is not open for grading','expired deadline rejects a new write');
set local role postgres;
update rush.rounds set closes_at=null where id='59000000-0000-4000-8000-000000000051';
insert into rush.rubrics(id,round_id,version,minimum_observed_criteria) values('gc-new-rubric','59000000-0000-4000-8000-000000000051',2,1);
set local role authenticated;
select extensions.is(rush.rate_group_case_applicant_v2('59000000-0000-4000-8000-000000000051','59000000-0000-4000-8000-000000000031','{"59000000-0000-4000-8000-000000000071":5}','Newer',(current_setting('test.gc_first')::jsonb->>'revision')::uuid,'10000000-0000-4000-8000-000000000003')->>'kind','conflict','changed active rubric never replays stale quality');
select extensions.is(rush.rate_group_case_applicant_v2('59000000-0000-4000-8000-000000000051','59000000-0000-4000-8000-000000000031','{"59000000-0000-4000-8000-000000000071":5}','Newer',(current_setting('test.gc_first')::jsonb->>'revision')::uuid,'10000000-0000-4000-8000-000000000003')#>'{snapshot,quality}','null'::jsonb,'conflict snapshot uses current rubric validity');
set local role postgres;
delete from rush.rubrics where id='gc-new-rubric';
update rush.memberships set active=false where user_id='59000000-0000-4000-8000-000000000002';
set local role authenticated;
select extensions.throws_ok($$select rush.rate_group_case_applicant_v2('59000000-0000-4000-8000-000000000051','59000000-0000-4000-8000-000000000031','{"59000000-0000-4000-8000-000000000071":5}','Newer',(current_setting('test.gc_first')::jsonb->>'revision')::uuid,'10000000-0000-4000-8000-000000000003')$$,'42501','forbidden','revoked role cannot obtain replay');
set local role postgres;
update rush.memberships set active=true where user_id='59000000-0000-4000-8000-000000000002';
insert into rush.conflict_declarations(application_id,declarer_id,reason) values('59000000-0000-4000-8000-000000000031','59000000-0000-4000-8000-000000000002','Synthetic recusal');
set local role authenticated;
select extensions.throws_ok($$select rush.rate_group_case_applicant_v2('59000000-0000-4000-8000-000000000051','59000000-0000-4000-8000-000000000031','{"59000000-0000-4000-8000-000000000071":5}','Newer',(current_setting('test.gc_first')::jsonb->>'revision')::uuid,'10000000-0000-4000-8000-000000000003')$$,'42501','conflict declared','recusal cannot obtain replay');
set local role postgres;
delete from rush.conflict_declarations where application_id='59000000-0000-4000-8000-000000000031';
update rush.applications set status='WITHDRAWN' where id='59000000-0000-4000-8000-000000000031';
set local role authenticated;
select extensions.throws_ok($$select rush.rate_group_case_applicant_v2('59000000-0000-4000-8000-000000000051','59000000-0000-4000-8000-000000000031','{"59000000-0000-4000-8000-000000000071":5}','Newer',(current_setting('test.gc_first')::jsonb->>'revision')::uuid,'10000000-0000-4000-8000-000000000003')$$,'22023','applicant is not in this round','ineligible applicant cannot obtain replay');
set local role postgres;
update rush.applications set status='GROUP_CASE' where id='59000000-0000-4000-8000-000000000031';
set local "request.jwt.claims" = '{"iss":"https://grading-contracts.example.invalid","sub":"59000000-0000-4000-8000-000000000003","role":"authenticated"}';
set local role authenticated;
select extensions.is(rush.group_case_roster_v2('59000000-0000-4000-8000-000000000051')#>'{groups,0,applicants,0,revision}','null'::jsonb,'another evaluator cannot see revision token');
select extensions.is(rush.group_case_roster_v2('59000000-0000-4000-8000-000000000051')#>>'{groups,0,applicants,0,note}','','another evaluator cannot see observation');
select extensions.throws_ok($$select rush.rate_group_case_applicant_v2('59000000-0000-4000-8000-000000000051','59000000-0000-4000-8000-000000000032','{"59000000-0000-4000-8000-000000000071":4}','',null,null)$$,'22023','mutation id required','missing mutation is rejected');
set local role postgres;
delete from rush.applications where id='59000000-0000-4000-8000-000000000031';
select extensions.is((select count(*) from rush.group_case_write_revisions where application_id='59000000-0000-4000-8000-000000000031'),0::bigint,'application deletion cascades revision state');
select extensions.is((select count(*) from rush.audit_events where action='GROUP_CASE_RATED' and resource_id='59000000-0000-4000-8000-000000000031'),2::bigint,'read-only confirmations never add save events');
select * from extensions.finish();
rollback;
