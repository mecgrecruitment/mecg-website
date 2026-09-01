-- Durable, idempotent decision notifications. The release and the outbox insert
-- happen in the same transaction; provider delivery is deliberately separate.
create table rush.notification_outbox (
  id text primary key default gen_random_uuid()::text,
  cycle_id text not null references rush.rush_cycles (id) on delete restrict,
  application_id text not null references rush.applications (id) on delete restrict,
  decision_id text not null references rush.decisions (id) on delete restrict,
  recipient text not null check (char_length(trim(recipient)) between 3 and 254),
  template_key text not null check (template_key = 'DECISION_RELEASED'),
  template_version integer not null default 1 check (template_version > 0),
  status text not null default 'PENDING' check (status in ('PENDING','PROCESSING','SENT','FAILED')),
  attempt_count integer not null default 0 check (attempt_count between 0 and 8),
  max_attempts integer not null default 5 check (max_attempts between 1 and 8),
  last_error_category text check (last_error_category is null or char_length(last_error_category) <= 60),
  next_attempt_at timestamptz not null default now(),
  last_attempt_at timestamptz,
  provider_message_id text check (provider_message_id is null or char_length(provider_message_id) <= 200),
  idempotency_key text not null unique check (char_length(idempotency_key) between 8 and 200),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (decision_id, template_key, template_version)
);

create index notification_outbox_due_idx
  on rush.notification_outbox (next_attempt_at, created_at)
  where status in ('PENDING','PROCESSING');
create index notification_outbox_cycle_status_idx
  on rush.notification_outbox (cycle_id, status, created_at desc);

alter table rush.notification_outbox enable row level security;
alter table rush.notification_outbox force row level security;

create policy notification_outbox_read_board on rush.notification_outbox
for select to authenticated
using (rush.has_cycle_role(cycle_id, array['BOARD','OWNER']::rush.member_role[]));

grant select on rush.notification_outbox to authenticated, service_role;
grant insert, update on rush.notification_outbox to service_role;

-- Claims one delivery attempt under a short lease. A crashed worker can be
-- reclaimed after the lease; Resend's stable idempotency key prevents a second
-- provider delivery when the first request succeeded but its response was lost.
create function rush.claim_notification(target_notification_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  item rush.notification_outbox%rowtype;
  result jsonb;
begin
  if current_setting('request.jwt.claim.role', true) is distinct from 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  select * into item from rush.notification_outbox where id = target_notification_id for update;
  if item.id is null then raise exception 'notification missing' using errcode = 'P0002'; end if;
  if item.status = 'SENT' then return null; end if;
  if item.status = 'FAILED' or item.attempt_count >= item.max_attempts then
    raise exception 'notification attempts exhausted' using errcode = '55000';
  end if;
  if item.next_attempt_at > now() then return null; end if;

  update rush.notification_outbox
  set status = 'PROCESSING',
      attempt_count = attempt_count + 1,
      last_attempt_at = now(),
      next_attempt_at = now() + interval '10 minutes'
  where id = item.id
  returning * into item;

  select jsonb_build_object(
    'id', item.id,
    'recipient', item.recipient,
    'templateKey', item.template_key,
    'templateVersion', item.template_version,
    'attemptCount', item.attempt_count,
    'idempotencyKey', item.idempotency_key,
    'decisionOutcome', d.outcome::text,
    'applicantName', p.name
  ) into result
  from rush.decisions d
  join rush.applications a on a.id = d.application_id
  join rush.pnms p on p.id = a.pnm_id
  where d.id = item.decision_id and a.id = item.application_id;

  if result is null then raise exception 'notification source missing' using errcode = 'P0002'; end if;
  return result;
end;
$$;

create function rush.complete_notification(
  target_notification_id text,
  was_delivered boolean,
  provider_id text default null,
  error_category text default null,
  should_retry boolean default false
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  item rush.notification_outbox%rowtype;
  next_status text;
  delay_minutes integer;
begin
  if current_setting('request.jwt.claim.role', true) is distinct from 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  select * into item from rush.notification_outbox where id = target_notification_id for update;
  if item.id is null then raise exception 'notification missing' using errcode = 'P0002'; end if;
  if item.status = 'SENT' then return item.status; end if;
  if item.status <> 'PROCESSING' then raise exception 'notification is not claimed' using errcode = '55000'; end if;

  if coalesce(was_delivered, false) then
    update rush.notification_outbox
    set status = 'SENT', sent_at = now(), next_attempt_at = now(),
        provider_message_id = nullif(left(trim(provider_id), 200), ''), last_error_category = null
    where id = item.id;
    next_status := 'SENT';
  elsif coalesce(should_retry, false) and item.attempt_count < item.max_attempts then
    delay_minutes := least(360, 5 * (2 ^ greatest(0, item.attempt_count - 1))::integer);
    update rush.notification_outbox
    set status = 'PENDING', next_attempt_at = now() + make_interval(mins => delay_minutes),
        last_error_category = coalesce(nullif(left(trim(error_category), 60), ''), 'UNKNOWN')
    where id = item.id;
    next_status := 'PENDING';
  else
    update rush.notification_outbox
    set status = 'FAILED', next_attempt_at = now(),
        last_error_category = coalesce(nullif(left(trim(error_category), 60), ''), 'UNKNOWN')
    where id = item.id;
    next_status := 'FAILED';
  end if;
  return next_status;
end;
$$;

-- Manual retries are Board/Owner-only, audited, and capped at eight total
-- attempts so repeated clicks cannot create an unbounded send loop.
create function rush.retry_notification(target_notification_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare item rush.notification_outbox%rowtype;
begin
  select * into item from rush.notification_outbox where id = target_notification_id for update;
  if item.id is null then raise exception 'notification missing' using errcode = 'P0002'; end if;
  if auth.uid() is null or not rush.has_cycle_role(item.cycle_id, array['BOARD','OWNER']::rush.member_role[]) then
    raise exception 'board role required' using errcode = '42501';
  end if;
  if item.status = 'SENT' then raise exception 'notification already sent' using errcode = '55000'; end if;
  if item.attempt_count >= 8 then raise exception 'notification attempts exhausted' using errcode = '55000'; end if;

  update rush.notification_outbox
  set status = 'PENDING', next_attempt_at = now(),
      max_attempts = greatest(max_attempts, attempt_count + 1)
  where id = item.id;
  insert into rush.audit_events (actor_id, cycle_id, action, resource, resource_id, metadata)
  values (auth.uid(), item.cycle_id, 'NOTIFICATION_RETRY_REQUESTED', 'Notification', item.id,
          jsonb_build_object('attemptCount', item.attempt_count));
end;
$$;

-- Replace the current release function so business state and its delivery
-- obligation commit together.
create or replace function rush.release_decision(target_decision_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  d rush.decisions%rowtype;
  valid_approvals bigint;
begin
  select * into d from rush.decisions where id=target_decision_id for update;
  if d.id is null then raise exception 'decision missing' using errcode='P0002'; end if;
  if not rush.has_cycle_role(d.cycle_id,array['PANEL','OWNER']::rush.member_role[]) then raise exception 'panel role required' using errcode='42501'; end if;
  if exists(select 1 from rush.conflict_declarations where application_id=d.application_id and declarer_id=auth.uid()) then raise exception 'conflict declared' using errcode='42501'; end if;
  select count(*) into valid_approvals from rush.decision_approvals da join rush.profiles p on p.id=da.approver_id and p.active
  where da.decision_id=d.id and exists(select 1 from rush.memberships m where m.user_id=da.approver_id and m.cycle_id=d.cycle_id and m.active and m.role in ('PANEL','OWNER'))
    and not exists(select 1 from rush.conflict_declarations c where c.application_id=d.application_id and c.declarer_id=da.approver_id);
  if d.status<>'LOCKED' or valid_approvals<2 then raise exception 'decision not locked' using errcode='55000'; end if;
  perform 1 from rush.applications where id=d.application_id for update;
  update rush.applications set status=case d.outcome when 'OFFER' then 'OFFERED'::rush.application_status when 'WAITLIST' then 'WAITLISTED'::rush.application_status when 'REJECT' then 'REJECTED'::rush.application_status else 'FINAL_REVIEW'::rush.application_status end where id=d.application_id;
  update rush.decisions set status='RELEASED',released_at=now() where id=d.id and status='LOCKED';
  insert into rush.notification_outbox (cycle_id, application_id, decision_id, recipient, template_key, template_version, idempotency_key)
  select d.cycle_id, d.application_id, d.id, p.contact, 'DECISION_RELEASED', 1, 'decision-release:' || d.id
  from rush.applications a join rush.pnms p on p.id=a.pnm_id where a.id=d.application_id
  on conflict (decision_id, template_key, template_version) do nothing;
  insert into rush.audit_events(actor_id,cycle_id,action,resource,resource_id) values(auth.uid(),d.cycle_id,'DECISION_RELEASED','Decision',d.id);
end;
$$;

create function rush.decision_notification_id(target_decision_id text)
returns text
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  target_cycle text;
  item rush.notification_outbox%rowtype;
begin
  select cycle_id into target_cycle from rush.decisions where id = target_decision_id;
  if target_cycle is null then return null; end if;
  if auth.uid() is null or not rush.has_cycle_role(target_cycle, array['BOARD','PANEL','OWNER']::rush.member_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into item from rush.notification_outbox where decision_id = target_decision_id and template_key = 'DECISION_RELEASED';
  if item.id is null then return null; end if;
  return item.id;
end;
$$;

revoke all on function rush.claim_notification(text), rush.complete_notification(text,boolean,text,text,boolean), rush.retry_notification(text), rush.decision_notification_id(text) from public, anon, authenticated;
grant execute on function rush.claim_notification(text), rush.complete_notification(text,boolean,text,text,boolean) to service_role;
grant execute on function rush.decision_notification_id(text) to authenticated, service_role;
grant execute on function rush.retry_notification(text) to authenticated, service_role;
