begin;
set local role postgres;
set local search_path = extensions, public;
select extensions.plan(28);
insert into auth.users(id,email,raw_user_meta_data) values
 ('52000000-0000-4000-8000-000000000001','release-owner@example.invalid','{"display_name":"Release owner"}'::jsonb),
 ('52000000-0000-4000-8000-000000000002','release-reviewer@example.invalid','{"display_name":"Release reviewer"}'::jsonb);
-- Synthetic provider mappings are explicit; auth.users provisioning alone does
-- not establish the issuer/subject identity used by provider-neutral RPCs.
insert into rush.auth_identities(issuer,subject,app_user_id) values
 ('http://127.0.0.1:54321/auth/v1','52000000-0000-4000-8000-000000000001','52000000-0000-4000-8000-000000000001'),
 ('http://127.0.0.1:54321/auth/v1','52000000-0000-4000-8000-000000000002','52000000-0000-4000-8000-000000000002')
on conflict (issuer,subject) do nothing;
update rush.rush_cycles set status='CLOSED' where status in ('DRAFT','OPEN','IN_PROCESS','DECISION_LOCK');
insert into rush.rush_cycles(id,name,status) values('br-cycle','Batch release fixture','DECISION_LOCK');
insert into rush.memberships(user_id,cycle_id,role) values
 ('52000000-0000-4000-8000-000000000001','br-cycle','OWNER'),
 ('52000000-0000-4000-8000-000000000002','br-cycle','PANEL');
insert into rush.pnms(id,name,contact,normalized_contact)
 select 'br-pnm'||n,'Synthetic '||n,'release'||n||'@example.invalid','release'||n||'@example.invalid' from generate_series(1,6) n;
insert into rush.applications(id,pnm_id,cycle_id,status,submitted_at)
 select 'br-app'||n,'br-pnm'||n,'br-cycle',case when n=3 then 'WITHDRAWN'::rush.application_status else 'FINAL_REVIEW'::rush.application_status end,now() from generate_series(1,6) n;
insert into rush.rounds(id,cycle_id,kind,name,status,weight) values('br-round','br-cycle','GROUP_CASE','Fixture evidence','FROZEN',100);
insert into rush.rubrics(id,round_id,version,minimum_observed_criteria) values('br-rubric','br-round',1,1);
insert into rush.rubric_criteria(id,rubric_id,key,name,weight,required,position) values('br-criterion','br-rubric','evidence','Evidence',100,true,0);
insert into rush.evaluation_assignments(id,round_id,application_id,evaluator_id)
 select 'br-assignment-'||n||'-'||u,'br-round','br-app'||n,('52000000-0000-4000-8000-00000000000'||u)::uuid
 from generate_series(1,6) n cross join generate_series(1,2) u where n<>4;
-- Both synthetic evaluators acknowledged this exact active rubric before
-- their locked evidence was recorded. Preserve the production trigger.
insert into rush.round_calibration_acknowledgements(round_id,rubric_id,evaluator_id)
 select distinct round_id,'br-rubric',evaluator_id from rush.evaluation_assignments where round_id='br-round';
insert into rush.evaluations(id,assignment_id,evaluator_id,rubric_id,status,evidence,submitted_at)
 select 'br-evaluation-'||id,id,evaluator_id,'br-rubric','LOCKED','Specific synthetic evidence supporting the observed rating.',now()
 from rush.evaluation_assignments where round_id='br-round';
insert into rush.criterion_ratings(evaluation_id,criterion_id,score,note)
 select id,'br-criterion',4,'Observed a clear evidence-based contribution.' from rush.evaluations where rubric_id='br-rubric';
insert into rush.decisions(id,cycle_id,application_id,outcome,status,reason,created_by_id,hash_derived)
 select 'br-decision'||n,'br-cycle','br-app'||n,'OFFER','LOCKED','Synthetic release fixture','52000000-0000-4000-8000-000000000001',n<>5 from generate_series(1,6) n;
insert into rush.conflict_declarations(application_id,declarer_id,reason) values('br-app2','52000000-0000-4000-8000-000000000001','Synthetic caller recusal');
-- Fail after state updates when the outbox is inserted: the item's entire
-- subtransaction must roll back, while the independent ready item succeeds.
create function pg_temp.fail_fixture_outbox() returns trigger language plpgsql as $$ begin
 if new.decision_id='br-decision6' then raise exception 'provider secret email@example.invalid' using errcode='XX000'; end if;
 return new;
end $$;
create trigger fail_fixture_outbox before insert on rush.notification_outbox for each row execute function pg_temp.fail_fixture_outbox();
set local "request.jwt.claim.sub" = '52000000-0000-4000-8000-000000000001';
set local "request.jwt.claims" = '{"iss":"http://127.0.0.1:54321/auth/v1","sub":"52000000-0000-4000-8000-000000000001","role":"authenticated"}';
select extensions.ok(not has_function_privilege('anon','rush.decision_release_preflight(text)','EXECUTE'),'preflight is not anonymous');
select extensions.ok(not has_function_privilege('authenticated','rush.decision_release_blocker(text)','EXECUTE'),'private blocker cannot be probed directly');
select extensions.is(rush.decision_release_blocker('br-decision1'),null::text,'hash-derived ready decision is eligible without manual approvals');
select extensions.is(rush.decision_release_blocker('br-decision2'),'ACTOR_CONFLICT','caller recusal is explicit');
select extensions.is(rush.decision_release_blocker('br-decision3'),'APPLICATION_WITHDRAWN','withdrawal is explicit');
select extensions.is(rush.decision_release_blocker('br-decision4'),'EVIDENCE_NOT_READY','incomplete evidence is explicit');
select extensions.is(rush.decision_release_blocker('br-decision5'),'APPROVALS_REQUIRED','lost/missing quorum is explicit');
create temporary table br_preflight as select rush.decision_release_preflight('br-cycle') as value;
select extensions.is(jsonb_array_length((select value->'items' from br_preflight)),6,'preflight identifies every locked applicant');
select extensions.throws_ok($$select rush.release_decision_batch('br-cycle','[]'::jsonb)$$,'40001','release cohort changed; review again','stale/expanded cohort aborts before releasing');
select extensions.is((select count(*) from rush.decisions where cycle_id='br-cycle' and status='RELEASED'),0::bigint,'snapshot failure releases nobody');
update rush.decisions set outcome='WAITLIST' where id='br-decision1';
select extensions.throws_ok($$select rush.release_decision_batch('br-cycle',(select value->'items' from br_preflight))$$,'40001','release cohort changed; review again','changed outcome invalidates confirmation');
update rush.decisions set outcome='OFFER' where id='br-decision1';
insert into rush.decision_approvals(decision_id,approver_id) values('br-decision5','52000000-0000-4000-8000-000000000001');
select extensions.is(rush.decision_release_blocker('br-decision5'),'APPROVALS_REQUIRED','one approval cannot satisfy manual quorum');
insert into rush.decision_approvals(decision_id,approver_id) values('br-decision5','52000000-0000-4000-8000-000000000002');
select extensions.throws_ok($$select rush.release_decision_batch('br-cycle',(select value->'items' from br_preflight))$$,'40001','release cohort changed; review again','changed eligibility invalidates confirmation before newly eligible outcome can release');
delete from rush.decision_approvals where decision_id='br-decision5';
create temporary table br_result as select rush.release_decision_batch('br-cycle',(select value->'items' from br_preflight)) as value;
select extensions.is((select (value->>'released')::integer from br_result),1,'ready item releases despite independent failure');
select extensions.is((select (value->>'skipped')::integer from br_result),5,'each blocked or failed item counted once');
select extensions.is((select x->>'reasonCode' from br_result,jsonb_array_elements(value->'items') x where x->>'decisionId'='br-decision6'),'RELEASE_FAILED','unexpected errors are not labeled recusal/readiness');
select extensions.ok((select value::text not like '%email@example.invalid%' and value::text not like '%provider secret%' from br_result),'response does not expose SQL/provider text');
select extensions.is((select status::text from rush.applications where id='br-app1'),'OFFERED','eligible application state commits');
select extensions.is((select status::text from rush.applications where id='br-app6'),'FINAL_REVIEW','failed item application update rolled back');
select extensions.is((select status::text from rush.decisions where id='br-decision6'),'LOCKED','failed item decision update rolled back');
select extensions.is((select count(*) from rush.notification_outbox where decision_id='br-decision1'),1::bigint,'released applicant has one durable notification');
select extensions.is((select count(*) from rush.notification_outbox where decision_id='br-decision6'),0::bigint,'failed applicant has no partial notification');
select extensions.lives_ok($$select rush.release_ready_decisions('br-cycle')$$,'legacy aggregate wrapper remains callable for retries');
select extensions.is((select count(*) from rush.notification_outbox where decision_id='br-decision1'),1::bigint,'retry never duplicates prior released notification');
drop trigger fail_fixture_outbox on rush.notification_outbox;
select extensions.is((rush.release_ready_decisions('br-cycle')->>'released')::integer,1,'retry releases the previously failed applicant after failure is resolved');
select extensions.is((select count(*) from rush.notification_outbox where decision_id='br-decision6'),1::bigint,'resolved retry creates exactly one notification');
select extensions.is((select status::text from rush.applications where id='br-app3'),'WITHDRAWN','withdrawn applicant remains withdrawn across every retry');
set local "request.jwt.claims" = '{"iss":"http://127.0.0.1:54321/auth/v1","sub":"missing-person","role":"authenticated"}';
select extensions.throws_ok($$select rush.decision_release_preflight('br-cycle')$$,'42501','unauthorized','unmapped identity cannot inspect a cohort');
select * from extensions.finish();
rollback;
