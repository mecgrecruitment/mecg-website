\set ON_ERROR_STOP on
-- 1 board, 2 member (complete), 3 member (gaps), 4 panel only, 5 owner of another cycle, 6 inactive profile, 7 revoked membership
insert into rush.rush_cycles values('fall'),('spring');
insert into rush.profiles(id,display_name,active) values
 ('00000000-0000-4000-8000-000000000001','Board',true),('00000000-0000-4000-8000-000000000002','Avery',true),
 ('00000000-0000-4000-8000-000000000003','Blake',true),('00000000-0000-4000-8000-000000000004','Panelist',true),
 ('00000000-0000-4000-8000-000000000005','Other owner',true),('00000000-0000-4000-8000-000000000006','Gone',false),
 ('00000000-0000-4000-8000-000000000007','Revoked',true);
insert into rush.memberships(cycle_id,user_id,role,active) values
 ('fall','00000000-0000-4000-8000-000000000001','BOARD',true),('fall','00000000-0000-4000-8000-000000000001','MEMBER',true),
 ('fall','00000000-0000-4000-8000-000000000002','MEMBER',true),('fall','00000000-0000-4000-8000-000000000003','MEMBER',true),
 ('fall','00000000-0000-4000-8000-000000000004','PANEL',true),('spring','00000000-0000-4000-8000-000000000005','OWNER',true),
 ('fall','00000000-0000-4000-8000-000000000006','MEMBER',true),('fall','00000000-0000-4000-8000-000000000007','MEMBER',false),
 ('fall','00000000-0000-4000-8000-000000000002','PANEL',true);
-- Held: e1 (closed), e2 (published, started). Not held: draft, cancelled, future, other cycle.
insert into rush.events values('e1','fall','CLOSED',now()-interval '10 days'),('e2','fall','PUBLISHED',now()-interval '1 day'),
 ('e3','fall','DRAFT',now()-interval '1 day'),('e4','fall','CANCELLED',now()-interval '1 day'),('e5','fall','PUBLISHED',now()+interval '2 days'),
 ('e6','spring','CLOSED',now()-interval '3 days');
insert into rush.member_checkins values('00000000-0000-4000-8000-000000000002','e1'),('00000000-0000-4000-8000-000000000002','e2'),
 ('00000000-0000-4000-8000-000000000002','e3'),('00000000-0000-4000-8000-000000000003','e6'),('00000000-0000-4000-8000-000000000003','e4');
insert into rush.projects values('p1'),('p2');
insert into rush.project_members values('p1','00000000-0000-4000-8000-000000000002'),('p2','00000000-0000-4000-8000-000000000002');
-- Avery: older accepted offer with an open item, newer one complete. Blake: 2 of 5 done. Declined offer ignored.
insert into rush.pnms values('n2','00000000-0000-4000-8000-000000000002'),('n3','00000000-0000-4000-8000-000000000003');
insert into rush.applications values('a2old','n2','ACCEPTED',now()-interval '400 days'),('a2','n2','ACCEPTED',now()-interval '30 days'),
 ('a3','n3','ACCEPTED',now()-interval '20 days'),('a3x','n3','DECLINED',now()-interval '5 days');
insert into rush.member_onboarding_items
 select 'a2', k, now() from unnest(array['A','B','C','D','E']) k
 union all select 'a2old', 'A', null
 union all select 'a3', k, case when k in ('A','B') then now() end from unnest(array['A','B','C','D','E']) k
 union all select 'a3x', 'A', now();
create function pg_temp.expect_error(command text,expected text) returns void language plpgsql as $$begin execute command; raise exception 'Expected error %',expected; exception when others then if sqlstate<>expected then raise;end if;end$$;
create function pg_temp.member(cycle text, uid text) returns jsonb language sql as $$
 select m from jsonb_array_elements(rush.member_standing(cycle)->'members') m where m->>'userId'=uid$$;
set role authenticated;

-- Direct table access and internal helpers are denied.
select set_config('test.actor','00000000-0000-4000-8000-000000000001',false);
select pg_temp.expect_error($q$select * from rush.member_standing_settings$q$,'42501');
select pg_temp.expect_error($q$select rush.standing_is_board('fall')$q$,'42501');
select pg_temp.expect_error($q$select rush.standing_thresholds_json('fall')$q$,'42501');

-- Board of the cycle reads it; defaults apply until saved.
do $$declare r jsonb := rush.member_standing('fall'); begin
 if r->'thresholds'<>'{"minAttendancePct":50,"minProjects":1,"requireOnboarding":true,"revision":0,"updatedAt":null,"configured":false}'::jsonb then raise exception 'default thresholds wrong: %', r->'thresholds'; end if;
 -- Board, Avery, Blake. Not: panel-only, other cycle, inactive profile, revoked membership.
 if (select array_agg(m->>'name' order by m->>'name') from jsonb_array_elements(r->'members') m)<>array['Avery','Blake','Board'] then raise exception 'member set wrong: %', r->'members'; end if;
end$$;
do $$declare a jsonb := pg_temp.member('fall','00000000-0000-4000-8000-000000000002'); b jsonb := pg_temp.member('fall','00000000-0000-4000-8000-000000000003');
 o jsonb := pg_temp.member('fall','00000000-0000-4000-8000-000000000001'); begin
 if a->'roles'<>'["MEMBER","PANEL"]'::jsonb or (a->>'eventsAttended')::int<>2 or (a->>'eventsHeld')::int<>2 or (a->>'projects')::int<>2
  or (a->>'onboardingDone')::int<>5 or (a->>'onboardingTotal')::int<>5 then raise exception 'Avery wrong: %', a; end if;
 if (b->>'eventsAttended')::int<>0 or (b->>'projects')::int<>0 or (b->>'onboardingDone')::int<>2 or (b->>'onboardingTotal')::int<>5 then raise exception 'Blake wrong: %', b; end if;
 if o->'onboardingDone'<>'null'::jsonb or o->'onboardingTotal'<>'null'::jsonb or o->'roles'<>'["BOARD","MEMBER"]'::jsonb then raise exception 'Board row wrong: %', o; end if;
 -- Counts only: no event, project or onboarding detail leaves the function.
 if exists(select 1 from jsonb_object_keys(a) k where k not in ('userId','name','roles','eventsAttended','eventsHeld','projects','onboardingDone','onboardingTotal')) then raise exception 'extra keys: %', a; end if;
end$$;

-- Ordinary members, panel-only, another cycle's owner and inactive people are refused.
select set_config('test.actor','00000000-0000-4000-8000-000000000002',false);
select pg_temp.expect_error($q$select rush.member_standing('fall')$q$,'42501');
select pg_temp.expect_error($q$select rush.save_member_standing_thresholds('fall',0,60,0,false)$q$,'42501');
select set_config('test.actor','00000000-0000-4000-8000-000000000004',false);
select pg_temp.expect_error($q$select rush.member_standing('fall')$q$,'42501');
select set_config('test.actor','00000000-0000-4000-8000-000000000005',false);
select pg_temp.expect_error($q$select rush.member_standing('fall')$q$,'42501');
select pg_temp.expect_error($q$select rush.save_member_standing_thresholds('fall',0,60,0,false)$q$,'42501');
do $$begin if jsonb_array_length(rush.member_standing('spring')->'members')<>1 then raise exception 'spring owner should see own cycle';end if;end$$;
select set_config('test.actor','',false);
select pg_temp.expect_error($q$select rush.member_standing('fall')$q$,'42501');
select pg_temp.expect_error($q$select rush.member_standing(null)$q$,'42501');

-- Board saves thresholds with a revision; stale and invalid writes are refused.
select set_config('test.actor','00000000-0000-4000-8000-000000000001',false);
select pg_temp.expect_error($q$select rush.save_member_standing_thresholds('fall',0,101,1,true)$q$,'22023');
select pg_temp.expect_error($q$select rush.save_member_standing_thresholds('fall',0,50,11,true)$q$,'22023');
select pg_temp.expect_error($q$select rush.save_member_standing_thresholds('fall',0,50,1,null)$q$,'22023');
select pg_temp.expect_error($q$select rush.save_member_standing_thresholds('fall',-1,50,1,true)$q$,'22023');
do $$declare t jsonb := rush.save_member_standing_thresholds('fall',0,75,0,false); begin
 if (t->>'minAttendancePct')::int<>75 or (t->>'minProjects')::int<>0 or (t->>'requireOnboarding')::boolean or (t->>'revision')::int<>1 or not (t->>'configured')::boolean then raise exception 'save wrong: %', t; end if;
end$$;
select pg_temp.expect_error($q$select rush.save_member_standing_thresholds('fall',0,60,1,true)$q$,'55000');
do $$begin if (rush.member_standing('fall')->'thresholds'->>'minAttendancePct')::int<>75 then raise exception 'saved thresholds not read back';end if;
 -- Spring keeps its own defaults.
end$$;
reset role;
do $$begin
 if (select (metadata->>'minAttendancePct')::int from rush.audit_events where action='MEMBER_STANDING_THRESHOLDS_SET')<>75
  or (select count(*) from rush.audit_events)<>1 then raise exception 'audit wrong';end if;
 if (select min_attendance_pct from rush.member_standing_settings where cycle_id='spring') is not null then raise exception 'spring should be unset';end if;
end$$;
select 'member standing assertions passed' as result;
