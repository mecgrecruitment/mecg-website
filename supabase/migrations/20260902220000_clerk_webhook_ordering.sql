-- Clerk webhooks are retried and may arrive out of order. Keep a private
-- delivery ledger and per-identity cursor so a stale update cannot reactivate
-- an identity after a newer deletion.

create table rush.clerk_webhook_events (
  event_id text primary key check (event_id = trim(event_id) and event_id <> ''),
  event_type text not null check (event_type in ('user.created', 'user.updated', 'user.deleted')),
  issuer text not null,
  subject text not null,
  occurred_at timestamptz not null,
  outcome text not null check (outcome in ('APPLIED', 'STALE')),
  processed_at timestamptz not null default now()
);

create table rush.clerk_webhook_identity_state (
  issuer text not null,
  subject text not null,
  last_event_at timestamptz not null,
  last_event_type text not null check (last_event_type in ('user.created', 'user.updated', 'user.deleted')),
  last_event_id text not null references rush.clerk_webhook_events(event_id),
  updated_at timestamptz not null default now(),
  primary key (issuer, subject)
);

alter table rush.clerk_webhook_events enable row level security;
alter table rush.clerk_webhook_events force row level security;
alter table rush.clerk_webhook_identity_state enable row level security;
alter table rush.clerk_webhook_identity_state force row level security;
revoke all on table rush.clerk_webhook_events from public, anon, authenticated;
revoke all on table rush.clerk_webhook_identity_state from public, anon, authenticated;

create or replace function rush.reconcile_clerk_webhook(
  webhook_event_id text,
  webhook_event_type text,
  identity_issuer text,
  identity_subject text,
  webhook_occurred_at timestamptz,
  identity_email text default null,
  identity_display_name text default null,
  existing_app_user_id uuid default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  canonical_event_id text := trim(webhook_event_id);
  canonical_issuer text := trim(trailing '/' from trim(identity_issuer));
  canonical_subject text := trim(identity_subject);
  previous_event_at timestamptz;
  previous_event_type text;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if canonical_event_id = '' or canonical_issuer = '' or canonical_subject = '' or webhook_occurred_at is null then
    raise exception 'event id, issuer, subject, and timestamp are required' using errcode = '22023';
  end if;
  if webhook_event_type not in ('user.created', 'user.updated', 'user.deleted') then
    raise exception 'unsupported Clerk webhook event' using errcode = '22023';
  end if;
  if webhook_event_type <> 'user.deleted' and nullif(trim(identity_email), '') is null then
    raise exception 'email is required for Clerk identity provisioning' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(canonical_issuer || chr(31) || canonical_subject, 0));

  if exists (select 1 from rush.clerk_webhook_events e where e.event_id = canonical_event_id) then
    return 'DUPLICATE';
  end if;

  select s.last_event_at, s.last_event_type
  into previous_event_at, previous_event_type
  from rush.clerk_webhook_identity_state s
  where s.issuer = canonical_issuer and s.subject = canonical_subject;

  -- A deletion wins timestamp ties. Other same-time deliveries are harmlessly
  -- deduplicated at the identity cursor because Clerk timestamps have finite
  -- precision and their relative arrival order is not authoritative.
  if previous_event_at > webhook_occurred_at
     or (previous_event_at = webhook_occurred_at
         and (previous_event_type = 'user.deleted' or webhook_event_type <> 'user.deleted')) then
    insert into rush.clerk_webhook_events(event_id, event_type, issuer, subject, occurred_at, outcome)
    values (canonical_event_id, webhook_event_type, canonical_issuer, canonical_subject, webhook_occurred_at, 'STALE');
    return 'STALE';
  end if;

  if webhook_event_type = 'user.deleted' then
    perform rush.disable_external_identity(canonical_issuer, canonical_subject);
  else
    perform rush.ensure_external_identity(
      canonical_issuer,
      canonical_subject,
      identity_email,
      identity_display_name,
      existing_app_user_id
    );
  end if;

  insert into rush.clerk_webhook_events(event_id, event_type, issuer, subject, occurred_at, outcome)
  values (canonical_event_id, webhook_event_type, canonical_issuer, canonical_subject, webhook_occurred_at, 'APPLIED');

  insert into rush.clerk_webhook_identity_state(issuer, subject, last_event_at, last_event_type, last_event_id)
  values (canonical_issuer, canonical_subject, webhook_occurred_at, webhook_event_type, canonical_event_id)
  on conflict (issuer, subject) do update
  set last_event_at = excluded.last_event_at,
      last_event_type = excluded.last_event_type,
      last_event_id = excluded.last_event_id,
      updated_at = now();

  return 'APPLIED';
end;
$$;

revoke all on function rush.reconcile_clerk_webhook(text,text,text,text,timestamptz,text,text,uuid) from public, anon, authenticated;
grant execute on function rush.reconcile_clerk_webhook(text,text,text,text,timestamptz,text,text,uuid) to service_role;
