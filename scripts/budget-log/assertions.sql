\set ON_ERROR_STOP on
-- 1 member, 2 board, 3 owner in another cycle, 4 panel only, 5 board with an inactive profile, 6 recruitment committee, 7 another member
insert into rush.profiles(id,display_name,active) values('00000000-0000-4000-8000-000000000001','Member',true),('00000000-0000-4000-8000-000000000002','Board',true),
 ('00000000-0000-4000-8000-000000000003','Owner',true),('00000000-0000-4000-8000-000000000004','Panel',true),('00000000-0000-4000-8000-000000000005','Gone',false),
 ('00000000-0000-4000-8000-000000000006','Committee',true),('00000000-0000-4000-8000-000000000007','Other',true);
insert into rush.memberships(cycle_id,user_id,role) values('test','00000000-0000-4000-8000-000000000001','MEMBER'),('test','00000000-0000-4000-8000-000000000002','BOARD'),
 ('other','00000000-0000-4000-8000-000000000003','OWNER'),('test','00000000-0000-4000-8000-000000000004','PANEL'),('test','00000000-0000-4000-8000-000000000005','BOARD'),
 ('test','00000000-0000-4000-8000-000000000006','RECRUITMENT_COMMITTEE'),('test','00000000-0000-4000-8000-000000000007','MEMBER');
create function pg_temp.expect_error(command text,expected text) returns void language plpgsql as $$begin execute command; raise exception 'Expected error % from %',expected,command; exception when others then if sqlstate<>expected then raise;end if;end$$;
create function pg_temp.form(extra jsonb default '{}') returns jsonb language sql as $$select '{"kind":"REIMBURSEMENT","title":"Pizza for the case workshop","category":"EVENTS","amountCents":8450,"spentOn":"2026-11-10","receiptUrl":"https://drive.example.invalid/receipt-pizza","notes":"Paid on my own card at Pizza House."}'::jsonb || extra$$;
create function pg_temp.as_actor(n int) returns void language sql as $$select set_config('test.actor',format('00000000-0000-4000-8000-%s',lpad(n::text,12,'0')),false)$$;
grant execute on function pg_temp.form(jsonb), pg_temp.as_actor(int) to authenticated;
create temp table ids(name text, id uuid);
grant all on ids to authenticated;
set role authenticated;

-- Direct table access and helper functions are denied to every signed-in role.
select pg_temp.as_actor(2);
select pg_temp.expect_error($q$select * from rush.budget_requests$q$,'42501');
select pg_temp.expect_error($q$select rush.budget_is_board()$q$,'42501');
select pg_temp.expect_error($q$select rush.budget_is_member()$q$,'42501');

-- Panel-only members and inactive profiles cannot use the log at all.
do $$declare who int; begin
 foreach who in array array[4,5] loop
  perform pg_temp.as_actor(who);
  perform pg_temp.expect_error($q$select rush.my_budget_requests()$q$,'42501');
  perform pg_temp.expect_error($q$select rush.save_budget_request(null,0,pg_temp.form())$q$,'42501');
  perform pg_temp.expect_error($q$select rush.budget_request_log()$q$,'42501');
 end loop; end$$;
-- Members and the recruitment committee cannot read the board log or decide.
do $$declare who int; begin
 foreach who in array array[1,6] loop
  perform pg_temp.as_actor(who);
  perform pg_temp.expect_error($q$select rush.budget_request_log()$q$,'42501');
 end loop; end$$;

-- A member submits a reimbursement and a purchase asked for in advance (no date, no receipt yet).
select pg_temp.as_actor(1);
do $$begin if rush.my_budget_requests()->'requests'<>'[]'::jsonb then raise exception 'not empty';end if;end$$;
insert into ids select 'pizza',(rush.save_budget_request(null,0,pg_temp.form())->>'id')::uuid;
insert into ids select 'banner',(rush.save_budget_request(null,0,pg_temp.form('{"kind":"PURCHASE","title":"Banner for the fall mass meeting","category":"MARKETING","amountCents":12000,"spentOn":null,"receiptUrl":"","notes":""}'))->>'id')::uuid;
-- The committee member and another member can submit too.
select pg_temp.as_actor(6);
insert into ids select 'committee',(rush.save_budget_request(null,0,pg_temp.form('{"title":"Coffee for interviewers","amountCents":2500}'))->>'id')::uuid;
-- A board member's own request.
select pg_temp.as_actor(2);
insert into ids select 'board-own',(rush.save_budget_request(null,0,pg_temp.form('{"title":"Printer paper","category":"OPERATIONS","amountCents":1999}'))->>'id')::uuid;

-- Each member sees only their own requests.
select pg_temp.as_actor(1);
do $$declare l jsonb := rush.my_budget_requests()->'requests'; begin
 if jsonb_array_length(l)<>2 or l->0->>'title'<>'Banner for the fall mass meeting' or l->1->>'amountCents'<>'8450' or l->1->>'status'<>'SUBMITTED'
  or (l->1->>'isMine')::boolean is not true or l->1->>'requesterName'<>'Member' or l->0->'spentOn'<>'null'::jsonb or (l->0->>'revision')::int<>1 then raise exception 'own list wrong: %',l;end if;end$$;
select pg_temp.as_actor(7);
do $$begin if rush.my_budget_requests()->'requests'<>'[]'::jsonb then raise exception 'other member sees requests';end if;end$$;
-- Another member cannot edit or withdraw it, and learns nothing about it (404, not 403).
select pg_temp.expect_error($q$select rush.save_budget_request((select id from ids where name='pizza'),1,pg_temp.form())$q$,'P0002');
select pg_temp.expect_error($q$select rush.act_on_budget_request((select id from ids where name='pizza'),1,'WITHDRAW','{}')$q$,'P0002');
-- A member cannot approve, deny or mark paid.
select pg_temp.as_actor(1);
select pg_temp.expect_error($q$select rush.act_on_budget_request((select id from ids where name='pizza'),1,'APPROVE','{"note":""}')$q$,'42501');
select pg_temp.expect_error($q$select rush.act_on_budget_request((select id from ids where name='pizza'),1,'MARK_PAID','{"paidOn":"2026-11-12","paymentNote":""}')$q$,'42501');

-- Validation.
select pg_temp.expect_error($q$select rush.save_budget_request(null,1,pg_temp.form())$q$,'22023');
select pg_temp.expect_error($q$select rush.save_budget_request(null,0,pg_temp.form('{"secret":"x"}'))$q$,'22023');
select pg_temp.expect_error($q$select rush.save_budget_request(null,0,pg_temp.form()-'notes')$q$,'22023');
select pg_temp.expect_error($q$select rush.save_budget_request(null,0,pg_temp.form('{"kind":"GIFT"}'))$q$,'22023');
select pg_temp.expect_error($q$select rush.save_budget_request(null,0,pg_temp.form('{"category":"PARTY"}'))$q$,'22023');
select pg_temp.expect_error($q$select rush.save_budget_request(null,0,pg_temp.form('{"title":""}'))$q$,'22023');
select pg_temp.expect_error($q$select rush.save_budget_request(null,0,pg_temp.form('{"title":" padded "}'))$q$,'22023');
select pg_temp.expect_error($q$select rush.save_budget_request(null,0,pg_temp.form('{"title":"tab padded\t"}'))$q$,'22023');
select pg_temp.expect_error($q$select rush.save_budget_request(null,0,pg_temp.form('{"notes":"\nnewline first"}'))$q$,'22023');
select pg_temp.expect_error($q$select rush.save_budget_request(null,0,pg_temp.form('{"amountCents":0}'))$q$,'22023');
select pg_temp.expect_error($q$select rush.save_budget_request(null,0,pg_temp.form('{"amountCents":-5}'))$q$,'22023');
select pg_temp.expect_error($q$select rush.save_budget_request(null,0,pg_temp.form('{"amountCents":84.5}'))$q$,'22023');
select pg_temp.expect_error($q$select rush.save_budget_request(null,0,pg_temp.form('{"amountCents":1000001}'))$q$,'22023');
select pg_temp.expect_error($q$select rush.save_budget_request(null,0,pg_temp.form('{"amountCents":"8450"}'))$q$,'22023');
select pg_temp.expect_error($q$select rush.save_budget_request(null,0,pg_temp.form('{"amountCents":99999999999}'))$q$,'22023');
select pg_temp.expect_error($q$select rush.save_budget_request(null,0,pg_temp.form('{"spentOn":null}'))$q$,'22023');
select pg_temp.expect_error($q$select rush.save_budget_request(null,0,pg_temp.form('{"spentOn":"2026-02-30"}'))$q$,'22023');
select pg_temp.expect_error($q$select rush.save_budget_request(null,0,pg_temp.form('{"spentOn":"11/10/2026"}'))$q$,'22023');
select pg_temp.expect_error($q$select rush.save_budget_request(null,0,pg_temp.form('{"spentOn":20261110}'))$q$,'22023');
select pg_temp.expect_error($q$select rush.save_budget_request(null,0,pg_temp.form('{"receiptUrl":"http://drive.example.invalid/r"}'))$q$,'22023');
select pg_temp.expect_error($q$select rush.save_budget_request(null,0,pg_temp.form('{"receiptUrl":"javascript:alert(1)"}'))$q$,'22023');
select pg_temp.expect_error($q$select rush.save_budget_request(null,0,pg_temp.form(jsonb_build_object('notes',repeat('x',2001))))$q$,'22023');
select pg_temp.expect_error($q$select rush.save_budget_request(null,0,'[]'::jsonb)$q$,'22023');
select pg_temp.expect_error($q$select rush.act_on_budget_request((select id from ids where name='pizza'),1,'DELETE','{}')$q$,'22023');
select pg_temp.expect_error($q$select rush.act_on_budget_request((select id from ids where name='pizza'),1,'WITHDRAW','{"note":""}')$q$,'22023');

-- The requester edits a submitted request; a stale revision is refused; an unchanged save is not a revision.
do $$declare r jsonb := rush.save_budget_request((select id from ids where name='pizza'),1,pg_temp.form('{"amountCents":8950,"notes":"Paid on my own card at Pizza House, with tip."}'));
begin if (r->>'revision')::int<>2 or (r->>'amountCents')::int<>8950 then raise exception 'edit wrong: %',r;end if;end$$;
select pg_temp.expect_error($q$select rush.save_budget_request((select id from ids where name='pizza'),1,pg_temp.form())$q$,'55000');
do $$begin if (rush.save_budget_request((select id from ids where name='pizza'),2,pg_temp.form('{"amountCents":8950,"notes":"Paid on my own card at Pizza House, with tip."}'))->>'revision')::int<>2 then raise exception 'no-op bumped revision';end if;end$$;

-- Board: sees every request; cannot act on its own; deny needs a reason; stale revisions refused.
select pg_temp.as_actor(2);
do $$declare l jsonb := rush.budget_request_log()->'requests'; begin
 if jsonb_array_length(l)<>4 or (select count(*) from jsonb_array_elements(l) e where (e->>'isMine')::boolean)<>1 then raise exception 'board log wrong: %',l;end if;end$$;
select pg_temp.expect_error($q$select rush.act_on_budget_request((select id from ids where name='board-own'),1,'APPROVE','{"note":""}')$q$,'42501');
select pg_temp.expect_error($q$select rush.act_on_budget_request((select id from ids where name='committee'),1,'DENY','{"note":""}')$q$,'22023');
select pg_temp.expect_error($q$select rush.act_on_budget_request((select id from ids where name='committee'),1,'APPROVE','{}')$q$,'22023');
select pg_temp.expect_error($q$select rush.act_on_budget_request((select id from ids where name='pizza'),1,'APPROVE','{"note":""}')$q$,'55000');
select pg_temp.expect_error($q$select rush.act_on_budget_request((select id from ids where name='pizza'),2,'MARK_PAID','{"paidOn":"2026-11-12","paymentNote":""}')$q$,'55000');
select pg_temp.expect_error($q$select rush.act_on_budget_request('00000000-0000-4000-8000-0000000000ff',1,'APPROVE','{"note":""}')$q$,'P0002');
do $$declare r jsonb := rush.act_on_budget_request((select id from ids where name='pizza'),2,'APPROVE','{"note":"Within the events budget."}');
begin if r->>'status'<>'APPROVED' or r->>'decidedByName'<>'Board' or r->>'decisionNote'<>'Within the events budget.' or (r->>'revision')::int<>3 or (r->>'isMine')::boolean then raise exception 'approve wrong: %',r;end if;end$$;
select rush.act_on_budget_request((select id from ids where name='committee'),1,'DENY','{"note":"Interview coffee comes from the recruitment budget line; resubmit there."}');
select rush.act_on_budget_request((select id from ids where name='banner'),1,'APPROVE','{"note":""}');
-- An approved request cannot be decided again; a denied one cannot be paid.
select pg_temp.expect_error($q$select rush.act_on_budget_request((select id from ids where name='pizza'),3,'DENY','{"note":"No"}')$q$,'55000');
select pg_temp.expect_error($q$select rush.act_on_budget_request((select id from ids where name='committee'),2,'MARK_PAID','{"paidOn":"2026-11-12","paymentNote":""}')$q$,'55000');
select pg_temp.expect_error($q$select rush.act_on_budget_request((select id from ids where name='pizza'),3,'MARK_PAID','{"paidOn":"2026-13-01","paymentNote":""}')$q$,'22023');

-- The requester can only change the receipt link on an approved request, and nothing on a denied one.
select pg_temp.as_actor(1);
select pg_temp.expect_error($q$select rush.save_budget_request((select id from ids where name='pizza'),3,pg_temp.form('{"amountCents":20000,"notes":"Paid on my own card at Pizza House, with tip."}'))$q$,'55000');
select rush.save_budget_request((select id from ids where name='banner'),2,pg_temp.form('{"kind":"PURCHASE","title":"Banner for the fall mass meeting","category":"MARKETING","amountCents":12000,"spentOn":null,"receiptUrl":"https://drive.example.invalid/receipt-banner","notes":""}'));
select pg_temp.as_actor(6);
select pg_temp.expect_error($q$select rush.save_budget_request((select id from ids where name='committee'),2,pg_temp.form('{"title":"Coffee for interviewers","amountCents":2000}'))$q$,'55000');
select pg_temp.expect_error($q$select rush.act_on_budget_request((select id from ids where name='committee'),2,'WITHDRAW','{}')$q$,'55000');
-- The requester sees why it was denied.
do $$begin if rush.my_budget_requests()->'requests'->0->>'decisionNote' !~ 'recruitment budget line' then raise exception 'denial reason hidden';end if;end$$;

-- An owner from another cycle marks the reimbursement paid; it can then neither be withdrawn nor paid again.
select pg_temp.as_actor(3);
do $$declare r jsonb := rush.act_on_budget_request((select id from ids where name='pizza'),3,'MARK_PAID','{"paidOn":"2026-11-14","paymentNote":"Club Venmo, ref 4471"}');
begin if r->>'status'<>'PAID' or r->>'paidOn'<>'2026-11-14' or r->>'paidRecordedByName'<>'Owner' or r->>'decidedByName'<>'Board' then raise exception 'paid wrong: %',r;end if;end$$;
-- The owner approves the board member's own request.
select rush.act_on_budget_request((select id from ids where name='board-own'),1,'APPROVE','{"note":""}');
select pg_temp.as_actor(1);
select pg_temp.expect_error($q$select rush.act_on_budget_request((select id from ids where name='pizza'),4,'WITHDRAW','{}')$q$,'55000');
select pg_temp.expect_error($q$select rush.save_budget_request((select id from ids where name='pizza'),4,pg_temp.form('{"amountCents":8950,"notes":"Paid on my own card at Pizza House, with tip.","receiptUrl":""}'))$q$,'55000');
-- An approved purchase that will not happen is withdrawn and keeps its approval.
do $$declare r jsonb := rush.act_on_budget_request((select id from ids where name='banner'),3,'WITHDRAW','{}');
begin if r->>'status'<>'WITHDRAWN' or r->>'decidedByName'<>'Board' then raise exception 'withdraw wrong: %',r;end if;end$$;
select pg_temp.as_actor(2);
select pg_temp.expect_error($q$select rush.act_on_budget_request((select id from ids where name='banner'),4,'MARK_PAID','{"paidOn":"2026-11-12","paymentNote":""}')$q$,'55000');
-- The board cannot mark its own approved request paid either.
select pg_temp.expect_error($q$select rush.act_on_budget_request((select id from ids where name='board-own'),2,'MARK_PAID','{"paidOn":"2026-11-12","paymentNote":""}')$q$,'42501');

-- Audit metadata records structure, never the title, notes, receipt link, decision note or payment note.
reset role;
do $$begin
 if (select count(*) from rush.audit_events where resource='BudgetRequest')<>12 then raise exception 'audit count wrong: %',(select string_agg(action,',') from rush.audit_events);end if;
 if (select metadata->'changed' from rush.audit_events where action='BUDGET_REQUEST_UPDATED' and metadata->>'amountCents'='8950')<>'["amountCents", "notes"]'::jsonb then raise exception 'changed fields wrong';end if;
 if (select count(*) from rush.audit_events where action in ('BUDGET_REQUEST_APPROVED','BUDGET_REQUEST_DENIED','BUDGET_REQUEST_PAID','BUDGET_REQUEST_WITHDRAWN'))<>6 then raise exception 'action audit missing';end if;
 if exists(select 1 from rush.audit_events where metadata::text ~* '(pizza|banner|coffee|printer|receipt-|example\.invalid|venmo|4471|events budget|budget line|tip)') then raise exception 'audit leaked content';end if;
end$$;

-- Deactivated board loses access; anonymous callers cannot execute anything.
update rush.memberships set active=false where user_id='00000000-0000-4000-8000-000000000002';
set role authenticated;
select pg_temp.as_actor(2);
select pg_temp.expect_error($q$select rush.budget_request_log()$q$,'42501');
select pg_temp.expect_error($q$select rush.my_budget_requests()$q$,'42501');
reset role;
set role anon;
select pg_temp.expect_error($q$select rush.my_budget_requests()$q$,'42501');
select pg_temp.expect_error($q$select rush.budget_request_log()$q$,'42501');
select pg_temp.expect_error($q$select rush.save_budget_request(null,0,'{}'::jsonb)$q$,'42501');
select pg_temp.expect_error($q$select rush.act_on_budget_request(null,1,'APPROVE','{}'::jsonb)$q$,'42501');
reset role;
select 'budget log assertions passed' as result;
