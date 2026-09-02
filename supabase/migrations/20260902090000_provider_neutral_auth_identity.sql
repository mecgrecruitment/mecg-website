-- Make the application UUID independent from the authentication provider.
-- Clerk subjects are strings, while the Rush domain and its audit trail use
-- UUIDs. This exact issuer/subject mapping preserves every existing domain ID.

alter table rush.profiles
  add column primary_email text;

update rush.profiles p
set primary_email = lower(trim(u.email))
from auth.users u
where u.id = p.id and nullif(trim(u.email), '') is not null;

alter table rush.profiles
  add constraint profiles_primary_email_normalized
  check (primary_email is null or (primary_email = lower(trim(primary_email)) and char_length(primary_email) between 3 and 254));

create table rush.auth_identities (
  issuer text not null check (issuer = trim(trailing '/' from trim(issuer)) and issuer <> ''),
  subject text not null check (subject = trim(subject) and subject <> ''),
  app_user_id uuid not null references rush.profiles (id) on delete cascade,
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (issuer, subject),
  unique (issuer, app_user_id)
);

alter table rush.auth_identities enable row level security;
alter table rush.auth_identities force row level security;
revoke all on table rush.auth_identities from public, anon, authenticated;

create table rush.auth_migration_ledger (
  source_user_id uuid primary key references rush.profiles (id) on delete cascade,
  expected_email text not null check (expected_email = lower(trim(expected_email)) and char_length(expected_email) between 3 and 254),
  provider_subject text unique,
  status text not null default 'PREPARED' check (status in ('PREPARED', 'LINKED', 'FAILED')),
  prepared_at timestamptz not null default now(),
  linked_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table rush.auth_migration_ledger enable row level security;
alter table rush.auth_migration_ledger force row level security;
revoke all on table rush.auth_migration_ledger from public, anon, authenticated;

create or replace function rush.actor_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select i.app_user_id
  from rush.auth_identities i
  where i.issuer = trim(trailing '/' from coalesce(auth.jwt() ->> 'iss', ''))
    and i.subject = coalesce(auth.jwt() ->> 'sub', '')
    and i.disabled_at is null;
$$;

revoke all on function rush.actor_id() from public, anon;
grant execute on function rush.actor_id() to authenticated, service_role;

create or replace function rush.prepare_auth_migration(source_user_id uuid, expected_email text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_email text := lower(trim(expected_email));
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if normalized_email = '' then
    raise exception 'expected email required' using errcode = '22023';
  end if;
  if not exists (
    select 1 from rush.profiles p
    where p.id = source_user_id and p.primary_email = normalized_email
  ) then
    raise exception 'source identity does not match profile' using errcode = '22023';
  end if;

  insert into rush.auth_migration_ledger (source_user_id, expected_email, status)
  values (source_user_id, normalized_email, 'PREPARED')
  on conflict on constraint auth_migration_ledger_pkey do update
  set expected_email = excluded.expected_email,
      status = case when rush.auth_migration_ledger.status = 'LINKED' then 'LINKED' else 'PREPARED' end,
      updated_at = now();
  return true;
end;
$$;

revoke all on function rush.prepare_auth_migration(uuid, text) from public, anon, authenticated;
grant execute on function rush.prepare_auth_migration(uuid, text) to service_role;

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
  return resolved_id;
end;
$$;

revoke all on function rush.ensure_external_identity(text, text, text, text, uuid) from public, anon, authenticated;
grant execute on function rush.ensure_external_identity(text, text, text, text, uuid) to service_role;

create or replace function rush.disable_external_identity(identity_issuer text, identity_subject text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  update rush.auth_identities
  set disabled_at = coalesce(disabled_at, now()), updated_at = now()
  where issuer = trim(trailing '/' from trim(identity_issuer)) and subject = trim(identity_subject);
  return found;
end;
$$;

revoke all on function rush.disable_external_identity(text, text) from public, anon, authenticated;
grant execute on function rush.disable_external_identity(text, text) to service_role;

-- Keep Supabase Auth usable throughout the recovery window. Both issuers are
-- explicit because actor lookup intentionally never guesses from a bare UUID.
create or replace function rush.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_name text;
  normalized_email text := nullif(lower(trim(new.email)), '');
begin
  profile_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'MECG user'
  );
  insert into rush.profiles (id, display_name, primary_email)
  values (new.id, left(profile_name, 120), normalized_email)
  on conflict (id) do update
  set display_name = excluded.display_name, primary_email = excluded.primary_email, active = true, updated_at = now();

  insert into rush.auth_identities (issuer, subject, app_user_id)
  values
    ('https://chrxtsohxazngabdcpzb.supabase.co/auth/v1', new.id::text, new.id),
    ('http://127.0.0.1:54321/auth/v1', new.id::text, new.id)
  on conflict (issuer, subject) do update set app_user_id = excluded.app_user_id, disabled_at = null, updated_at = now();
  return new;
end;
$$;

revoke all on function rush.handle_new_auth_user() from public, anon, authenticated;

-- Seed mappings only for provider users that already own a domain profile.
-- Supabase Auth may retain abandoned or administrative accounts with no Rush
-- profile, and auth_identities deliberately cannot point at those accounts.
insert into rush.auth_identities (issuer, subject, app_user_id)
select issuer, u.id::text, u.id
from auth.users u
join rush.profiles p on p.id = u.id
cross join (values
  ('https://chrxtsohxazngabdcpzb.supabase.co/auth/v1'),
  ('http://127.0.0.1:54321/auth/v1')
) as known(issuer)
on conflict (issuer, subject) do update set app_user_id = excluded.app_user_id, disabled_at = null, updated_at = now();

-- Move all effective authorization functions and policies through the single
-- provider-neutral boundary. Guard counts make catalog drift fail loudly.
-- The linked production project retains an older, equivalent inline form of
-- pnms_read_internal even though its migration ledger is current. Accept only
-- that exact known variant; never count or rewrite policies outside rush.
do $$
declare
  function_count integer;
  item record;
begin
  select count(*) into function_count
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'rush' and p.prokind = 'f'
    and pg_get_functiondef(p.oid) like '%auth.uid()%';
  if function_count <> 88 then
    raise exception 'expected 88 auth.uid()-coupled Rush functions, found %', function_count;
  end if;
  for item in
    select p.oid, pg_get_functiondef(p.oid) definition
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'rush' and p.prokind = 'f'
      and pg_get_functiondef(p.oid) like '%auth.uid()%'
  loop
    execute replace(item.definition, 'auth.uid()', 'rush.actor_id()');
  end loop;
end;
$$;

-- The workflow verifier deliberately impersonates its fixture users. Give
-- those synthetic claims an explicit trusted issuer as production JWTs do.
do $migration$
declare
  definition text;
begin
  definition := pg_get_functiondef('rush.verify_full_workflow(uuid,uuid,uuid)'::regprocedure);
  execute replace(
    definition,
    'jsonb_build_object(''sub'',',
    'jsonb_build_object(''iss'',''https://chrxtsohxazngabdcpzb.supabase.co/auth/v1'',''sub'','
  );
end;
$migration$;

do $$
declare
  coupled_policies text[];
  expected_policies text[] := array[
    'rush.application_documents:application_documents_internal_read',
    'rush.application_documents:application_documents_owner_read',
    'rush.buddy_bookings:buddy_bookings_read',
    'rush.buddy_slots:buddy_slots_read',
    'rush.checkins:checkins_read_owner_or_board',
    'rush.conflict_declarations:conflicts_read_own_or_manager',
    'rush.criterion_ratings:ratings_read_with_evaluation',
    'rush.evaluation_assignments:assignments_read_evaluator_or_manager',
    'rush.evaluations:evaluations_read_author_or_locked_panel',
    'rush.event_impressions:event_impressions_read_own_or_staff',
    'rush.member_checkins:member_checkins_read_own_or_staff',
    'rush.memberships:memberships_read_own_or_manager',
    'rush.messages:messages_read_internal',
    'rush.mutation_receipts:receipts_read_own',
    'rush.pnms:pnms_read_self',
    'rush.profiles:profiles_read_self',
    'rush.project_members:project_members_read_internal',
    'rush.projects:projects_read_internal'
  ];
  legacy_production_policies text[] := array[
    'rush.application_documents:application_documents_internal_read',
    'rush.application_documents:application_documents_owner_read',
    'rush.buddy_bookings:buddy_bookings_read',
    'rush.buddy_slots:buddy_slots_read',
    'rush.checkins:checkins_read_owner_or_board',
    'rush.conflict_declarations:conflicts_read_own_or_manager',
    'rush.criterion_ratings:ratings_read_with_evaluation',
    'rush.evaluation_assignments:assignments_read_evaluator_or_manager',
    'rush.evaluations:evaluations_read_author_or_locked_panel',
    'rush.event_impressions:event_impressions_read_own_or_staff',
    'rush.member_checkins:member_checkins_read_own_or_staff',
    'rush.memberships:memberships_read_own_or_manager',
    'rush.messages:messages_read_internal',
    'rush.mutation_receipts:receipts_read_own',
    'rush.pnms:pnms_read_internal',
    'rush.pnms:pnms_read_self',
    'rush.profiles:profiles_read_self',
    'rush.project_members:project_members_read_internal',
    'rush.projects:projects_read_internal'
  ];
  item record;
  statement text;
  using_expression text;
  check_expression text;
begin
  select array_agg(format('%s.%s:%s', n.nspname, c.relname, p.polname)
                   order by n.nspname, c.relname, p.polname)
  into coupled_policies
  from pg_policy p
  join pg_class c on c.oid = p.polrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'rush'
    and (pg_get_expr(p.polqual, p.polrelid) like '%auth.uid()%'
      or pg_get_expr(p.polwithcheck, p.polrelid) like '%auth.uid()%');
  if coupled_policies is distinct from expected_policies
     and coupled_policies is distinct from legacy_production_policies then
    raise exception 'unexpected auth.uid()-coupled Rush policy set: %', coupled_policies;
  end if;
  for item in
    select p.polname, n.nspname, c.relname, p.polcmd,
           pg_get_expr(p.polqual, p.polrelid) polqual,
           pg_get_expr(p.polwithcheck, p.polrelid) polwithcheck
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'rush'
      and (pg_get_expr(p.polqual, p.polrelid) like '%auth.uid()%'
        or pg_get_expr(p.polwithcheck, p.polrelid) like '%auth.uid()%')
  loop
    statement := format('alter policy %I on %I.%I', item.polname, item.nspname, item.relname);
    using_expression := replace(item.polqual, 'auth.uid()', 'rush.actor_id()');
    check_expression := replace(item.polwithcheck, 'auth.uid()', 'rush.actor_id()');
    if item.polcmd in ('r', 'a', 'd') and using_expression is not null then
      statement := statement || format(' using (%s)', using_expression);
    end if;
    if item.polcmd in ('a', 'w') and check_expression is not null then
      statement := statement || format(' with check (%s)', check_expression);
    end if;
    execute statement;
  end loop;
end;
$$;

-- Background jobs now read application-owned contact data, not auth.users.
create or replace function rush.application_portal_allows(actor uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (select 1 from rush.application_portal_allowlist)
      or exists (
        select 1 from rush.application_portal_allowlist a
        join rush.profiles p on p.primary_email = lower(a.email)
        where p.id = actor
      )
      or exists (
        select 1 from rush.profiles p
        where p.id = actor and p.primary_email like 'workflow-%@example.invalid'
      );
$$;

revoke all on function rush.application_portal_allows(uuid) from public, anon, authenticated;
grant execute on function rush.application_portal_allows(uuid) to service_role;

create or replace function rush.pending_reminders()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when auth.role() is distinct from 'service_role' then '[]'::jsonb
    else coalesce((
      select jsonb_agg(jsonb_build_object(
        'kind', 'EVALUATION_DUE', 'subjectId', r.id, 'recipientId', a.evaluator_id,
        'email', p.primary_email, 'name', p.display_name, 'detail', r.name, 'dueAt', r.closes_at
      ))
      from rush.evaluation_assignments a
      join rush.rounds r on r.id = a.round_id
      join rush.profiles p on p.id = a.evaluator_id
      where r.status = 'ACTIVE' and r.closes_at is not null
        and r.closes_at between now() and now() + interval '48 hours'
        and a.status in ('ASSIGNED', 'IN_PROGRESS') and p.active and p.primary_email is not null
        and not exists (
          select 1 from rush.reminders_sent s
          where s.kind = 'EVALUATION_DUE' and s.subject_id = r.id and s.recipient_id = a.evaluator_id
        )
    ), '[]'::jsonb)
  end;
$$;

revoke all on function rush.pending_reminders() from public, anon, authenticated;
grant execute on function rush.pending_reminders() to service_role;

-- Domain lifecycle is now rooted in profiles rather than provider accounts.
alter table rush.application_documents drop constraint application_documents_owner_user_id_fkey;
alter table rush.application_documents add constraint application_documents_owner_user_id_fkey foreign key (owner_user_id) references rush.profiles(id) on delete cascade;
alter table rush.audit_events drop constraint audit_events_actor_id_fkey;
alter table rush.audit_events add constraint audit_events_actor_id_fkey foreign key (actor_id) references rush.profiles(id) on delete set null;
alter table rush.event_impressions drop constraint event_impressions_member_id_fkey;
alter table rush.event_impressions add constraint event_impressions_member_id_fkey foreign key (member_id) references rush.profiles(id) on delete cascade;
alter table rush.member_checkins drop constraint member_checkins_member_id_fkey;
alter table rush.member_checkins add constraint member_checkins_member_id_fkey foreign key (member_id) references rush.profiles(id) on delete cascade;
alter table rush.mutation_receipts drop constraint mutation_receipts_actor_id_fkey;
alter table rush.mutation_receipts add constraint mutation_receipts_actor_id_fkey foreign key (actor_id) references rush.profiles(id) on delete cascade;
alter table rush.pnms drop constraint pnms_auth_user_id_fkey;
alter table rush.pnms add constraint pnms_auth_user_id_fkey foreign key (auth_user_id) references rush.profiles(id) on delete set null;
alter table rush.project_members drop constraint project_members_user_id_fkey;
alter table rush.project_members add constraint project_members_user_id_fkey foreign key (user_id) references rush.profiles(id) on delete cascade;
alter table rush.reminders_sent drop constraint reminders_sent_recipient_id_fkey;
alter table rush.reminders_sent add constraint reminders_sent_recipient_id_fkey foreign key (recipient_id) references rush.profiles(id) on delete cascade;
alter table rush.profiles drop constraint profiles_id_fkey;

-- No effective domain object may silently retain the old provider principal.
do $$
declare retained integer;
begin
  select count(*) into retained
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'rush' and p.prokind = 'f'
    and pg_get_functiondef(p.oid) like '%auth.uid()%';
  if retained <> 0 then raise exception '% Rush functions still call auth.uid()', retained; end if;
  select count(*) into retained
  from pg_policy p
  join pg_class c on c.oid = p.polrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'rush'
    and (pg_get_expr(p.polqual, p.polrelid) like '%auth.uid()%'
      or pg_get_expr(p.polwithcheck, p.polrelid) like '%auth.uid()%');
  if retained <> 0 then raise exception '% Rush policies still call auth.uid()', retained; end if;
end;
$$;
