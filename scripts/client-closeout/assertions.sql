\set ON_ERROR_STOP on
-- 1 lead, 2 board, 3 member not on the project, 4 owner of another cycle, 5 evidence reviewer
insert into rush.rush_cycles(id) values('test'),('other');
insert into rush.profiles(id,display_name) values('00000000-0000-4000-8000-000000000001','Lead'),('00000000-0000-4000-8000-000000000002','Board'),
 ('00000000-0000-4000-8000-000000000003','Outsider'),('00000000-0000-4000-8000-000000000004','Owner'),('00000000-0000-4000-8000-000000000005','Reviewer');
insert into rush.memberships(cycle_id,user_id,role) values('test','00000000-0000-4000-8000-000000000001','MEMBER'),('test','00000000-0000-4000-8000-000000000002','BOARD'),
 ('test','00000000-0000-4000-8000-000000000003','MEMBER'),('other','00000000-0000-4000-8000-000000000004','OWNER'),('test','00000000-0000-4000-8000-000000000005','MEMBER'),
 ('other','00000000-0000-4000-8000-000000000002','BOARD');
insert into rush.member_tool_reviewers values('test','evidence','00000000-0000-4000-8000-000000000005');
insert into rush.projects(id,title,client_label,sort_order) values('p1','Alpha pricing study','Synthetic Client',1),('p2','Beta','',2);
insert into rush.project_members(project_id,user_id) values('p1','00000000-0000-4000-8000-000000000001');
create function pg_temp.assert(ok boolean,message text) returns void language plpgsql as $$begin if ok is not true then raise exception '%',message;end if;end$$;
create function pg_temp.expect_error(command text,expected text) returns void language plpgsql as $$begin execute command; raise exception 'Expected error %',expected; exception when others then if sqlstate<>expected then raise;end if;end$$;
set role authenticated;

-- Direct table access is denied.
select set_config('test.actor','00000000-0000-4000-8000-000000000002',false);
select pg_temp.expect_error($q$select * from rush.client_feedback$q$,'42501');
select pg_temp.expect_error($q$select rush.client_feedback_json('p1')$q$,'42501');
do $$begin if rush.client_closeout_overview()<>'[]'::jsonb then raise exception 'overview not empty';end if;end$$;

-- A link needs a Closed project with a lead who is a member of the cycle.
select pg_temp.expect_error($q$select rush.create_client_feedback_link('p1','test')$q$,'22023');
select rush.set_project_lead('p1',0,'00000000-0000-4000-8000-000000000001');
select rush.save_project_delivery('p1',1,'{"status":"ACTIVE","milestones":[],"risks":[],"lastContactOn":"","lastContactNote":""}');
select pg_temp.expect_error($q$select rush.create_client_feedback_link('p1','test')$q$,'22023');
select rush.save_project_delivery('p1',2,'{"status":"CLOSED","milestones":[],"risks":[],"lastContactOn":"","lastContactNote":""}');
-- The lead is not a member of 'other', so the draft would land out of their reach.
select pg_temp.expect_error($q$select rush.create_client_feedback_link('p1','other')$q$,'22023');
-- Board in a cycle where they are not board is refused.
select pg_temp.expect_error($q$select rush.create_client_feedback_link('p1','missing')$q$,'42501');

-- The lead cannot manage links; an owner of another cycle cannot use this cycle.
select set_config('test.actor','00000000-0000-4000-8000-000000000001',false);
select pg_temp.expect_error($q$select rush.create_client_feedback_link('p1','test')$q$,'42501');
select pg_temp.expect_error($q$select rush.client_closeout_overview()$q$,'42501');
select set_config('test.actor','00000000-0000-4000-8000-000000000004',false);
select pg_temp.expect_error($q$select rush.create_client_feedback_link('p1','test')$q$,'42501');

-- Board creates a link; a second link replaces the first.
select set_config('test.actor','00000000-0000-4000-8000-000000000002',false);
select rush.create_client_feedback_link('p1','test')->>'token' as first_token \gset
select rush.create_client_feedback_link('p1','test')->>'token' as token \gset
do $$begin if rush.client_closeout_overview()->0->>'state'<>'ACTIVE' then raise exception 'link not active';end if;end$$;
reset role;
do $$begin if exists(select 1 from rush.client_feedback where token_digest !~ '^[0-9a-f]{64}$') then raise exception 'raw token stored';end if;end$$;
select pg_temp.assert(not exists(select 1 from rush.client_feedback where token_digest=:'token'),'raw token stored');

-- The client form works without signing in, and only with the current token.
set role anon;
select pg_temp.expect_error($q$select rush.client_closeout_overview()$q$,'42501');
select pg_temp.expect_error($q$select rush.create_client_feedback_link('p1','test')$q$,'42501');
select pg_temp.assert(rush.client_feedback_form(:'first_token') is null,'replaced token still works');
select pg_temp.assert(rush.client_feedback_form(:'token')->>'projectTitle'='Alpha pricing study','form title wrong');
select pg_temp.assert(not (rush.client_feedback_form(:'token') ? 'leadName'),'form exposes team');
select pg_temp.assert(rush.client_feedback_form('not-a-token') is null,'bad token accepted');

-- Whitespace-only quote cannot carry a quote permission.
select pg_temp.expect_error(format($q$select rush.submit_client_feedback(%L,'{"satisfaction":4,"wouldRehire":"YES","quote":"\n\t","attribution":"","quotePermission":true,"logoPermission":false,"permissionScope":"Website"}')$q$,:'token'),'22023');
-- Reopening the project makes the link inactive without using it up.
reset role; set role authenticated;
select set_config('test.actor','00000000-0000-4000-8000-000000000002',false);
select rush.save_project_delivery('p1',3,'{"status":"ACTIVE","milestones":[],"risks":[],"lastContactOn":"","lastContactNote":""}');
reset role; set role anon;
select pg_temp.expect_error(format($q$select rush.submit_client_feedback(%L,'{"satisfaction":4,"wouldRehire":"YES","quote":"","attribution":"","quotePermission":false,"logoPermission":false,"permissionScope":""}')$q$,:'token'),'55000');
reset role; set role authenticated;
select rush.save_project_delivery('p1',4,'{"status":"CLOSED","milestones":[],"risks":[],"lastContactOn":"","lastContactNote":""}');
-- A lead who leaves the cycle makes the link inactive too.
reset role;
update rush.memberships set active=false where user_id='00000000-0000-4000-8000-000000000001';
set role anon;
select pg_temp.expect_error(format($q$select rush.submit_client_feedback(%L,'{"satisfaction":4,"wouldRehire":"YES","quote":"","attribution":"","quotePermission":false,"logoPermission":false,"permissionScope":""}')$q$,:'token'),'55000');
reset role;
update rush.memberships set active=true where user_id='00000000-0000-4000-8000-000000000001';
set role anon;
-- Validation.
select pg_temp.expect_error(format($q$select rush.submit_client_feedback(%L,'{"satisfaction":6,"wouldRehire":"YES","quote":"","attribution":"","quotePermission":false,"logoPermission":false,"permissionScope":""}')$q$,:'token'),'22023');
select pg_temp.expect_error(format($q$select rush.submit_client_feedback(%L,'{"satisfaction":4.5,"wouldRehire":"YES","quote":"","attribution":"","quotePermission":false,"logoPermission":false,"permissionScope":""}')$q$,:'token'),'22023');
select pg_temp.expect_error(format($q$select rush.submit_client_feedback(%L,'{"satisfaction":4,"wouldRehire":"SURE","quote":"","attribution":"","quotePermission":false,"logoPermission":false,"permissionScope":""}')$q$,:'token'),'22023');
select pg_temp.expect_error(format($q$select rush.submit_client_feedback(%L,'{"satisfaction":4,"wouldRehire":"YES","quote":"","attribution":"","quotePermission":true,"logoPermission":false,"permissionScope":"Website"}')$q$,:'token'),'22023');
select pg_temp.expect_error(format($q$select rush.submit_client_feedback(%L,'{"satisfaction":4,"wouldRehire":"YES","quote":"","attribution":"","quotePermission":false,"logoPermission":true,"permissionScope":""}')$q$,:'token'),'22023');
select pg_temp.expect_error(format($q$select rush.submit_client_feedback(%L,'{"satisfaction":4,"wouldRehire":"YES","quote":"","attribution":"","quotePermission":false,"logoPermission":false,"permissionScope":"","leadId":"x"}')$q$,:'token'),'22023');
select pg_temp.expect_error($q$select rush.submit_client_feedback('0000000000000000000000000000000000000000000000000000000000000000','{"satisfaction":4,"wouldRehire":"YES","quote":"","attribution":"","quotePermission":false,"logoPermission":false,"permissionScope":""}')$q$,'P0002');

-- A valid submission consumes the link and creates the lead's draft evidence.
select rush.submit_client_feedback(:'token','{"satisfaction":5,"wouldRehire":"YES","quote":"They found the margin leak in two weeks.","attribution":"Ops director","quotePermission":true,"logoPermission":false,"permissionScope":"MECG website and recruiting deck"}');
select pg_temp.expect_error(format($q$select rush.submit_client_feedback(%L,'{"satisfaction":1,"wouldRehire":"NO","quote":"","attribution":"","quotePermission":false,"logoPermission":false,"permissionScope":""}')$q$,:'token'),'P0002');
select pg_temp.assert(rush.client_feedback_form(:'token') is null,'used token still works');
reset role;
do $$declare r rush.member_tool_records%rowtype;begin
 select * into r from rush.member_tool_records where id=(select evidence_record_id from rush.client_feedback where project_id='p1');
 if r.owner_id<>'00000000-0000-4000-8000-000000000001' or r.kind<>'evidence' or r.cycle_id<>'test' or r.revision<>1
  or r.review->>'verification'<>'Pending' or r.review->>'sharing'<>'Restricted' then raise exception 'draft evidence wrong %',to_jsonb(r);end if;
 if r.content->>'title'<>'Alpha pricing study' or r.content->>'result' !~ 'satisfaction 5 of 5' or r.content->>'result' !~ 'margin leak'
  or r.content->>'allowedUse' !~ 'quote may be used; logo not permitted' or r.content ? 'source' then raise exception 'draft content wrong %',r.content;end if;
end$$;
set role authenticated;

-- Board sees the response; a received project cannot get another link.
select set_config('test.actor','00000000-0000-4000-8000-000000000002',false);
do $$declare o jsonb := rush.client_closeout_overview()->0;begin
 if o->>'state'<>'RECEIVED' or (o->>'satisfaction')::int<>5 or o->>'wouldRehire'<>'YES' or o->>'evidenceCreated'<>'true' or o->>'quotePermission'<>'true' then raise exception 'overview wrong %',o;end if;end$$;
select pg_temp.expect_error($q$select rush.create_client_feedback_link('p1','test')$q$,'55000');
select pg_temp.expect_error($q$select rush.revoke_client_feedback_link('p1')$q$,'55000');
-- Board rank alone does not read the lead's evidence record.
do $$begin if jsonb_array_length(rush.member_tool_workspace('test','evidence')->'records')<>0 then raise exception 'board read private evidence';end if;end$$;

-- The lead sees the draft; a reviewer cannot clear it until it is complete.
select set_config('test.actor','00000000-0000-4000-8000-000000000001',false);
select (rush.member_tool_workspace('test','evidence')->'records'->0->>'id') as draft_id \gset
select set_config('test.actor','00000000-0000-4000-8000-000000000005',false);
select pg_temp.expect_error(format($q$select rush.review_member_tool('test','evidence',%L,1,'{"verification":"Verified","sharing":"Restricted","note":"Checked","source":"","scope":""}')$q$,:'draft_id'),'22023');
-- Pending/Restricted notes are still allowed on a draft.
select rush.review_member_tool('test','evidence',:'draft_id',1,'{"verification":"Pending","sharing":"Restricted","note":"","source":"","scope":""}');
select set_config('test.actor','00000000-0000-4000-8000-000000000001',false);
select rush.save_member_tool('test','evidence',:'draft_id',2,'{"title":"Alpha pricing study","problem":"Margins fell.","approach":"I built the cost model.","source":"https://example.com/deck","result":"Client reported savings.","measurement":"Client report; not audited.","feedback":"","permission":"","allowedUse":"Website"}');
select set_config('test.actor','00000000-0000-4000-8000-000000000005',false);
select rush.review_member_tool('test','evidence',:'draft_id',3,'{"verification":"Verified","sharing":"Restricted","note":"Checked deck","source":"","scope":""}');

-- Revoke and expiry.
select set_config('test.actor','00000000-0000-4000-8000-000000000002',false);
select rush.set_project_lead('p2',0,null);
reset role;
insert into rush.project_members(project_id,user_id) values('p2','00000000-0000-4000-8000-000000000001');
set role authenticated;
select rush.set_project_lead('p2',1,'00000000-0000-4000-8000-000000000001');
select rush.save_project_delivery('p2',2,'{"status":"CLOSED","milestones":[],"risks":[],"lastContactOn":"","lastContactNote":""}');
select rush.create_client_feedback_link('p2','test')->>'token' as token2 \gset
select set_config('test.actor','00000000-0000-4000-8000-000000000004',false);
select pg_temp.expect_error($q$select rush.revoke_client_feedback_link('p2')$q$,'42501');
select set_config('test.actor','00000000-0000-4000-8000-000000000002',false);
select rush.revoke_client_feedback_link('p2');
do $$begin if rush.client_closeout_overview()->1->>'state'<>'REVOKED' then raise exception 'revoke state wrong';end if;end$$;
select rush.create_client_feedback_link('p2','test')->>'token' as token3 \gset
reset role;
update rush.client_feedback set expires_at=now()-interval '1 minute' where project_id='p2';
set role anon;
select pg_temp.assert(rush.client_feedback_form(:'token2') is null and rush.client_feedback_form(:'token3') is null,'revoked or expired token works');
select pg_temp.expect_error(format($q$select rush.submit_client_feedback(%L,'{"satisfaction":3,"wouldRehire":"MAYBE","quote":"","attribution":"","quotePermission":false,"logoPermission":false,"permissionScope":""}')$q$,:'token3'),'P0002');
reset role;
set role authenticated;
select set_config('test.actor','00000000-0000-4000-8000-000000000002',false);
do $$begin if rush.client_closeout_overview()->1->>'state'<>'EXPIRED' then raise exception 'expired state wrong';end if;end$$;

-- Audit metadata carries flags and IDs, never quote, scope or attribution text.
reset role;
do $$begin
 if (select count(*) from rush.audit_events where action like 'CLIENT_FEEDBACK_%')<>6 then raise exception 'audit count wrong %',(select count(*) from rush.audit_events where action like 'CLIENT_FEEDBACK_%');end if;
 if exists(select 1 from rush.audit_events where metadata::text ~ '(margin leak|Ops director|recruiting deck)') then raise exception 'audit leaked content';end if;
end$$;
-- Deactivated board loses access.
update rush.memberships set active=false where user_id='00000000-0000-4000-8000-000000000002';
set role authenticated;
select pg_temp.expect_error($q$select rush.client_closeout_overview()$q$,'42501');
reset role;
select 'client close-out assertions passed' as result;
