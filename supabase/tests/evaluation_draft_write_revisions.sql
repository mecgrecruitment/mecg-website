begin;
set local role postgres;
set local search_path=extensions,public;
select extensions.plan(38);
insert into auth.users(id,email,raw_user_meta_data) values
 ('69000000-0000-4000-8000-000000000001','draft-one@example.invalid','{"display_name":"Draft evaluator"}'),
 ('69000000-0000-4000-8000-000000000002','draft-two@example.invalid','{"display_name":"Other evaluator"}');
insert into rush.auth_identities(issuer,subject,app_user_id)
 select 'https://draft-cas.example.invalid',id::text,id from rush.profiles where id::text like '69000000-%';
update rush.rush_cycles set status='CLOSED' where status in ('DRAFT','OPEN','IN_PROCESS','DECISION_LOCK');
insert into rush.rush_cycles(id,name,status) values('draft-cas-cycle','Draft CAS fixture','IN_PROCESS');
insert into rush.memberships(user_id,cycle_id,role) values
 ('69000000-0000-4000-8000-000000000001','draft-cas-cycle','MEMBER'),
 ('69000000-0000-4000-8000-000000000002','draft-cas-cycle','MEMBER');
insert into rush.pnms(id,name,contact,normalized_contact) values
 ('draft-cas-pnm','Synthetic applicant','draft-pnm@example.invalid','draft-pnm@example.invalid'),
 ('draft-cas-pnm2','Synthetic applicant two','draft-pnm2@example.invalid','draft-pnm2@example.invalid');
insert into rush.applications(id,pnm_id,cycle_id,status) values
 ('draft-cas-app','draft-cas-pnm','draft-cas-cycle','FINAL_REVIEW'),
 ('draft-cas-app2','draft-cas-pnm2','draft-cas-cycle','FINAL_REVIEW');
insert into rush.rounds(id,cycle_id,kind,name,status,weight) values('draft-cas-round','draft-cas-cycle','DRAFT_CAS_TEST','Draft CAS round','ACTIVE',100);
insert into rush.rubrics(id,round_id,version,minimum_observed_criteria) values('draft-cas-rubric','draft-cas-round',1,1);
insert into rush.rubric_criteria(id,rubric_id,key,name,weight,required,position) values('draft-cas-criterion','draft-cas-rubric','evidence','Evidence',100,true,0);
insert into rush.evaluation_assignments(id,round_id,application_id,evaluator_id) values
 ('draft-cas-assignment','draft-cas-round','draft-cas-app','69000000-0000-4000-8000-000000000001'),
 ('draft-cas-assignment2','draft-cas-round','draft-cas-app2','69000000-0000-4000-8000-000000000001');
insert into rush.round_calibration_acknowledgements(round_id,rubric_id,evaluator_id) values('draft-cas-round','draft-cas-rubric','69000000-0000-4000-8000-000000000001');
select extensions.ok(not has_function_privilege('authenticated','rush.save_evaluation_draft(text,jsonb,text)','EXECUTE'),'legacy unconditional save is not a browser bypass');
select extensions.ok(not has_function_privilege('authenticated','rush.discard_evaluation_draft(text)','EXECUTE'),'legacy unconditional discard is not a browser bypass');
select extensions.ok(not has_function_privilege('authenticated','rush.get_evaluation_draft(text)','EXECUTE'),'legacy read cannot bypass current access checks');
select extensions.ok(not has_function_privilege('authenticated','rush.submit_evaluation(text,jsonb,text)','EXECUTE'),'legacy submit cannot bypass revision precondition');
select extensions.ok(not has_function_privilege('anon','rush.save_evaluation_draft_v2(text,jsonb,text,uuid,uuid)','EXECUTE'),'anonymous save is denied');
select extensions.ok(not has_function_privilege('authenticated','rush.evaluation_draft_snapshot(text)','EXECUTE'),'snapshot helper is private');
set local "request.jwt.claims"='{"iss":"https://draft-cas.example.invalid","sub":"69000000-0000-4000-8000-000000000001","role":"authenticated"}';
set local role authenticated;
select extensions.is(rush.get_evaluation_draft_v2('draft-cas-assignment'),' {"assignmentId":"draft-cas-assignment","revision":null,"draft":null}'::jsonb,'unsaved assignment has explicit null revision and draft');
select set_config('test.draft_first',rush.save_evaluation_draft_v2('draft-cas-assignment','[{"criterionId":"draft-cas-criterion","score":"4","note":"Observed"}]','First',null,'30000000-0000-4000-8000-000000000001')::text,true);
select extensions.is(current_setting('test.draft_first')::jsonb->>'kind','saved','first draft save succeeds');
select extensions.is(rush.get_evaluation_draft_v2('draft-cas-assignment')->'draft',current_setting('test.draft_first')::jsonb->'draft','load returns canonical confirmed content');
select extensions.is(rush.save_evaluation_draft_v2('draft-cas-assignment','[{"criterionId":"draft-cas-criterion","score":"4","note":"Observed"}]','First',null,'30000000-0000-4000-8000-000000000001'),current_setting('test.draft_first')::jsonb,'exact current mutation retry returns same receipt');
select extensions.throws_ok($$select rush.save_evaluation_draft_v2('draft-cas-assignment','[{"criterionId":"draft-cas-criterion","score":"5","note":"Observed"}]','Changed',null,'30000000-0000-4000-8000-000000000001')$$,'22023','mutation id reused with different payload','same mutation cannot change payload');
select extensions.is(rush.save_evaluation_draft_v2('draft-cas-assignment','[{"criterionId":"draft-cas-criterion","score":"5","note":"Observed"}]','Stale',null,'30000000-0000-4000-8000-000000000002')->>'kind','conflict','second first-save request conflicts');
select set_config('test.draft_second',rush.save_evaluation_draft_v2('draft-cas-assignment','[{"criterionId":"draft-cas-criterion","score":"4","note":"Observed"}]','Newer',(current_setting('test.draft_first')::jsonb->>'revision')::uuid,'30000000-0000-4000-8000-000000000003')::text,true);
select extensions.is(current_setting('test.draft_second')::jsonb->>'kind','saved','matching revision permits deliberate new edit');
select extensions.is(rush.save_evaluation_draft_v2('draft-cas-assignment','[{"criterionId":"draft-cas-criterion","score":"4","note":"Observed"}]','First',null,'30000000-0000-4000-8000-000000000001')->>'kind','conflict','old request after new save never reapplies');
select extensions.is(rush.get_evaluation_draft_v2('draft-cas-assignment')#>>'{draft,evidence}','Newer','newer draft is preserved');
select extensions.is(rush.submit_evaluation_v2('draft-cas-assignment','[{"criterionId":"draft-cas-criterion","score":4,"note":"Observed"}]','Old final',(current_setting('test.draft_first')::jsonb->>'revision')::uuid)->>'kind','conflict','stale reviewed revision cannot finalize after another device changes draft');
set local role postgres;
select extensions.is((select count(*) from rush.evaluations where assignment_id='draft-cas-assignment'),0::bigint,'stale submit creates no evaluation');
update rush.memberships set active=false where user_id='69000000-0000-4000-8000-000000000001';
set local role authenticated;
select extensions.throws_ok($$select rush.get_evaluation_draft_v2('draft-cas-assignment')$$,'42501','role revoked','revoked member cannot load private draft');
select extensions.throws_ok($$select rush.save_evaluation_draft_v2('draft-cas-assignment','[{"criterionId":"draft-cas-criterion","score":"4","note":"Observed"}]','Newer',(current_setting('test.draft_first')::jsonb->>'revision')::uuid,'30000000-0000-4000-8000-000000000003')$$,'42501','role revoked','revoked member cannot replay receipt');
set local role postgres;
update rush.memberships set active=true where user_id='69000000-0000-4000-8000-000000000001';
insert into rush.conflict_declarations(application_id,declarer_id,reason) values('draft-cas-app','69000000-0000-4000-8000-000000000001','Synthetic conflict');
set local role authenticated;
select extensions.throws_ok($$select rush.get_evaluation_draft_v2('draft-cas-assignment')$$,'42501','conflict declared','recused evaluator cannot load draft');
set local role postgres;
delete from rush.conflict_declarations where application_id='draft-cas-app';
update rush.applications set status='WITHDRAWN' where id='draft-cas-app';
set local role authenticated;
select extensions.throws_ok($$select rush.get_evaluation_draft_v2('draft-cas-assignment')$$,'22023','applicant is not eligible for evaluation','withdrawn applicant draft access is denied');
set local role postgres;
update rush.applications set status='FINAL_REVIEW' where id='draft-cas-app';
update rush.rounds set status='FROZEN' where id='draft-cas-round';
set local role authenticated;
select extensions.is(rush.get_evaluation_draft_v2('draft-cas-assignment')#>>'{draft,evidence}','Newer','closed round allows recovery of own existing draft');
select extensions.throws_ok($$select rush.save_evaluation_draft_v2('draft-cas-assignment','[{"criterionId":"draft-cas-criterion","score":"4","note":"Observed"}]','Newer',(current_setting('test.draft_first')::jsonb->>'revision')::uuid,'30000000-0000-4000-8000-000000000003')$$,'55000','assignment closed','closed round denies save and replay');
set local role postgres;
update rush.rounds set status='ACTIVE',closes_at=now()-interval '1 minute' where id='draft-cas-round';
set local role authenticated;
select extensions.throws_ok($$select rush.save_evaluation_draft_v2('draft-cas-assignment','[{"criterionId":"draft-cas-criterion","score":"4","note":"Observed"}]','Late',(current_setting('test.draft_second')::jsonb->>'revision')::uuid,'30000000-0000-4000-8000-000000000004')$$,'55000','assignment closed','expired deadline denies new save');
set local role postgres;
update rush.rounds set closes_at=null where id='draft-cas-round';
insert into rush.rubrics(id,round_id,version,minimum_observed_criteria) values('draft-cas-new-rubric','draft-cas-round',2,1);
set local role authenticated;
select extensions.is(rush.save_evaluation_draft_v2('draft-cas-assignment','[{"criterionId":"draft-cas-criterion","score":"4","note":"Observed"}]','Newer',(current_setting('test.draft_first')::jsonb->>'revision')::uuid,'30000000-0000-4000-8000-000000000003')->>'kind','conflict','rubric change prevents stale receipt replay');
select extensions.is(rush.get_evaluation_draft_v2('draft-cas-assignment')->'revision',current_setting('test.draft_second')::jsonb->'revision','old rubric draft retains actual revision even while current content is hidden');
set local role postgres;
delete from rush.rubrics where id='draft-cas-new-rubric';
set local role authenticated;
select set_config('test.draft_submit',rush.submit_evaluation_v2('draft-cas-assignment','[{"criterionId":"draft-cas-criterion","score":4,"note":"Observed"}]','Final',(current_setting('test.draft_second')::jsonb->>'revision')::uuid)::text,true);
select extensions.is(current_setting('test.draft_submit')::jsonb->>'kind','submitted','matching draft revision submits through canonical writer');
select extensions.is(current_setting('test.draft_submit')::jsonb->>'assignmentId','draft-cas-assignment','submit receipt identifies the exact assignment');
select extensions.is((current_setting('test.draft_submit')::jsonb->>'score')::numeric,75::numeric,'canonical numeric scoring is preserved');
select extensions.is(rush.get_evaluation_draft_v2('draft-cas-assignment')->'draft','null'::jsonb,'submitted assignment exposes no editable draft');
select extensions.throws_ok($$select rush.save_evaluation_draft_v2('draft-cas-assignment','[{"criterionId":"draft-cas-criterion","score":"4","note":"Observed"}]','Newer',(current_setting('test.draft_first')::jsonb->>'revision')::uuid,'30000000-0000-4000-8000-000000000003')$$,'55000','assignment closed','old mutation cannot resurrect submitted draft');
select extensions.throws_ok($$select rush.submit_evaluation_v2('draft-cas-assignment','[{"criterionId":"draft-cas-criterion","score":4,"note":"Observed"}]','Final',null)$$,'55000','assignment closed','repeat submit is denied rather than inferred successful');
set local role postgres;
select extensions.is((select count(*) from rush.evaluation_drafts where assignment_id='draft-cas-assignment'),0::bigint,'submission clears content and revision metadata atomically');
select extensions.is((select count(*) from rush.evaluations where assignment_id='draft-cas-assignment'),1::bigint,'one final evaluation exists');
set local "request.jwt.claims"='{"iss":"https://draft-cas.example.invalid","sub":"69000000-0000-4000-8000-000000000002","role":"authenticated"}';
set local role authenticated;
select extensions.throws_ok($$select rush.get_evaluation_draft_v2('draft-cas-assignment2')$$,'P0002','assignment not found','other evaluator cannot load draft');
select extensions.throws_ok($$select rush.save_evaluation_draft_v2('draft-cas-assignment2','[{"criterionId":"draft-cas-criterion","score":"4","note":"Observed"}]','',null,'30000000-0000-4000-8000-000000000005')$$,'P0002','assignment not found','other evaluator cannot save draft');
select extensions.throws_ok($$select rush.save_evaluation_draft_v2('draft-cas-assignment2','[]','',null,null)$$,'22023','mutation id required','missing mutation is rejected');
select extensions.ok(not has_table_privilege('authenticated','rush.evaluation_drafts','SELECT'),'private draft table remains inaccessible');
select * from extensions.finish();
rollback;
