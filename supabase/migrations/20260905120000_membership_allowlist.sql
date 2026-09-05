-- Put the 61 people who already belong here into the right role when they sign
-- themselves up. ensure_external_identity mints a profile on first sign-in and
-- deliberately refuses to link by email, so without this every board member
-- lands with no membership and waits on a manual grant.
--
-- This lives in SQL rather than in the app because the claim has to be atomic
-- with identity creation: the same first request that creates the profile is
-- the one that must attach the membership. A second round trip from the app
-- could fail between the two and leave a permanent no-membership account.
create table if not exists rush.membership_allowlist (
  -- Emails are stored already normalized so the lookup is a primary key hit and
  -- two spellings of one address can never both be claimable.
  email text primary key check (email = lower(btrim(email)) and char_length(email) between 3 and 254),
  -- Ownership is never granted by an email address. Only an existing OWNER,
  -- through rush.grant_membership, can create another one.
  role rush.member_role not null check (role <> 'OWNER'),
  -- Null means "whichever cycle is live when the row is claimed", which is what
  -- the roster wants: people join the cycle that is running when they sign in.
  cycle_id text references rush.rush_cycles (id) on delete cascade,
  note text,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  claimed_by uuid references rush.profiles (id) on delete set null
);
-- Row level security with no policies at all is deliberate: this table decides
-- who becomes Board, so only service_role reaches it. A Board-facing surface
-- for editing the roster would have to add policies here first.
alter table rush.membership_allowlist enable row level security;
alter table rush.membership_allowlist force row level security;
revoke all on table rush.membership_allowlist from public, anon, authenticated;
-- rush.grant_membership requires an OWNER caller, so the claim cannot go
-- through it and inserts the membership directly, copying that function's
-- insert and audit shape exactly.
create or replace function rush.claim_membership_allowlist(target_user_id uuid, candidate_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  entry rush.membership_allowlist;
  resolved_cycle_id text;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;

  select * into entry
  from rush.membership_allowlist a
  where a.email = lower(btrim(candidate_email)) and a.claimed_at is null
  for update;
  if not found then
    return;
  end if;

  -- Exactly one cycle is non-terminal at a time, enforced by
  -- rush_cycles_one_non_terminal_idx, so this subquery cannot return two rows.
  resolved_cycle_id := coalesce(entry.cycle_id, (
    select c.id from rush.rush_cycles c
    where c.status in ('DRAFT', 'OPEN', 'IN_PROCESS', 'DECISION_LOCK')
  ));
  -- No live cycle means there is nothing to be a member of. Return without
  -- claiming so the row stays available for the next attempt.
  if resolved_cycle_id is null then
    return;
  end if;

  insert into rush.memberships (user_id, cycle_id, role, active, revoked_at)
  values (target_user_id, resolved_cycle_id, entry.role, true, null)
  on conflict (user_id, cycle_id, role) do update set active = true, revoked_at = null;

  update rush.membership_allowlist
  set claimed_at = now(), claimed_by = target_user_id
  where email = entry.email;

  -- The claimer is recorded as the actor because no human ran this; the
  -- ALLOWLIST source distinguishes it from a self grant, which
  -- rush.grant_membership refuses outright.
  insert into rush.audit_events (actor_id, cycle_id, action, resource, resource_id, metadata)
  values (
    target_user_id, resolved_cycle_id, 'MEMBERSHIP_GRANTED', 'Profile', target_user_id::text,
    jsonb_build_object('role', entry.role, 'source', 'ALLOWLIST')
  );
end;
$$;
revoke all on function rush.claim_membership_allowlist(uuid, text) from public, anon, authenticated;
grant execute on function rush.claim_membership_allowlist(uuid, text) to service_role;
-- Unchanged from 20260902090000 apart from the claim on the last line before
-- the return, which is the only hook that runs on a user's first authenticated
-- request regardless of whether they arrived through sign-up or migration.
--
-- Known ceiling: the claim only runs on first sign-in. If no cycle is live at
-- that exact moment the row stays unclaimed and the seed script has to be run
-- again once a cycle opens. A cycle is live today, so this is not hit in
-- practice.
create or replace function rush.ensure_external_identity(
  identity_issuer text,
  identity_subject text,
  identity_email text,
  identity_display_name text,
  existing_app_user_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  canonical_issuer text := trim(trailing '/' from trim(identity_issuer));
  canonical_subject text := trim(identity_subject);
  normalized_email text := lower(trim(identity_email));
  safe_name text := left(coalesce(nullif(trim(identity_display_name), ''), split_part(normalized_email, '@', 1), 'MECG user'), 120);
  resolved_id uuid;
  ledger_email text;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if canonical_issuer = '' or canonical_subject = '' or normalized_email = '' then
    raise exception 'issuer, subject, and email are required' using errcode = '22023';
  end if;

  select i.app_user_id into resolved_id
  from rush.auth_identities i
  where i.issuer = canonical_issuer and i.subject = canonical_subject;

  if resolved_id is not null then
    update rush.auth_identities
    set disabled_at = null, updated_at = now()
    where issuer = canonical_issuer and subject = canonical_subject;
    update rush.profiles
    set display_name = safe_name, primary_email = normalized_email, active = true, updated_at = now()
    where id = resolved_id;
    return resolved_id;
  end if;

  if existing_app_user_id is not null then
    select l.expected_email into ledger_email
    from rush.auth_migration_ledger l
    where l.source_user_id = existing_app_user_id
      and l.status in ('PREPARED', 'LINKED')
    for update;
    if ledger_email is null or ledger_email <> normalized_email then
      raise exception 'migration identity is not prepared' using errcode = '22023';
    end if;
    resolved_id := existing_app_user_id;
  else
    resolved_id := gen_random_uuid();
  end if;

  begin
    insert into rush.profiles (id, display_name, primary_email)
    values (resolved_id, safe_name, normalized_email)
    on conflict (id) do update
    set display_name = excluded.display_name,
        primary_email = excluded.primary_email,
        active = true,
        updated_at = now();

    insert into rush.auth_identities (issuer, subject, app_user_id)
    values (canonical_issuer, canonical_subject, resolved_id);
  exception when unique_violation then
    select i.app_user_id into resolved_id
    from rush.auth_identities i
    where i.issuer = canonical_issuer and i.subject = canonical_subject;
    if resolved_id is null then
      raise;
    end if;
  end;

  if existing_app_user_id is not null then
    update rush.auth_migration_ledger
    set provider_subject = canonical_subject, status = 'LINKED', linked_at = coalesce(linked_at, now()), updated_at = now()
    where source_user_id = existing_app_user_id;
  end if;
  perform rush.claim_membership_allowlist(resolved_id, normalized_email);
  return resolved_id;
end;
$$;
revoke all on function rush.ensure_external_identity(text, text, text, text, uuid) from public, anon, authenticated;
grant execute on function rush.ensure_external_identity(text, text, text, text, uuid) to service_role;
