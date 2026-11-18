\set ON_ERROR_STOP on
-- 1 member, 2 board, 3 owner in another cycle, 4 panel, 5 board with an inactive profile
insert into rush.profiles(id,display_name,active) values('00000000-0000-4000-8000-000000000001','Member',true),('00000000-0000-4000-8000-000000000002','Board',true),
 ('00000000-0000-4000-8000-000000000003','Owner',true),('00000000-0000-4000-8000-000000000004','Panel',true),('00000000-0000-4000-8000-000000000005','Gone',false);
insert into rush.memberships(cycle_id,user_id,role) values('test','00000000-0000-4000-8000-000000000001','MEMBER'),('test','00000000-0000-4000-8000-000000000002','BOARD'),
 ('other','00000000-0000-4000-8000-000000000003','OWNER'),('test','00000000-0000-4000-8000-000000000004','PANEL'),('test','00000000-0000-4000-8000-000000000005','BOARD');
create function pg_temp.expect_error(command text,expected text) returns void language plpgsql as $$begin execute command; raise exception 'Expected error %',expected; exception when others then if sqlstate<>expected then raise;end if;end$$;
create function pg_temp.form(extra jsonb default '{}') returns jsonb language sql as $$select '{"decidedOn":"2026-11-12","title":"Adopt the spring dues schedule","category":"FINANCE","outcome":"APPROVED","summary":"Dues stay at $40; hardship waivers by request to the treasurer.","votes":{"for":7,"against":1,"abstain":1},"minutesUrl":"https://docs.example.invalid/minutes-nov-12"}'::jsonb || extra$$;
grant execute on function pg_temp.form(jsonb) to authenticated;
set role authenticated;

-- Direct table access and helper functions are denied to every signed-in role.
select set_config('test.actor','00000000-0000-4000-8000-000000000002',false);
select pg_temp.expect_error($q$select * from rush.board_decisions$q$,'42501');
select pg_temp.expect_error($q$select rush.decision_log_is_board()$q$,'42501');

-- Members, panel-only members and inactive board profiles cannot read or write.
do $$declare who text; begin
 foreach who in array array['00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000005'] loop
  perform set_config('test.actor',who,false);
  perform pg_temp.expect_error($q$select rush.board_decision_log()$q$,'42501');
  perform pg_temp.expect_error($q$select rush.save_board_decision(null,0,pg_temp.form())$q$,'42501');
 end loop; end$$;

-- Board starts with an empty log and records a decision at revision 1.
select set_config('test.actor','00000000-0000-4000-8000-000000000002',false);
do $$begin if rush.board_decision_log()->'decisions'<>'[]'::jsonb then raise exception 'log not empty';end if;end$$;
create temp table ids(name text, id uuid);
grant all on ids to authenticated;
insert into ids select 'dues',(rush.save_board_decision(null,0,pg_temp.form())->>'id')::uuid;
-- A consensus decision has no vote; an older date sorts after the newer one.
insert into ids select 'room',(rush.save_board_decision(null,0,pg_temp.form('{"decidedOn":"2026-10-01","title":"Book the union room for rush","category":"RECRUITMENT","outcome":"NOTED","summary":"","votes":null,"minutesUrl":""}'))->>'id')::uuid;
do $$declare l jsonb := rush.board_decision_log()->'decisions'; begin
 if jsonb_array_length(l)<>2 or l->0->>'title'<>'Adopt the spring dues schedule' or (l->0->>'revision')::int<>1 or l->0->'votes'<>'{"for":7,"against":1,"abstain":1}'::jsonb
  or l->0->>'createdByName'<>'Board' or l->1->'votes'<>'null'::jsonb or l->1->>'decidedOn'<>'2026-10-01' then raise exception 'log wrong: %',l;end if;end$$;

-- Validation: create needs revision 0; unknown or missing key; bad date; untrimmed or empty title; bad category or outcome;
-- partial, fractional, negative or oversized votes; non-https minutes link; oversized summary.
select pg_temp.expect_error($q$select rush.save_board_decision(null,1,pg_temp.form())$q$,'22023');
select pg_temp.expect_error($q$select rush.save_board_decision(null,0,pg_temp.form('{"secret":"x"}'))$q$,'22023');
select pg_temp.expect_error($q$select rush.save_board_decision(null,0,pg_temp.form()-'summary')$q$,'22023');
select pg_temp.expect_error($q$select rush.save_board_decision(null,0,pg_temp.form('{"decidedOn":"2026-02-30"}'))$q$,'22023');
select pg_temp.expect_error($q$select rush.save_board_decision(null,0,pg_temp.form('{"decidedOn":"12/11/2026"}'))$q$,'22023');
select pg_temp.expect_error($q$select rush.save_board_decision(null,0,pg_temp.form('{"title":""}'))$q$,'22023');
select pg_temp.expect_error($q$select rush.save_board_decision(null,0,pg_temp.form('{"title":" padded "}'))$q$,'22023');
select pg_temp.expect_error($q$select rush.save_board_decision(null,0,pg_temp.form('{"category":"SOCIAL"}'))$q$,'22023');
select pg_temp.expect_error($q$select rush.save_board_decision(null,0,pg_temp.form('{"outcome":"PASSED"}'))$q$,'22023');
select pg_temp.expect_error($q$select rush.save_board_decision(null,0,pg_temp.form('{"votes":{"for":3,"against":1}}'))$q$,'22023');
select pg_temp.expect_error($q$select rush.save_board_decision(null,0,pg_temp.form('{"votes":{"for":2.5,"against":1,"abstain":0}}'))$q$,'22023');
select pg_temp.expect_error($q$select rush.save_board_decision(null,0,pg_temp.form('{"votes":{"for":-1,"against":1,"abstain":0}}'))$q$,'22023');
select pg_temp.expect_error($q$select rush.save_board_decision(null,0,pg_temp.form('{"votes":{"for":201,"against":1,"abstain":0}}'))$q$,'22023');
select pg_temp.expect_error($q$select rush.save_board_decision(null,0,pg_temp.form('{"votes":"7-1-1"}'))$q$,'22023');
select pg_temp.expect_error($q$select rush.save_board_decision(null,0,pg_temp.form('{"minutesUrl":"http://docs.example.invalid/m"}'))$q$,'22023');
select pg_temp.expect_error($q$select rush.save_board_decision(null,0,pg_temp.form('{"minutesUrl":"javascript:alert(1)"}'))$q$,'22023');
select pg_temp.expect_error($q$select rush.save_board_decision(null,0,pg_temp.form(jsonb_build_object('summary',repeat('x',2001))))$q$,'22023');
select pg_temp.expect_error($q$select rush.save_board_decision(null,0,'[]'::jsonb)$q$,'22023');

-- An owner from another cycle edits the entry; a stale revision is refused; an unknown id is 404.
select set_config('test.actor','00000000-0000-4000-8000-000000000003',false);
do $$declare r jsonb := rush.save_board_decision((select id from ids where name='dues'),1,pg_temp.form('{"outcome":"DEFERRED","votes":{"for":4,"against":4,"abstain":1}}'));
begin if (r->>'revision')::int<>2 or r->>'outcome'<>'DEFERRED' or r->>'updatedByName'<>'Owner' or r->>'createdByName'<>'Board' then raise exception 'edit wrong: %',r;end if;end$$;
select pg_temp.expect_error($q$select rush.save_board_decision((select id from ids where name='dues'),1,pg_temp.form())$q$,'55000');
select pg_temp.expect_error($q$select rush.save_board_decision('00000000-0000-4000-8000-0000000000ff',1,pg_temp.form())$q$,'P0002');
select pg_temp.expect_error($q$select rush.save_board_decision((select id from ids where name='dues'),0,pg_temp.form())$q$,'22023');
-- Saving the same form again is not a new revision.
do $$begin if (rush.save_board_decision((select id from ids where name='dues'),2,pg_temp.form('{"outcome":"DEFERRED","votes":{"for":4,"against":4,"abstain":1}}'))->>'revision')::int<>2 then raise exception 'no-op bumped revision';end if;end$$;
-- Clearing the vote and withdrawing are edits too.
select rush.save_board_decision((select id from ids where name='dues'),2,pg_temp.form('{"outcome":"WITHDRAWN","votes":null}'));

-- Audit metadata records structure, never the title, summary or minutes link.
reset role;
do $$begin
 if (select count(*) from rush.audit_events where resource='BoardDecision')<>4 then raise exception 'audit count wrong: %',(select count(*) from rush.audit_events);end if;
 if (select metadata->'changed' from rush.audit_events where action='BOARD_DECISION_UPDATED' order by (metadata->>'revision')::int desc limit 1)<>'["outcome", "votes"]'::jsonb then raise exception 'changed fields wrong';end if;
 if exists(select 1 from rush.audit_events where metadata::text ~* '(dues schedule|hardship|union room|minutes-nov|example\.invalid)') then raise exception 'audit leaked content';end if;
end$$;

-- Deactivated board loses access; anonymous callers cannot execute anything.
update rush.memberships set active=false where user_id='00000000-0000-4000-8000-000000000002';
set role authenticated;
select set_config('test.actor','00000000-0000-4000-8000-000000000002',false);
select pg_temp.expect_error($q$select rush.board_decision_log()$q$,'42501');
reset role;
set role anon;
select pg_temp.expect_error($q$select rush.board_decision_log()$q$,'42501');
select pg_temp.expect_error($q$select rush.save_board_decision(null,0,'{}'::jsonb)$q$,'42501');
reset role;
select 'decision log assertions passed' as result;
