begin;
set local role postgres;
set local search_path=extensions,public;
select extensions.plan(31);
-- Completely synthetic identity mapping; no provider-auth relaxation.
insert into auth.users(id,email,raw_user_meta_data)
 select ('42000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
   'close-summary-'||n||'@example.invalid', jsonb_build_object('display_name','Close summary fixture '||n)
 from generate_series(1,8) n;
insert into rush.auth_identities(issuer,subject,app_user_id)
 select 'https://close-summary.example.invalid',id::text,id from rush.profiles
 where id::text like '42000000-%';
update rush.rush_cycles set status='CLOSED' where status in ('DRAFT','OPEN','IN_PROCESS','DECISION_LOCK');
insert into rush.rush_cycles(id,name,status) values ('close-cycle','Close fixture','OPEN'),('close-other','Other fixture','CLOSED');
insert into rush.memberships(user_id,cycle_id,role,active) values
 ('42000000-0000-4000-8000-000000000001','close-cycle','OWNER',true),
 ('42000000-0000-4000-8000-000000000002','close-cycle','MEMBER',true),
 ('42000000-0000-4000-8000-000000000003','close-cycle','MEMBER',true),
 ('42000000-0000-4000-8000-000000000004','close-cycle','PANEL',true),
 ('42000000-0000-4000-8000-000000000005','close-other','OWNER',true),
 ('42000000-0000-4000-8000-000000000006','close-cycle','RECRUITMENT_COMMITTEE',true),
 ('42000000-0000-4000-8000-000000000007','close-cycle','OWNER',false),
 ('42000000-0000-4000-8000-000000000008','close-cycle','BOARD',true);
insert into rush.pnms(id,name,contact,normalized_contact,uniqname)
 select 'close-person-'||n,'Synthetic applicant '||n,'close'||n||'@umich.edu','close'||n||'@umich.edu','close'||n
 from generate_series(1,8) n;
insert into rush.applications(id,pnm_id,cycle_id,status,submitted_at)
 select 'close-app-'||n,'close-person-'||n,case when n=8 then 'close-other' else 'close-cycle' end,
 (case when n=5 then 'DRAFT' when n=6 then 'WITHDRAWN' else 'GROUP_CASE' end)::rush.application_status,now()
 from generate_series(1,8) n;
insert into rush.rounds(id,cycle_id,kind,name,status,weight) values
 ('close-sd','close-cycle','SPEED_DATING','Speed Dating','ACTIVE',40),
 ('close-gc','close-cycle','GROUP_CASE','Group Case','ACTIVE',60),
 ('close-screen','close-cycle','APPLICATION_SCREEN','Screening','ACTIVE',0),
 ('close-empty','close-other','OTHER','Empty legacy round','ACTIVE',0);
insert into rush.rubrics(id,round_id,version,minimum_observed_criteria) values
 ('close-sd-rubric','close-sd',1,1),('close-gc-rubric','close-gc',1,3);
insert into rush.rubric_criteria(id,rubric_id,key,name,weight,required,position) values
 ('close-overall','close-sd-rubric','overall','Overall',100,true,0),
 ('close-required','close-gc-rubric','required','Required teamwork',75,true,0),
 ('close-other-one','close-gc-rubric','other_one','Other one',15,false,1),
 ('close-other-two','close-gc-rubric','other_two','Other two',10,false,2);
-- Applicant4 is legacy assignment-only; applicant3 has enrollment and no
-- assignments. Neither is lost or given fabricated expected assignment rows.
insert into rush.round_participations(round_id,application_id,rubric_id,required_evaluators,assignment_policy,advanced_by)
 select 'close-sd','close-app-'||n,'close-sd-rubric',2,'{}','42000000-0000-4000-8000-000000000001'
 from generate_series(1,8) n where n<>4 and n<>7;
insert into rush.round_participations(round_id,application_id,rubric_id,required_evaluators,assignment_policy,advanced_by)
 values ('close-gc','close-app-1','close-gc-rubric',2,'{}','42000000-0000-4000-8000-000000000001');
insert into rush.evaluation_assignments(id,round_id,application_id,evaluator_id,status)
 select 'close-assignment-'||app||'-'||grader,'close-sd','close-app-'||app,
 ('42000000-0000-4000-8000-'||lpad(grader::text,12,'0'))::uuid,
 (case when app=4 and grader=2 then 'IN_PROGRESS' when app>=4 then 'ASSIGNED' else 'SUBMITTED' end)::rush.assignment_status
 from (values (1),(2),(4),(5),(6),(8)) a(app) cross join (values (2),(3)) g(grader);
insert into rush.evaluation_assignments(id,round_id,application_id,evaluator_id,status)
 select 'close-gc-assignment-'||grader,'close-gc','close-app-1',
 ('42000000-0000-4000-8000-'||lpad(grader::text,12,'0'))::uuid,'SUBMITTED'
 from generate_series(2,3) grader;
insert into rush.round_calibration_acknowledgements(round_id,rubric_id,evaluator_id)
 select round_id,id,('42000000-0000-4000-8000-'||lpad(grader::text,12,'0'))::uuid
 from rush.rubrics cross join generate_series(2,3) grader where id in ('close-sd-rubric','close-gc-rubric');
insert into rush.evaluations(id,assignment_id,evaluator_id,rubric_id,status,version,evidence,submitted_at)
 select 'close-eval-'||app||'-'||grader,'close-assignment-'||app||'-'||grader,
 ('42000000-0000-4000-8000-'||lpad(grader::text,12,'0'))::uuid,
 'close-sd-rubric','SUBMITTED',1,'Synthetic evidence',now()
 from (values (1),(2)) a(app) cross join (values (2),(3)) g(grader);
insert into rush.criterion_ratings(evaluation_id,criterion_id,score)
 select id,'close-overall',case when id='close-eval-2-2' then null else 4 end
 from rush.evaluations where id like 'close-eval-%';
-- Historical duplicate version: count only the latest nonvoid observation.
insert into rush.evaluations(id,assignment_id,evaluator_id,rubric_id,status,version,submitted_at)
 values ('close-eval-new','close-assignment-1-2','42000000-0000-4000-8000-000000000002','close-sd-rubric','SUBMITTED',2,now());
insert into rush.criterion_ratings(evaluation_id,criterion_id,score) values ('close-eval-new','close-overall',5);
insert into rush.conflict_declarations(application_id,declarer_id,reason) values
 ('close-app-2','42000000-0000-4000-8000-000000000003','Synthetic conflict'),
 ('close-app-4','42000000-0000-4000-8000-000000000003','Unfinished conflicted record');
-- 75% observed weight alone is insufficient for this three-criterion rubric.
insert into rush.evaluations(id,assignment_id,evaluator_id,rubric_id,status,version,submitted_at)
 select 'close-gc-eval-'||grader,'close-gc-assignment-'||grader,
 ('42000000-0000-4000-8000-'||lpad(grader::text,12,'0'))::uuid,
 'close-gc-rubric','SUBMITTED',1,now() from generate_series(2,3) grader;
insert into rush.criterion_ratings(evaluation_id,criterion_id,score)
 select 'close-gc-eval-'||grader,'close-required',5 from generate_series(2,3) grader;

set local "request.jwt.claims"='{"iss":"https://close-summary.example.invalid","sub":"42000000-0000-4000-8000-000000000001","role":"authenticated"}';
set local role authenticated;
select extensions.is(rush.round_close_summary('close-sd')->>'roundId','close-sd','snapshot identifies the requested round');
select extensions.is(rush.round_close_summary('close-sd')->>'roundStatus','ACTIVE','snapshot reports the actual current status');
select extensions.ok((rush.round_close_summary('close-sd')->>'checkedAt')::timestamptz >= transaction_timestamp(),'checkedAt records statement time');
select extensions.is(rush.round_close_summary('close-sd')->>'applicants','4','cohort unions actual enrollment and legacy assignments and excludes draft withdrawn unrelated and wrong-cycle applications');
select extensions.is(rush.round_close_summary('close-sd')->>'applicantsReady','1','only two independent valid evaluations make an applicant covered');
select extensions.is(rush.round_close_summary('close-sd')->>'applicantsIncomplete','3','enrolled unassigned and legacy unfinished applicants remain incomplete');
select extensions.is(rush.round_close_summary('close-sd')->>'submittedEvaluations','4','latest submitted observations include note-only evidence and exclude historical versions');
select extensions.is(rush.round_close_summary('close-sd')->>'validEvaluations','2','note-only and conflicted evaluations do not count as valid');
select extensions.is(rush.round_close_summary('close-sd')->>'openAssignments','2','only actual open assignments count including an unfinished conflicted record');
select extensions.is((select count(*) from jsonb_object_keys(rush.round_close_summary('close-sd'))),9::bigint,'RPC returns only the nine aggregate contract fields');
select extensions.ok(not (rush.round_close_summary('close-sd') ?| array['scores','evaluations','names','applicantIds','evaluatorIds']),'snapshot exposes no scores or applicant or evaluator identities');
select extensions.is(rush.round_close_summary('close-gc')->>'applicants','1','Group Case uses its own cohort');
select extensions.is(rush.round_close_summary('close-gc')->>'submittedEvaluations','2','Group Case retains partial submitted observations in its saved count');
select extensions.is(rush.round_close_summary('close-gc')->>'validEvaluations','0','Group Case applies the canonical minimum independent of weighted coverage');
select extensions.is(rush.round_close_summary('close-gc')->>'applicantsIncomplete','1','partial Group Case saves cannot label a round covered');
select extensions.throws_ok($$select rush.round_close_summary('close-screen')$$,'55000','use screening batch coverage','screening does not fabricate interview coverage under its different review policy');
select extensions.throws_ok($$select rush.round_close_summary('missing-round')$$,'42501','forbidden','unknown rounds reveal no state');
select extensions.throws_ok($$select rush.round_close_summary('close-empty')$$,'42501','forbidden','an owner of another cycle cannot inspect the snapshot');
-- An actual read never changes the round, assignment, evaluation or audit state.
select extensions.is((select count(*) from rush.audit_events where action='ROUND_STATUS_CHANGED' and resource_id='close-sd'),0::bigint,'reading coverage creates no round transition audit event');
select extensions.lives_ok($$select rush.set_round_status('close-sd','FROZEN')$$,'existing Board authority can freeze despite incomplete observations');
select extensions.is(rush.round_close_summary('close-sd')->>'roundStatus','FROZEN','a later read reports frozen state');
select extensions.is(rush.round_close_summary('close-sd')->>'validEvaluations','2','locking does not turn partial observations into valid evaluations');
set local "request.jwt.claims"='{"iss":"https://close-summary.example.invalid","sub":"42000000-0000-4000-8000-000000000002","role":"authenticated"}';
select extensions.throws_ok($$select rush.round_close_summary('close-sd')$$,'42501','forbidden','members cannot inspect Board close snapshots');
set local "request.jwt.claims"='{"iss":"https://close-summary.example.invalid","sub":"42000000-0000-4000-8000-000000000004","role":"authenticated"}';
select extensions.throws_ok($$select rush.round_close_summary('close-sd')$$,'42501','forbidden','panel-only access does not imply cycle management');
set local "request.jwt.claims"='{"iss":"https://close-summary.example.invalid","sub":"42000000-0000-4000-8000-000000000006","role":"authenticated"}';
select extensions.throws_ok($$select rush.round_close_summary('close-sd')$$,'42501','forbidden','recruitment operations alone does not imply cycle management');
set local "request.jwt.claims"='{"iss":"https://close-summary.example.invalid","sub":"42000000-0000-4000-8000-000000000007","role":"authenticated"}';
select extensions.throws_ok($$select rush.round_close_summary('close-sd')$$,'42501','forbidden','inactive owners cannot inspect the snapshot');
set local "request.jwt.claims"='{"iss":"https://close-summary.example.invalid","sub":"42000000-0000-4000-8000-000000000008","role":"authenticated"}';
select extensions.lives_ok($$select rush.round_close_summary('close-gc')$$,'active Board members share set_round_status authority');
set local "request.jwt.claims"='{"iss":"https://close-summary.example.invalid","sub":"42000000-0000-4000-8000-000000000005","role":"authenticated"}';
select extensions.is(rush.round_close_summary('close-empty')->>'applicants','0','an empty legacy round reports a real empty cohort');
select extensions.is(rush.round_close_summary('close-empty')->>'applicantsIncomplete','0','an empty cohort does not invent missing applicants');
set local "request.jwt.claims"='{"iss":"https://close-summary.example.invalid","sub":"missing-subject","role":"authenticated"}';
select extensions.throws_ok($$select rush.round_close_summary('close-sd')$$,'42501','unauthorized','unmapped subjects cannot inspect snapshots');
set local role anon;
select extensions.throws_ok($$select rush.round_close_summary('close-sd')$$,'42501','permission denied for function round_close_summary','anonymous access has no execute grant');
select * from extensions.finish();
rollback;
