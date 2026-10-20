begin;
set local role postgres;
set local search_path=extensions,public;
select extensions.plan(51);
insert into auth.users(id,email,raw_user_meta_data) values
 ('79000000-0000-4000-8000-000000000001','screen-cas-one@example.invalid','{"display_name":"Synthetic reader"}'),
 ('79000000-0000-4000-8000-000000000002','screen-cas-two@example.invalid','{"display_name":"Synthetic replacement"}');
insert into rush.auth_identities(issuer,subject,app_user_id)
 select 'https://screen-cas.example.invalid',id::text,id from rush.profiles where id::text like '79000000-%';
update rush.rush_cycles set status='CLOSED' where status in ('DRAFT','OPEN','IN_PROCESS','DECISION_LOCK');
insert into rush.rush_cycles(id,name,status) values('screen-cas-cycle','Screening CAS fixture','IN_PROCESS');
insert into rush.memberships(user_id,cycle_id,role) values
 ('79000000-0000-4000-8000-000000000001','screen-cas-cycle','RECRUITMENT_COMMITTEE'),
 ('79000000-0000-4000-8000-000000000002','screen-cas-cycle','RECRUITMENT_COMMITTEE');
insert into rush.pnms(id,name,contact,normalized_contact) values
 ('screen-cas-pnm','Synthetic applicant','screen-cas-one@example.invalid','screen-cas-one@example.invalid'),
 ('screen-cas-pnm2','Synthetic applicant two','screen-cas-two@example.invalid','screen-cas-two@example.invalid'),
 ('screen-cas-pnm3','Synthetic applicant three','screen-cas-three@example.invalid','screen-cas-three@example.invalid');
insert into rush.applications(id,pnm_id,cycle_id,status) values
 ('screen-cas-app','screen-cas-pnm','screen-cas-cycle','SUBMITTED'),
 ('screen-cas-app2','screen-cas-pnm2','screen-cas-cycle','SUBMITTED'),
 ('screen-cas-app3','screen-cas-pnm3','screen-cas-cycle','SUBMITTED');
insert into rush.rounds(id,cycle_id,kind,name,status,weight) values('screen-cas-round','screen-cas-cycle','APPLICATION_SCREEN','Screening CAS round','ACTIVE',100);
insert into rush.rubrics(id,round_id,version) values('screen-cas-rubric','screen-cas-round',1),('screen-cas-old-rubric','screen-cas-round',2);
insert into rush.rubric_criteria(id,rubric_id,key,name,weight,required,position) values('screen-cas-criterion','screen-cas-rubric','evidence','Evidence',100,true,0);
insert into rush.screening_batches(id,cycle_id,rubric_id,status,created_by) values('screen-cas-batch','screen-cas-cycle','screen-cas-rubric','PUBLISHED','79000000-0000-4000-8000-000000000001');
insert into rush.screening_reviewers(batch_id,reviewer_id,capacity) values
 ('screen-cas-batch','79000000-0000-4000-8000-000000000001',20),('screen-cas-batch','79000000-0000-4000-8000-000000000002',20);
insert into rush.screening_packets(id,batch_id,application_id,candidate_code,content,content_hash) values
 ('screen-cas-packet','screen-cas-batch','screen-cas-app','CAS01','{"responses":[]}','fixture'),
 ('screen-cas-packet2','screen-cas-batch','screen-cas-app2','CAS02','{"responses":[]}','fixture'),
 ('screen-cas-packet3','screen-cas-batch','screen-cas-app3','CAS03','{"responses":[]}','fixture');
insert into rush.screening_assignments(id,packet_id,reviewer_id) values
 ('screen-cas-assignment','screen-cas-packet','79000000-0000-4000-8000-000000000001'),
 ('screen-cas-assignment2','screen-cas-packet2','79000000-0000-4000-8000-000000000001'),
 ('screen-cas-assignment3','screen-cas-packet3','79000000-0000-4000-8000-000000000001');
insert into rush.screening_review_drafts(assignment_id,reviewer_id,rubric_id,ratings) values('screen-cas-assignment3','79000000-0000-4000-8000-000000000001','screen-cas-old-rubric','[]');
select extensions.ok((select revision is not null from rush.screening_review_drafts where assignment_id='screen-cas-assignment3'),'preexisting draft rows have initial UUID revision');
select extensions.ok(has_function_privilege('service_role','rush.submit_screening_review(text,jsonb,text,text)','EXECUTE'),'trusted service keeps legacy submit');
select extensions.ok((select relforcerowsecurity from pg_class where oid='rush.screening_review_drafts'::regclass),'draft table keeps forced RLS');
select extensions.ok(not has_function_privilege('authenticated','rush.save_screening_review_draft(text,jsonb,text,text)','EXECUTE'),'legacy unconditional save revoked');
select extensions.ok(not has_function_privilege('authenticated','rush.get_screening_review_draft(text)','EXECUTE'),'legacy load revoked');
select extensions.ok(not has_function_privilege('authenticated','rush.submit_screening_review(text,jsonb,text,text)','EXECUTE'),'legacy submit revoked');
select extensions.ok(not has_function_privilege('authenticated','rush.recuse_screening_assignment(text,text)','EXECUTE'),'legacy void recusal revoked');
select extensions.ok(not has_function_privilege('anon','rush.get_screening_review_draft_v2(text)','EXECUTE'),'anonymous load denied');
select extensions.ok(not has_function_privilege('authenticated','rush.screening_draft_snapshot(text)','EXECUTE'),'snapshot helper private');
select extensions.ok(not has_table_privilege('authenticated','rush.screening_review_drafts','SELECT,UPDATE'),'direct draft access denied');
set local "request.jwt.claims"='{"iss":"https://screen-cas.example.invalid","sub":"79000000-0000-4000-8000-000000000001","role":"authenticated"}';
set local role authenticated;
select extensions.is(rush.get_screening_review_draft_v2('screen-cas-assignment'),'{"assignmentId":"screen-cas-assignment","revision":null,"draft":null}'::jsonb,'empty draft explicit and assignment bound');
select set_config('test.screen_first',rush.save_screening_review_draft_v2('screen-cas-assignment','[{"criterionId":"screen-cas-criterion","score":"4","note":"Observed"}]','First','HOLD',null,'50000000-0000-4000-8000-000000000001')::text,true);
select extensions.is(current_setting('test.screen_first')::jsonb->>'kind','saved','first draft saves');
select extensions.is(current_setting('test.screen_first')::jsonb->>'assignmentId','screen-cas-assignment','saved receipt bound to assignment');
select extensions.is(rush.get_screening_review_draft_v2('screen-cas-assignment')->'draft',current_setting('test.screen_first')::jsonb->'draft','get returns confirmed content');
select extensions.is(rush.save_screening_review_draft_v2('screen-cas-assignment','[{"criterionId":"screen-cas-criterion","score":"4","note":"Observed"}]','First','HOLD',null,'50000000-0000-4000-8000-000000000001'),current_setting('test.screen_first')::jsonb,'exact retry same receipt');
select extensions.throws_ok($$select rush.save_screening_review_draft_v2('screen-cas-assignment','[]','Different','HOLD',null,'50000000-0000-4000-8000-000000000001')$$,'22023','mutation id reused with different payload','mutation cannot change payload');
select extensions.is(rush.save_screening_review_draft_v2('screen-cas-assignment','[{"criterionId":"screen-cas-criterion","score":"4","note":"Observed"}]','Stale','HOLD',null,'50000000-0000-4000-8000-000000000002')->>'kind','conflict','second first save conflicts');
select set_config('test.screen_second',rush.save_screening_review_draft_v2('screen-cas-assignment','[{"criterionId":"screen-cas-criterion","score":"4","note":"Observed"}]','Newer','ADVANCE',(current_setting('test.screen_first')::jsonb->>'revision')::uuid,'50000000-0000-4000-8000-000000000003')::text,true);
select extensions.is(current_setting('test.screen_second')::jsonb->>'kind','saved','matching revision saves');
select extensions.is(rush.save_screening_review_draft_v2('screen-cas-assignment','[{"criterionId":"screen-cas-criterion","score":"4","note":"Observed"}]','First','HOLD',null,'50000000-0000-4000-8000-000000000001')->>'kind','conflict','old replay cannot restore old content');
select extensions.is(rush.submit_screening_review_v2('screen-cas-assignment','[{"criterionId":"screen-cas-criterion","score":4,"note":"Observed"}]','Sufficient synthetic evidence for final review.','ADVANCE',(current_setting('test.screen_first')::jsonb->>'revision')::uuid)->>'kind','conflict','stale final review conflicts');
set local role postgres;
select extensions.is((select count(*) from rush.screening_reviews where assignment_id='screen-cas-assignment'),0::bigint,'stale submit creates no review');
update rush.memberships set active=false where user_id='79000000-0000-4000-8000-000000000001';
set local role authenticated;
select extensions.throws_ok($$select rush.get_screening_review_draft_v2('screen-cas-assignment')$$,'42501','reviewer access revoked','revoked role cannot load');
select extensions.throws_ok($$select rush.save_screening_review_draft_v2('screen-cas-assignment','[{"criterionId":"screen-cas-criterion","score":"4","note":"Observed"}]','Newer','ADVANCE',(current_setting('test.screen_first')::jsonb->>'revision')::uuid,'50000000-0000-4000-8000-000000000003')$$,'42501','reviewer access revoked','revoked role cannot replay receipt');
set local role postgres;
update rush.memberships set active=true where user_id='79000000-0000-4000-8000-000000000001';
insert into rush.conflict_declarations(application_id,declarer_id,reason) values('screen-cas-app','79000000-0000-4000-8000-000000000001','Synthetic conflict');
set local role authenticated;
select extensions.throws_ok($$select rush.get_screening_review_draft_v2('screen-cas-assignment')$$,'42501','conflict declared','conflict blocks draft access');
set local role postgres;
delete from rush.conflict_declarations where application_id='screen-cas-app';
update rush.applications set status='WITHDRAWN' where id='screen-cas-app';
set local role authenticated;
select extensions.throws_ok($$select rush.get_screening_review_draft_v2('screen-cas-assignment')$$,'22023','applicant is not eligible for screening','withdrawal blocks recovery');
set local role postgres;
update rush.applications set status='SUBMITTED' where id='screen-cas-app';
update rush.screening_reviewers set active=false where reviewer_id='79000000-0000-4000-8000-000000000001';
set local role authenticated;
select extensions.throws_ok($$select rush.get_screening_review_draft_v2('screen-cas-assignment')$$,'42501','reviewer access revoked','inactive batch reviewer cannot recover');
set local role postgres;
update rush.screening_reviewers set active=true where reviewer_id='79000000-0000-4000-8000-000000000001';
update rush.screening_batches set status='FROZEN' where id='screen-cas-batch';
set local role authenticated;
select extensions.is(rush.get_screening_review_draft_v2('screen-cas-assignment')->'revision',current_setting('test.screen_second')::jsonb->'revision','closed batch retains recoverable own draft');
select extensions.is(rush.save_screening_review_draft_v2('screen-cas-assignment','[{"criterionId":"screen-cas-criterion","score":"4","note":"Observed"}]','Newer','ADVANCE',(current_setting('test.screen_first')::jsonb->>'revision')::uuid,'50000000-0000-4000-8000-000000000003'),current_setting('test.screen_second')::jsonb,'closed batch permits exact read-only receipt confirmation');
select extensions.throws_ok($$select rush.save_screening_review_draft_v2('screen-cas-assignment','[]','Changed','HOLD',null,'50000000-0000-4000-8000-000000000004')$$,'55000','assignment closed','closed batch blocks new edits');
set local role postgres;
update rush.screening_batches set status='PUBLISHED' where id='screen-cas-batch';
update rush.rounds set closes_at=clock_timestamp()-interval '1 second' where id='screen-cas-round';
set local role authenticated;
select extensions.is(rush.save_screening_review_draft_v2('screen-cas-assignment','[{"criterionId":"screen-cas-criterion","score":"4","note":"Observed"}]','Newer','ADVANCE',(current_setting('test.screen_first')::jsonb->>'revision')::uuid,'50000000-0000-4000-8000-000000000003'),current_setting('test.screen_second')::jsonb,'deadline permits only exact receipt confirmation');
select extensions.throws_ok($$select rush.submit_screening_review_v2('screen-cas-assignment','[]','Sufficient synthetic evidence for final review.','ADVANCE',(current_setting('test.screen_second')::jsonb->>'revision')::uuid)$$,'55000','assignment closed','actual deadline enforced on final submit');
set local role postgres;
update rush.rounds set closes_at=null where id='screen-cas-round';
update rush.screening_review_drafts set rubric_id='screen-cas-old-rubric' where assignment_id='screen-cas-assignment';
set local role authenticated;
select extensions.is(rush.get_screening_review_draft_v2('screen-cas-assignment')->'draft','null'::jsonb,'obsolete rubric content is absent');
select extensions.is(rush.get_screening_review_draft_v2('screen-cas-assignment')->'revision',current_setting('test.screen_second')::jsonb->'revision','obsolete content keeps concurrency revision');
select extensions.is(rush.save_screening_review_draft_v2('screen-cas-assignment','[{"criterionId":"screen-cas-criterion","score":"4","note":"Observed"}]','Newer','ADVANCE',(current_setting('test.screen_first')::jsonb->>'revision')::uuid,'50000000-0000-4000-8000-000000000003')->>'kind','conflict','obsolete rubric cannot replay confirmed receipt');
select extensions.throws_ok($$select rush.save_screening_review_draft_v2('screen-cas-assignment','[]','Invalid','HOLD',(current_setting('test.screen_second')::jsonb->>'revision')::uuid,'50000000-0000-4000-8000-000000000004')$$,'22023','invalid screening draft','canonical draft validity retained');
select extensions.throws_ok($$select rush.submit_screening_review_v2('screen-cas-assignment','[{"criterionId":"screen-cas-criterion","score":4}]','Sufficient synthetic evidence for final review.','INVALID',(current_setting('test.screen_second')::jsonb->>'revision')::uuid)$$,'22023','invalid review','recommendation validation retained');
select set_config('test.screen_submitted',rush.submit_screening_review_v2('screen-cas-assignment','[{"criterionId":"screen-cas-criterion","score":4,"note":"Observed"}]','Sufficient synthetic evidence for final review.','ADVANCE',(current_setting('test.screen_second')::jsonb->>'revision')::uuid)::text,true);
select extensions.is(current_setting('test.screen_submitted')::jsonb->>'kind','submitted','canonical submission succeeds');
select extensions.is(current_setting('test.screen_submitted')::jsonb->>'assignmentId','screen-cas-assignment','submission receipt assignment bound');
select extensions.is((current_setting('test.screen_submitted')::jsonb->>'score')::numeric,75::numeric,'canonical score remains 75');
select extensions.is(rush.get_screening_review_draft_v2('screen-cas-assignment')->'revision','null'::jsonb,'submission clears draft revision');
select extensions.throws_ok($$select rush.save_screening_review_draft_v2('screen-cas-assignment','[]','Late','HOLD',null,'50000000-0000-4000-8000-000000000005')$$,'55000','assignment closed','late save cannot recreate submitted draft');
set local role postgres;
select extensions.is((select id from rush.screening_reviews where assignment_id='screen-cas-assignment'),current_setting('test.screen_submitted')::jsonb->>'reviewId','receipt bound to actual submitted review');
set local role authenticated;
select set_config('test.screen_recuse_draft',rush.save_screening_review_draft_v2('screen-cas-assignment2','[{"criterionId":"screen-cas-criterion","score":"","note":""}]','','',null,'50000000-0000-4000-8000-000000000006')::text,true);
select extensions.is(rush.recuse_screening_assignment_v2('screen-cas-assignment2','Synthetic recusal reason'),'{"kind":"recused","assignmentId":"screen-cas-assignment2"}'::jsonb,'recusal has explicit bound receipt');
select extensions.throws_ok($$select rush.save_screening_review_draft_v2('screen-cas-assignment2','[]','Late','HOLD',null,'50000000-0000-4000-8000-000000000007')$$,'42501','conflict declared','recusal blocks late save');
set local role postgres;
select extensions.is((select count(*) from rush.screening_review_drafts where assignment_id='screen-cas-assignment2'),0::bigint,'recusal clears draft and replay state');
select extensions.is((select count(*) from rush.screening_assignments where packet_id='screen-cas-packet2' and status='ASSIGNED'),1::bigint,'recusal preserves replacement coverage');
update rush.screening_reviewers set active=false where reviewer_id='79000000-0000-4000-8000-000000000002';
set local role authenticated;
select extensions.throws_ok($$select rush.recuse_screening_assignment_v2('screen-cas-assignment3','Synthetic recusal reason')$$,'55000','no eligible replacement reviewer exists for this packet; the recusal cannot be completed','no replacement means no successful receipt');
set local role postgres;
select extensions.is((select status from rush.screening_assignments where id='screen-cas-assignment3'),'ASSIGNED','failed recusal leaves assignment open');
select extensions.is((select count(*) from rush.conflict_declarations where application_id='screen-cas-app3'),0::bigint,'failed recusal leaves no partial reason');
select extensions.is((select count(*) from rush.screening_review_drafts where assignment_id='screen-cas-assignment3'),1::bigint,'failed recusal keeps recoverable draft');
set local "request.jwt.claims"='{"iss":"https://screen-cas.example.invalid","sub":"79000000-0000-4000-8000-000000000002","role":"authenticated"}';
set local role authenticated;
select extensions.throws_ok($$select rush.get_screening_review_draft_v2('screen-cas-assignment')$$,'P0002','assignment not found','other reviewer cannot load draft');
select * from extensions.finish();
rollback;
