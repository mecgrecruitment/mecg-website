\set ON_ERROR_STOP on
-- 1 member/lead, 2 board, 3 member not on the project, 4 owner in another cycle, 5 second staffer
insert into rush.profiles(id,display_name) values('00000000-0000-4000-8000-000000000001','Lead'),('00000000-0000-4000-8000-000000000002','Board'),
 ('00000000-0000-4000-8000-000000000003','Outsider'),('00000000-0000-4000-8000-000000000004','Owner'),('00000000-0000-4000-8000-000000000005','Staffer');
insert into rush.memberships(cycle_id,user_id,role) values('test','00000000-0000-4000-8000-000000000001','MEMBER'),('test','00000000-0000-4000-8000-000000000002','BOARD'),
 ('test','00000000-0000-4000-8000-000000000003','MEMBER'),('other','00000000-0000-4000-8000-000000000004','OWNER'),('test','00000000-0000-4000-8000-000000000005','MEMBER');
insert into rush.projects(id,title,sort_order) values('p1','Alpha',1),('p2','Beta',2);
insert into rush.project_members(project_id,user_id) values('p1','00000000-0000-4000-8000-000000000001'),('p1','00000000-0000-4000-8000-000000000005'),('p2','00000000-0000-4000-8000-000000000005');
create function pg_temp.expect_error(command text,expected text) returns void language plpgsql as $$begin execute command; raise exception 'Expected error %',expected; exception when others then if sqlstate<>expected then raise;end if;end$$;
set role authenticated;

-- Direct table access is denied to every signed-in role.
select set_config('test.actor','00000000-0000-4000-8000-000000000002',false);
select pg_temp.expect_error($q$select * from rush.project_delivery$q$,'42501');
select pg_temp.expect_error($q$select rush.engagement_lock('p1',0)$q$,'42501');

-- Board sees every project with default delivery state at revision 0.
do $$begin if jsonb_array_length(rush.engagement_tracker()->'projects')<>2 or rush.engagement_tracker()->>'canManage'<>'true'
 or rush.engagement_tracker()->'projects'->0->>'status'<>'SCOPING' or (rush.engagement_tracker()->'projects'->0->>'revision')::int<>0 then raise exception 'board tracker wrong';end if;end$$;
-- A member who leads nothing sees nothing and cannot write.
select set_config('test.actor','00000000-0000-4000-8000-000000000001',false);
do $$begin if rush.engagement_tracker()->'projects'<>'[]'::jsonb or rush.engagement_tracker()->>'canManage'<>'false' then raise exception 'non-lead saw projects';end if;end$$;
select pg_temp.expect_error($q$select rush.save_project_delivery('p1',0,'{"status":"ACTIVE","milestones":[],"risks":[],"lastContactOn":"","lastContactNote":""}')$q$,'42501');
select pg_temp.expect_error($q$select rush.set_project_lead('p1',0,'00000000-0000-4000-8000-000000000001')$q$,'42501');

-- Board cannot make an unstaffed member lead; can make a staffed one.
select set_config('test.actor','00000000-0000-4000-8000-000000000002',false);
select pg_temp.expect_error($q$select rush.set_project_lead('p1',0,'00000000-0000-4000-8000-000000000003')$q$,'22023');
select rush.set_project_lead('p1',0,'00000000-0000-4000-8000-000000000001');
-- Stale revision is refused.
select pg_temp.expect_error($q$select rush.set_project_lead('p1',0,null)$q$,'55000');
-- Board cannot set health (lead-set only).
select pg_temp.expect_error($q$select rush.set_project_health('p1',1,'ON_TRACK','')$q$,'42501');

-- Lead sees only their project, and edits it.
select set_config('test.actor','00000000-0000-4000-8000-000000000001',false);
do $$begin if jsonb_array_length(rush.engagement_tracker()->'projects')<>1 or rush.engagement_tracker()->'projects'->0->>'projectId'<>'p1'
 or rush.engagement_tracker()->'projects'->0->>'isLead'<>'true' then raise exception 'lead scope wrong';end if;end$$;
do $$begin if not rush.engagement_leads_any() then raise exception 'lead nav hint missing';end if;end$$;
select rush.save_project_delivery('p1',1,'{"status":"ACTIVE","milestones":[{"id":"m1","title":"Kickoff","due":"2026-11-20","done":""}],"risks":[{"id":"r1","kind":"BLOCKER","text":"Waiting on client data","status":"OPEN"}],"lastContactOn":"2026-11-17","lastContactNote":"Weekly call"}');
select pg_temp.expect_error($q$select rush.save_project_delivery('p2',0,'{"status":"ACTIVE","milestones":[],"risks":[],"lastContactOn":"","lastContactNote":""}')$q$,'42501');
select pg_temp.expect_error($q$select rush.save_project_delivery('p1',1,'{"status":"ACTIVE","milestones":[],"risks":[],"lastContactOn":"","lastContactNote":""}')$q$,'55000');
-- Validation: unknown key, bad status, bad date, empty milestone, bad risk kind, injected lead/health.
select pg_temp.expect_error($q$select rush.save_project_delivery('p1',2,'{"status":"ACTIVE","milestones":[],"risks":[],"lastContactOn":"","lastContactNote":"","health":"ON_TRACK"}')$q$,'22023');
select pg_temp.expect_error($q$select rush.save_project_delivery('p1',2,'{"status":"DONE","milestones":[],"risks":[],"lastContactOn":"","lastContactNote":""}')$q$,'22023');
select pg_temp.expect_error($q$select rush.save_project_delivery('p1',2,'{"status":"ACTIVE","milestones":[],"risks":[],"lastContactOn":"2026-02-30","lastContactNote":""}')$q$,'22023');
select pg_temp.expect_error($q$select rush.save_project_delivery('p1',2,'{"status":"ACTIVE","milestones":[{"id":"m1","title":"","due":"2026-11-20","done":""}],"risks":[],"lastContactOn":"","lastContactNote":""}')$q$,'22023');
select pg_temp.expect_error($q$select rush.save_project_delivery('p1',2,'{"status":"ACTIVE","milestones":[],"risks":[{"id":"r1","kind":"ISSUE","text":"x","status":"OPEN"}],"lastContactOn":"","lastContactNote":""}')$q$,'22023');
-- Health: risk flags need a note; lead sets it and it is stamped.
select pg_temp.expect_error($q$select rush.set_project_health('p1',2,'AT_RISK','  ')$q$,'22023');
select rush.set_project_health('p1',2,'AT_RISK','Client data is a week late');
do $$declare p jsonb := rush.engagement_tracker()->'projects'->0; begin
 if p->>'health'<>'AT_RISK' or p->>'healthSetAt' is null or p->>'healthSetByName'<>'Lead' or (p->>'revision')::int<>3 or p->>'lastContactOn'<>'2026-11-17'
  or jsonb_array_length(p->'milestones')<>1 then raise exception 'lead save not persisted: %',p;end if;end$$;

-- A staffer who is not lead cannot read or write.
select set_config('test.actor','00000000-0000-4000-8000-000000000005',false);
do $$begin if rush.engagement_tracker()->'projects'<>'[]'::jsonb or rush.engagement_leads_any() then raise exception 'staffer saw delivery';end if;end$$;
select pg_temp.expect_error($q$select rush.set_project_health('p1',3,'ON_TRACK','')$q$,'42501');
-- An owner from another cycle counts as board (projects are org-wide).
select set_config('test.actor','00000000-0000-4000-8000-000000000004',false);
do $$begin if jsonb_array_length(rush.engagement_tracker()->'projects')<>2 then raise exception 'owner cannot read';end if;end$$;
-- Board edits status but the health flag is unchanged by its save.
select set_config('test.actor','00000000-0000-4000-8000-000000000002',false);
select rush.save_project_delivery('p1',3,'{"status":"FINAL","milestones":[],"risks":[],"lastContactOn":"","lastContactNote":""}');
do $$begin if rush.engagement_tracker()->'projects'->0->>'health'<>'AT_RISK' or rush.engagement_tracker()->'projects'->0->>'status'<>'FINAL' then raise exception 'board save lost health';end if;end$$;

-- Audit metadata records counts and states, never the free-text notes.
reset role;
do $$begin
 if (select count(*) from rush.audit_events where resource_id='p1')<>4 then raise exception 'audit count wrong';end if;
 if exists(select 1 from rush.audit_events where metadata::text ~ '(Weekly call|Waiting on client|week late|Kickoff)') then raise exception 'audit leaked content';end if;
end$$;

-- Removing the lead from staffing removes their access.
delete from rush.project_members where project_id='p1' and user_id='00000000-0000-4000-8000-000000000001';
set role authenticated;
select set_config('test.actor','00000000-0000-4000-8000-000000000001',false);
do $$begin if rush.engagement_tracker()->'projects'<>'[]'::jsonb or rush.engagement_leads_any() then raise exception 'unstaffed lead kept access';end if;end$$;
select pg_temp.expect_error($q$select rush.save_project_delivery('p1',4,'{"status":"ACTIVE","milestones":[],"risks":[],"lastContactOn":"","lastContactNote":""}')$q$,'42501');
select set_config('test.actor','00000000-0000-4000-8000-000000000002',false);
do $$begin if rush.engagement_tracker()->'projects'->0->>'leadStaffed'<>'false' then raise exception 'board not told lead left';end if;end$$;
-- Deactivated board loses access.
reset role;
update rush.memberships set active=false where user_id='00000000-0000-4000-8000-000000000002';
set role authenticated;
select pg_temp.expect_error($q$select rush.engagement_tracker()$q$,'42501');
-- Anonymous callers cannot execute anything.
reset role;
set role anon;
select pg_temp.expect_error($q$select rush.engagement_tracker()$q$,'42501');
reset role;
select 'engagement tracker assertions passed' as result;
