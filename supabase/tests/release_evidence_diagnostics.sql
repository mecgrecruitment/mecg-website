begin;
set local role postgres;
set local search_path = extensions, public;
select extensions.plan(34);
insert into auth.users(id,email,raw_user_meta_data) values
 ('53000000-0000-4000-8000-000000000001','release-owner@example.invalid','{"display_name":"Release owner"}'::jsonb),
 ('53000000-0000-4000-8000-000000000002','release-reviewer@example.invalid','{"display_name":"Release reviewer"}'::jsonb);
-- Synthetic provider mappings are explicit; auth.users provisioning alone does
-- not establish the issuer/subject identity used by provider-neutral RPCs.
insert into rush.auth_identities(issuer,subject,app_user_id) values
 ('http://127.0.0.1:54321/auth/v1','53000000-0000-4000-8000-000000000001','53000000-0000-4000-8000-000000000001'),
 ('http://127.0.0.1:54321/auth/v1','53000000-0000-4000-8000-000000000002','53000000-0000-4000-8000-000000000002')
on conflict (issuer,subject) do nothing;
update rush.rush_cycles set status='CLOSED' where status in ('DRAFT','OPEN','IN_PROCESS','DECISION_LOCK');
insert into rush.rush_cycles(id,name,status) values('ed-cycle','Batch release fixture','DECISION_LOCK');
insert into rush.memberships(user_id,cycle_id,role) values
 ('53000000-0000-4000-8000-000000000001','ed-cycle','OWNER'),
 ('53000000-0000-4000-8000-000000000002','ed-cycle','PANEL');
insert into rush.pnms(id,name,contact,normalized_contact)
 select 'ed-pnm'||n,'Synthetic '||n,'release'||n||'@example.invalid','release'||n||'@example.invalid' from generate_series(1,6) n;
insert into rush.applications(id,pnm_id,cycle_id,status,submitted_at)
 select 'ed-app'||n,'ed-pnm'||n,'ed-cycle',case when n=3 then 'WITHDRAWN'::rush.application_status else 'FINAL_REVIEW'::rush.application_status end,now() from generate_series(1,6) n;
insert into rush.rounds(id,cycle_id,kind,name,status,weight) values('ed-round','ed-cycle','GROUP_CASE','Fixture evidence','FROZEN',100);
insert into rush.rubrics(id,round_id,version,minimum_observed_criteria) values('ed-rubric','ed-round',1,1);
insert into rush.rubric_criteria(id,rubric_id,key,name,weight,required,position) values('ed-criterion','ed-rubric','evidence','Evidence',100,true,0);
insert into rush.evaluation_assignments(id,round_id,application_id,evaluator_id)
 select 'ed-assignment-'||n||'-'||u,'ed-round','ed-app'||n,('53000000-0000-4000-8000-00000000000'||u)::uuid
 from generate_series(1,6) n cross join generate_series(1,2) u where n<>4;
-- Both synthetic evaluators acknowledged this exact active rubric before
-- their locked evidence was recorded. Preserve the production trigger.
insert into rush.round_calibration_acknowledgements(round_id,rubric_id,evaluator_id)
 select distinct round_id,'ed-rubric',evaluator_id from rush.evaluation_assignments where round_id='ed-round';
insert into rush.evaluations(id,assignment_id,evaluator_id,rubric_id,status,evidence,submitted_at)
 select 'ed-evaluation-'||id,id,evaluator_id,'ed-rubric','LOCKED','Specific synthetic evidence supporting the observed rating.',now()
 from rush.evaluation_assignments where round_id='ed-round';
insert into rush.criterion_ratings(evaluation_id,criterion_id,score,note)
 select id,'ed-criterion',4,'Observed a clear evidence-based contribution.' from rush.evaluations where rubric_id='ed-rubric';

-- Snapshot the exact preceding readiness definition for parity assertions.
create or replace function pg_temp.previous_readiness(target_application_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from rush.applications a
    join rush.rounds r on r.cycle_id = a.cycle_id and r.weight > 0
    where a.id = target_application_id and a.status not in ('DRAFT', 'WITHDRAWN')
  ) and not exists (
    select 1
    from rush.applications a
    join rush.rounds r on r.cycle_id = a.cycle_id and r.weight > 0
    where a.id = target_application_id
      and (
        r.status not in ('FROZEN', 'FINALIZED')
        or (
          select count(distinct ea.evaluator_id)
          from rush.evaluation_assignments ea
          join lateral (
            select evaluation.* from rush.evaluations evaluation
            where evaluation.assignment_id = ea.id and evaluation.voided_at is null
            order by evaluation.version desc limit 1
          ) e on true
          join rush.rubrics rubric on rubric.id = e.rubric_id and rubric.round_id = r.id
            and rubric.id = (select active.id from rush.rubrics active where active.round_id = r.id order by active.version desc limit 1)
          cross join lateral rush.evaluation_observation_quality(e.id) quality
          where ea.round_id = r.id
            and ea.application_id = a.id
            and e.status = 'LOCKED' and quality.valid
            and not exists (select 1 from rush.conflict_declarations conflict
              where conflict.application_id = a.id and conflict.declarer_id = ea.evaluator_id)
        ) < 2
      )
  );
$$;

select extensions.ok(not has_function_privilege('anon','rush.decision_evidence_diagnostics(text)','EXECUTE'),'anonymous cannot execute diagnostics');
select extensions.ok(not has_function_privilege('authenticated','rush.decision_evidence_rounds(text)','EXECUTE'),'private evidence helper cannot be probed');
select extensions.ok(has_function_privilege('authenticated','rush.decision_evidence_diagnostics(text)','EXECUTE'),'authenticated guarded surface is available');
select extensions.ok((select bool_and(rush.is_decision_ready(id) = pg_temp.previous_readiness(id)) from rush.applications where cycle_id='ed-cycle'),'factored readiness matches preceding definition for all initial fixtures');
set local "request.jwt.claim.sub" = '53000000-0000-4000-8000-000000000001';
set local "request.jwt.claims" = '{"iss":"http://127.0.0.1:54321/auth/v1","sub":"53000000-0000-4000-8000-000000000001","role":"authenticated"}';
set local role authenticated;
select extensions.is(rush.decision_evidence_diagnostics('ed-app1')->>'ready','true','two valid locked independent observations are ready');
select extensions.is(rush.decision_evidence_diagnostics('ed-app1')#>>'{rounds,0,validLockedEvaluations}','2','canonical valid count is exposed');
select extensions.is(rush.decision_evidence_diagnostics('ed-app1')#>'{rounds,0,blockers}','[]'::jsonb,'complete frozen round has no blockers');
select extensions.is(rush.decision_evidence_diagnostics('ed-app4')#>'{rounds,0,blockers}','["VALID_LOCKED_EVALUATIONS_MISSING"]'::jsonb,'unstaffed closed round identifies insufficient evidence');
select extensions.is(rush.decision_evidence_diagnostics('ed-app3')->'blockers','["APPLICATION_INELIGIBLE"]'::jsonb,'withdrawn eligibility is explicit');
select extensions.throws_ok($$select rush.decision_evidence_diagnostics('missing')$$,'42501','application unavailable','missing applications do not expose existence details');
select extensions.ok(rush.decision_evidence_diagnostics('ed-app1')::text !~ '("evaluatorId"|"evidence"|"score"|"note"|@example)' ,'diagnostic exposes no evaluator identity, notes, scores or applicant contact');
set local role postgres;
-- Missing required ratings are diagnostic names, not a substitute for all quality gates.
delete from rush.criterion_ratings where evaluation_id='ed-evaluation-ed-assignment-1-2';
select extensions.is(rush.decision_evidence_diagnostics('ed-app1')#>'{rounds,0,missingRequiredCriteria}','["Evidence"]'::jsonb,'current locked evaluation missing required criterion is named');
select extensions.is(rush.decision_evidence_diagnostics('ed-app1')#>>'{rounds,0,validLockedEvaluations}','1','invalid locked observation is excluded from valid count');
select extensions.is(rush.is_decision_ready('ed-app1'),pg_temp.previous_readiness('ed-app1'),'partial locked evidence parity');
update rush.rounds set status='ACTIVE' where id='ed-round';
select extensions.is(rush.decision_evidence_diagnostics('ed-app1')#>'{rounds,0,blockers}','["ROUND_NOT_CLOSED","VALID_LOCKED_EVALUATIONS_MISSING"]'::jsonb,'open partial round shows both independent blockers');
select extensions.is(rush.is_decision_ready('ed-app2'),pg_temp.previous_readiness('ed-app2'),'open round parity');
insert into rush.conflict_declarations(application_id,declarer_id,reason) values('ed-app2','53000000-0000-4000-8000-000000000002','Synthetic evaluator recusal');
select extensions.is(rush.decision_evidence_diagnostics('ed-app2')#>>'{rounds,0,validLockedEvaluations}','1','conflicted evaluator does not count');
select extensions.is(rush.is_decision_ready('ed-app2'),pg_temp.previous_readiness('ed-app2'),'recusal parity');
insert into rush.conflict_declarations(application_id,declarer_id,reason) values('ed-app1','53000000-0000-4000-8000-000000000001','Synthetic operator recusal');
select extensions.throws_ok($$select rush.decision_evidence_diagnostics('ed-app1')$$,'42501','conflict declared','operator recusal prevents diagnostic access');
update rush.rounds set status='FROZEN' where id='ed-round';
insert into rush.evaluations(id,assignment_id,evaluator_id,rubric_id,version,status)
 values('ed-newer-draft','ed-assignment-5-2','53000000-0000-4000-8000-000000000002','ed-rubric',2,'DRAFT');
select extensions.is(rush.decision_evidence_diagnostics('ed-app5')#>>'{rounds,0,validLockedEvaluations}','1','a newer nonvoid draft supersedes the older locked observation');
select extensions.is(rush.is_decision_ready('ed-app5'),pg_temp.previous_readiness('ed-app5'),'latest nonvoid draft parity');
update rush.evaluations set voided_at=now() where id='ed-newer-draft';
select extensions.is(rush.decision_evidence_diagnostics('ed-app5')#>>'{rounds,0,validLockedEvaluations}','2','voided newer draft falls back to latest nonvoid locked observation');
select extensions.is(rush.is_decision_ready('ed-app5'),pg_temp.previous_readiness('ed-app5'),'voided latest observation parity');
insert into rush.rubrics(id,round_id,version,minimum_observed_criteria) values('ed-new-rubric','ed-round',2,1);
select extensions.is(rush.decision_evidence_diagnostics('ed-app5')#>>'{rounds,0,validLockedEvaluations}','0','old rubric observations do not count');
select extensions.is(rush.decision_evidence_diagnostics('ed-app5')#>'{rounds,0,missingRequiredCriteria}','[]'::jsonb,'old rubric missing criteria are not presented as current rubric blockers');
select extensions.is(rush.is_decision_ready('ed-app5'),pg_temp.previous_readiness('ed-app5'),'active rubric parity');
delete from rush.rubrics where id='ed-new-rubric';
insert into rush.rush_cycles(id,name,status) values('ed-other-cycle','Other cohort','CLOSED');
insert into rush.pnms(id,name,contact,normalized_contact) values('ed-other-pnm','Synthetic other','other@example.invalid','other@example.invalid');
insert into rush.applications(id,pnm_id,cycle_id,status) values('ed-other-app','ed-other-pnm','ed-other-cycle','DRAFT');
select extensions.throws_ok($$select rush.decision_evidence_diagnostics('ed-other-app')$$,'42501','application unavailable','membership in one cycle does not grant another cycle diagnostic access');
set local "request.jwt.claims" = '{"iss":"http://127.0.0.1:54321/auth/v1","sub":"53000000-0000-4000-8000-000000000002","role":"authenticated"}';
select extensions.is(rush.decision_evidence_diagnostics('ed-app5')->>'ready','true','nonrecused current-cycle PANEL member can read diagnostics');
set local "request.jwt.claims" = '{"iss":"http://127.0.0.1:54321/auth/v1","sub":"53000000-0000-4000-8000-000000000001","role":"authenticated"}';
update rush.rounds set weight=0 where id='ed-round';
select extensions.is(rush.decision_evidence_diagnostics('ed-app2')->'blockers','["NO_REQUIRED_ROUNDS"]'::jsonb,'zero-weight rounds are not required');
select extensions.is(rush.is_decision_ready('ed-app2'),pg_temp.previous_readiness('ed-app2'),'no required round parity');
set local "request.jwt.claims" = '{"iss":"http://127.0.0.1:54321/auth/v1","sub":"unmapped","role":"authenticated"}';
select extensions.throws_ok($$select rush.decision_evidence_diagnostics('ed-app2')$$,'42501','unauthorized','unmapped identity is denied');
set local "request.jwt.claims" = '{"iss":"http://127.0.0.1:54321/auth/v1","sub":"53000000-0000-4000-8000-000000000001","role":"authenticated"}';
update rush.memberships set active=false where cycle_id='ed-cycle' and user_id='53000000-0000-4000-8000-000000000001';
select extensions.throws_ok($$select rush.decision_evidence_diagnostics('ed-app2')$$,'42501','application unavailable','revoked cycle membership is denied');
update rush.memberships set active=true,role='MEMBER' where cycle_id='ed-cycle' and user_id='53000000-0000-4000-8000-000000000001';
select extensions.throws_ok($$select rush.decision_evidence_diagnostics('ed-app2')$$,'42501','application unavailable','ordinary evaluator cannot inspect release diagnostics');
select extensions.is(rush.is_decision_ready('missing'),pg_temp.previous_readiness('missing'),'missing application parity');
select * from extensions.finish();
rollback;
