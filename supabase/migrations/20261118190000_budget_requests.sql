-- Budget and reimbursement log: members ask the board to approve a purchase
-- or to reimburse money they spent; the board approves or denies, and marks a
-- request paid once someone has paid it outside this system.
--
-- This is an approval log only. Nothing here moves money, stores bank or card
-- details, or contacts anyone. Requests are an organisation record, not a
-- recruitment-cycle record, so the log is org-wide like rush.projects.
--
-- Access is only through the actor-checked functions below. RLS is forced
-- with no policies and there are no table grants.
--  * Any active member (any role except PANEL alone, with an active profile)
--    submits requests and reads, edits and withdraws only their own.
--  * An active BOARD or OWNER member reads every request and approves, denies
--    or marks paid, but never on a request they submitted themselves.
-- There is no delete. A mistaken request is withdrawn; a closed request stays.
-- Writes carry an optimistic revision. Audit metadata records the kind,
-- category, amount, status, revision and which fields changed, never the
-- title, notes, receipt link, decision note or payment note.
create table rush.budget_requests (
 id uuid primary key default gen_random_uuid(),
 requester_id uuid references rush.profiles(id) on delete set null,
 kind text not null check (kind in ('REIMBURSEMENT','PURCHASE')),
 title text not null check (char_length(title) between 1 and 200 and title=btrim(title)),
 category text not null check (category in ('EVENTS','RECRUITMENT','CLIENT_WORK','MARKETING','OPERATIONS','OTHER')),
 amount_cents integer not null check (amount_cents between 1 and 1000000),
 spent_on date,
 receipt_url text not null default '' check (receipt_url='' or (char_length(receipt_url) <= 500 and receipt_url ~ '^https://[^[:space:]]+$')),
 notes text not null default '' check (char_length(notes) <= 2000 and notes=btrim(notes)),
 status text not null default 'SUBMITTED' check (status in ('SUBMITTED','APPROVED','DENIED','PAID','WITHDRAWN')),
 decision_note text not null default '' check (char_length(decision_note) <= 1000 and decision_note=btrim(decision_note)),
 decided_at timestamptz,
 decided_by uuid references rush.profiles(id) on delete set null,
 paid_on date,
 payment_note text not null default '' check (char_length(payment_note) <= 200 and payment_note=btrim(payment_note)),
 paid_recorded_at timestamptz,
 paid_recorded_by uuid references rush.profiles(id) on delete set null,
 revision integer not null default 1 check (revision >= 1),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 updated_by uuid references rush.profiles(id) on delete set null,
 -- Money already spent has a date; a purchase asked for in advance may not.
 check (kind<>'REIMBURSEMENT' or spent_on is not null),
 -- A withdrawn request keeps its approval, if it had one.
 check (case status when 'SUBMITTED' then decided_at is null when 'WITHDRAWN' then true else decided_at is not null end),
 check ((status='PAID') = (paid_on is not null and paid_recorded_at is not null)),
 check (status<>'DENIED' or decision_note<>'')
);
create index budget_requests_requester on rush.budget_requests(requester_id, created_at desc);
create index budget_requests_created on rush.budget_requests(created_at desc);
alter table rush.budget_requests enable row level security;
alter table rush.budget_requests force row level security;
-- No policies and no table grants: access is exclusively through the RPCs.
revoke all on rush.budget_requests from public, anon, authenticated;

create function rush.budget_is_member() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from rush.memberships m join rush.profiles p on p.id=m.user_id
  where m.user_id=rush.actor_id() and m.active and p.active and m.role<>'PANEL');
$$;

create function rush.budget_is_board() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from rush.memberships m join rush.profiles p on p.id=m.user_id
  where m.user_id=rush.actor_id() and m.active and p.active and m.role in ('BOARD','OWNER'));
$$;

create function rush.budget_request_json(r rush.budget_requests) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'id',r.id,'kind',r.kind,'title',r.title,'category',r.category,'amountCents',r.amount_cents,
  'spentOn',r.spent_on::text,'receiptUrl',r.receipt_url,'notes',r.notes,'status',r.status,
  'isMine',r.requester_id is not distinct from rush.actor_id(),
  'requesterName',(select p.display_name from rush.profiles p where p.id=r.requester_id),
  'decisionNote',r.decision_note,'decidedAt',r.decided_at,
  'decidedByName',(select p.display_name from rush.profiles p where p.id=r.decided_by),
  'paidOn',r.paid_on::text,'paymentNote',r.payment_note,
  'paidRecordedByName',(select p.display_name from rush.profiles p where p.id=r.paid_recorded_by),
  'revision',r.revision,'createdAt',r.created_at,'updatedAt',r.updated_at);
$$;

create function rush.my_budget_requests() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not rush.budget_is_member() then raise exception 'Active membership required' using errcode='42501'; end if;
 return jsonb_build_object('requests',coalesce((
  select jsonb_agg(rush.budget_request_json(r) order by r.created_at desc, r.id)
  from rush.budget_requests r where r.requester_id=rush.actor_id()),'[]'::jsonb));
end; $$;

create function rush.budget_request_log() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not rush.budget_is_board() then raise exception 'Board access required' using errcode='42501'; end if;
 return jsonb_build_object('requests',coalesce((
  select jsonb_agg(rush.budget_request_json(r) order by r.created_at desc, r.id)
  from rush.budget_requests r),'[]'::jsonb));
end; $$;

-- Creates the caller's request when target_id is null (expected_revision must
-- be 0), or edits the caller's own request at expected_revision. A submitted
-- request can change in full; an approved one can only gain or change its
-- receipt link (a purchase approved in advance gets its receipt afterwards).
create function rush.save_budget_request(target_id uuid, expected_revision integer, payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 actor uuid := rush.actor_id();
 old rush.budget_requests%rowtype;
 r rush.budget_requests%rowtype;
 spent date;
 amount integer;
 changed text[] := '{}';
begin
 if not rush.budget_is_member() then raise exception 'Active membership required' using errcode='42501'; end if;
 if expected_revision is null or expected_revision<0 or (target_id is null and expected_revision<>0) or (target_id is not null and expected_revision<1) then
  raise exception 'Invalid revision' using errcode='22023'; end if;
 if jsonb_typeof(payload) is distinct from 'object'
  or exists(select 1 from jsonb_object_keys(payload) k where k not in ('kind','title','category','amountCents','spentOn','receiptUrl','notes'))
  or (select count(*) from jsonb_object_keys(payload))<>7 then
  raise exception 'Invalid request form' using errcode='22023'; end if;
 -- CASE keeps the cast behind the shape check; OR does not fix evaluation order.
 -- The parentheses stop PL/pgSQL taking the CASE's THEN as the IF's.
 if (case when jsonb_typeof(payload->'amountCents')='number' and (payload->'amountCents')::text ~ '^[0-9]{1,7}$'
  then (payload->'amountCents')::text::integer not between 1 and 1000000 else true end) then
  raise exception 'Give an amount from $0.01 to $10,000.00' using errcode='22023'; end if;
 amount := (payload->'amountCents')::text::integer;
 if jsonb_typeof(payload->'spentOn')='string' then
  if payload->>'spentOn' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'Check the date' using errcode='22023'; end if;
  begin spent := (payload->>'spentOn')::date;
  exception when others then raise exception 'Check the date' using errcode='22023'; end;
 elsif jsonb_typeof(payload->'spentOn') is distinct from 'null' then
  raise exception 'Check the date' using errcode='22023';
 end if;
 if coalesce(payload->>'kind','') not in ('REIMBURSEMENT','PURCHASE')
  or jsonb_typeof(payload->'title') is distinct from 'string' or char_length(payload->>'title') not between 1 and 200 or payload->>'title'<>btrim(payload->>'title')
  or coalesce(payload->>'category','') not in ('EVENTS','RECRUITMENT','CLIENT_WORK','MARKETING','OPERATIONS','OTHER')
  or jsonb_typeof(payload->'notes') is distinct from 'string' or char_length(payload->>'notes')>2000 or payload->>'notes'<>btrim(payload->>'notes')
  or jsonb_typeof(payload->'receiptUrl') is distinct from 'string'
  or (payload->>'receiptUrl'<>'' and (char_length(payload->>'receiptUrl')>500 or payload->>'receiptUrl' !~ '^https://[^[:space:]]+$')) then
  raise exception 'Check the request fields' using errcode='22023'; end if;
 if payload->>'kind'='REIMBURSEMENT' and spent is null then
  raise exception 'Give the date you spent the money' using errcode='22023'; end if;

 if target_id is null then
  insert into rush.budget_requests(requester_id,kind,title,category,amount_cents,spent_on,receipt_url,notes,updated_by)
  values(actor,payload->>'kind',payload->>'title',payload->>'category',amount,spent,payload->>'receiptUrl',payload->>'notes',actor)
  returning * into r;
  insert into rush.audit_events(actor_id,action,resource,resource_id,metadata)
  values(actor,'BUDGET_REQUEST_SUBMITTED','BudgetRequest',r.id::text,jsonb_build_object('kind',r.kind,'category',r.category,
   'amountCents',r.amount_cents,'status',r.status,'hasReceipt',r.receipt_url<>'','revision',r.revision));
  return rush.budget_request_json(r);
 end if;

 select * into old from rush.budget_requests where id=target_id for update;
 -- Someone else's request is reported as missing so ids cannot be probed.
 if not found or old.requester_id is distinct from actor then raise exception 'Request not found' using errcode='P0002'; end if;
 if old.revision<>expected_revision then raise exception 'This request changed since you opened it. Reload before saving.' using errcode='55000'; end if;
 if old.kind<>payload->>'kind' then changed := array_append(changed,'kind'); end if;
 if old.title<>payload->>'title' then changed := array_append(changed,'title'); end if;
 if old.category<>payload->>'category' then changed := array_append(changed,'category'); end if;
 if old.amount_cents<>amount then changed := array_append(changed,'amountCents'); end if;
 if old.spent_on is distinct from spent then changed := array_append(changed,'spentOn'); end if;
 if old.receipt_url<>payload->>'receiptUrl' then changed := array_append(changed,'receiptUrl'); end if;
 if old.notes<>payload->>'notes' then changed := array_append(changed,'notes'); end if;
 -- Saving an unchanged form is not a new revision and leaves no audit entry.
 if cardinality(changed)=0 then return rush.budget_request_json(old); end if;
 if old.status='APPROVED' and changed<>array['receiptUrl'] then
  raise exception 'This request is approved. Only its receipt link can change.' using errcode='55000'; end if;
 if old.status not in ('SUBMITTED','APPROVED') then
  raise exception 'This request is closed and can no longer change.' using errcode='55000'; end if;
 update rush.budget_requests set kind=payload->>'kind', title=payload->>'title', category=payload->>'category', amount_cents=amount,
  spent_on=spent, receipt_url=payload->>'receiptUrl', notes=payload->>'notes', revision=revision+1, updated_at=now(), updated_by=actor
  where id=target_id returning * into r;
 insert into rush.audit_events(actor_id,action,resource,resource_id,metadata)
 values(actor,'BUDGET_REQUEST_UPDATED','BudgetRequest',r.id::text,jsonb_build_object('kind',r.kind,'category',r.category,
  'amountCents',r.amount_cents,'status',r.status,'hasReceipt',r.receipt_url<>'','revision',r.revision,'changed',to_jsonb(changed)));
 return rush.budget_request_json(r);
end; $$;

-- Moves a request on. WITHDRAW is the requester's (submitted or approved and
-- unpaid). APPROVE and DENY (submitted) and MARK_PAID (approved) are the
-- board's, and never on the board member's own request.
create function rush.act_on_budget_request(target_id uuid, expected_revision integer, action text, payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 actor uuid := rush.actor_id();
 old rush.budget_requests%rowtype;
 r rush.budget_requests%rowtype;
 note text;
 paid date;
 keys text[];
begin
 if action is null or action not in ('WITHDRAW','APPROVE','DENY','MARK_PAID') then raise exception 'Unknown action' using errcode='22023'; end if;
 if action='WITHDRAW' then
  if not rush.budget_is_member() then raise exception 'Active membership required' using errcode='42501'; end if;
 elsif not rush.budget_is_board() then raise exception 'Board access required' using errcode='42501';
 end if;
 if target_id is null or expected_revision is null or expected_revision<1 then raise exception 'Invalid revision' using errcode='22023'; end if;
 keys := case action when 'WITHDRAW' then '{}'::text[] when 'MARK_PAID' then array['paidOn','paymentNote'] else array['note'] end;
 if jsonb_typeof(payload) is distinct from 'object'
  or exists(select 1 from jsonb_object_keys(payload) k where k<>all(keys))
  or (select count(*) from jsonb_object_keys(payload))<>cardinality(keys) then
  raise exception 'Invalid form' using errcode='22023'; end if;
 if action in ('APPROVE','DENY') then
  if jsonb_typeof(payload->'note') is distinct from 'string' or char_length(payload->>'note')>1000 or payload->>'note'<>btrim(payload->>'note') then
   raise exception 'Shorten the note to 1,000 characters' using errcode='22023'; end if;
  note := payload->>'note';
  if action='DENY' and note='' then raise exception 'Say why the request is denied' using errcode='22023'; end if;
 elsif action='MARK_PAID' then
  if jsonb_typeof(payload->'paidOn') is distinct from 'string' or payload->>'paidOn' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
   raise exception 'Give the date it was paid' using errcode='22023'; end if;
  begin paid := (payload->>'paidOn')::date;
  exception when others then raise exception 'Give the date it was paid' using errcode='22023'; end;
  if jsonb_typeof(payload->'paymentNote') is distinct from 'string' or char_length(payload->>'paymentNote')>200 or payload->>'paymentNote'<>btrim(payload->>'paymentNote') then
   raise exception 'Shorten the payment note to 200 characters' using errcode='22023'; end if;
 end if;

 select * into old from rush.budget_requests where id=target_id for update;
 if not found or (action='WITHDRAW' and old.requester_id is distinct from actor) then raise exception 'Request not found' using errcode='P0002'; end if;
 if action<>'WITHDRAW' and old.requester_id is not distinct from actor then
  raise exception 'Another board member has to act on your own request' using errcode='42501'; end if;
 if old.revision<>expected_revision then raise exception 'This request changed since you opened it. Reload before saving.' using errcode='55000'; end if;
 if (action='WITHDRAW' and old.status not in ('SUBMITTED','APPROVED'))
  or (action in ('APPROVE','DENY') and old.status<>'SUBMITTED')
  or (action='MARK_PAID' and old.status<>'APPROVED') then
  raise exception 'This request is % and cannot take that step.', lower(old.status) using errcode='55000'; end if;

 if action='WITHDRAW' then
  update rush.budget_requests set status='WITHDRAWN', revision=revision+1, updated_at=now(), updated_by=actor
   where id=target_id returning * into r;
 elsif action in ('APPROVE','DENY') then
  update rush.budget_requests set status=case action when 'APPROVE' then 'APPROVED' else 'DENIED' end, decision_note=note, decided_at=now(), decided_by=actor,
   revision=revision+1, updated_at=now(), updated_by=actor
   where id=target_id returning * into r;
 else
  update rush.budget_requests set status='PAID', paid_on=paid, payment_note=payload->>'paymentNote', paid_recorded_at=now(), paid_recorded_by=actor,
   revision=revision+1, updated_at=now(), updated_by=actor
   where id=target_id returning * into r;
 end if;
 insert into rush.audit_events(actor_id,action,resource,resource_id,metadata)
 values(actor,case action when 'WITHDRAW' then 'BUDGET_REQUEST_WITHDRAWN' when 'APPROVE' then 'BUDGET_REQUEST_APPROVED' when 'DENY' then 'BUDGET_REQUEST_DENIED' else 'BUDGET_REQUEST_PAID' end,
  'BudgetRequest',r.id::text,jsonb_build_object('kind',r.kind,'category',r.category,'amountCents',r.amount_cents,'fromStatus',old.status,'status',r.status,
   'paidOn',r.paid_on,'revision',r.revision));
 return rush.budget_request_json(r);
end; $$;

revoke all on function rush.budget_is_member(), rush.budget_is_board(), rush.budget_request_json(rush.budget_requests),
 rush.my_budget_requests(), rush.budget_request_log(), rush.save_budget_request(uuid,integer,jsonb),
 rush.act_on_budget_request(uuid,integer,text,jsonb) from public, anon, authenticated;
grant execute on function rush.my_budget_requests(), rush.budget_request_log(), rush.save_budget_request(uuid,integer,jsonb),
 rush.act_on_budget_request(uuid,integer,text,jsonb) to authenticated;
