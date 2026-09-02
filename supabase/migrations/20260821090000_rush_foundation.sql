create schema if not exists rush;
revoke all on schema rush from public;
grant usage on schema rush to authenticated, service_role;
create type rush.member_role as enum ('MEMBER', 'BOARD', 'PANEL', 'OWNER');
create type rush.cycle_status as enum ('DRAFT', 'OPEN', 'IN_PROCESS', 'DECISION_LOCK', 'CLOSED', 'ARCHIVED');
create type rush.application_status as enum ('DRAFT', 'SUBMITTED', 'NEEDS_INFO', 'ELIGIBLE', 'INVITED', 'IN_PROCESS', 'FINAL_REVIEW', 'OFFERED', 'WAITLISTED', 'REJECTED', 'WITHDRAWN');
create type rush.round_status as enum ('DRAFT', 'PUBLISHED', 'ACTIVE', 'FROZEN', 'FINALIZED', 'ARCHIVED');
create type rush.assignment_status as enum ('ASSIGNED', 'IN_PROGRESS', 'SUBMITTED', 'LOCKED', 'RECUSED', 'MISSED');
create type rush.evaluation_status as enum ('DRAFT', 'SUBMITTED', 'LOCKED', 'SUPERSEDED', 'VOID');
create type rush.decision_outcome as enum ('OFFER', 'WAITLIST', 'REJECT', 'PROCEDURAL_REVIEW');
create type rush.decision_status as enum ('PENDING', 'APPROVED', 'LOCKED', 'RELEASED', 'SUPERSEDED');
create type rush.event_status as enum ('DRAFT', 'PUBLISHED', 'CLOSED', 'CANCELLED');
create table rush.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 1 and 120),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table rush.rush_cycles (
  id text primary key default gen_random_uuid()::text,
  name text not null check (char_length(trim(name)) between 1 and 160),
  status rush.cycle_status not null default 'DRAFT',
  opens_at timestamptz,
  closes_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (closes_at is null or opens_at is null or closes_at > opens_at)
);
create table rush.memberships (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null references rush.profiles (id) on delete cascade,
  cycle_id text not null references rush.rush_cycles (id) on delete cascade,
  role rush.member_role not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (user_id, cycle_id, role),
  check ((active and revoked_at is null) or not active)
);
create index memberships_cycle_role_active_idx
  on rush.memberships (cycle_id, role) where active;
create table rush.pnms (
  id text primary key default gen_random_uuid()::text,
  auth_user_id uuid unique references auth.users (id) on delete set null,
  name text not null check (char_length(trim(name)) between 1 and 120),
  contact text not null check (char_length(trim(contact)) between 3 and 254),
  normalized_contact text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (normalized_contact = lower(trim(normalized_contact)))
);
create table rush.applications (
  id text primary key default gen_random_uuid()::text,
  pnm_id text not null references rush.pnms (id),
  cycle_id text not null references rush.rush_cycles (id),
  status rush.application_status not null default 'SUBMITTED',
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pnm_id, cycle_id)
);
create index applications_cycle_status_idx on rush.applications (cycle_id, status);
create table rush.rounds (
  id text primary key default gen_random_uuid()::text,
  cycle_id text not null references rush.rush_cycles (id) on delete cascade,
  kind text not null check (char_length(trim(kind)) between 1 and 80),
  name text not null check (char_length(trim(name)) between 1 and 160),
  status rush.round_status not null default 'DRAFT',
  weight integer not null check (weight between 0 and 100),
  opens_at timestamptz,
  closes_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cycle_id, kind),
  check (closes_at is null or opens_at is null or closes_at > opens_at)
);
create table rush.rubrics (
  id text primary key default gen_random_uuid()::text,
  round_id text not null references rush.rounds (id) on delete cascade,
  version integer not null check (version > 0),
  frozen_at timestamptz,
  created_at timestamptz not null default now(),
  unique (round_id, version)
);
create table rush.rubric_criteria (
  id text primary key default gen_random_uuid()::text,
  rubric_id text not null references rush.rubrics (id) on delete cascade,
  key text not null check (key ~ '^[a-z][a-z0-9_]*$'),
  name text not null check (char_length(trim(name)) between 1 and 120),
  description text not null default '',
  weight integer not null check (weight > 0 and weight <= 100),
  required boolean not null default false,
  position integer not null check (position >= 0),
  unique (rubric_id, key),
  unique (rubric_id, position)
);
create table rush.evaluation_assignments (
  id text primary key default gen_random_uuid()::text,
  round_id text not null references rush.rounds (id) on delete cascade,
  application_id text not null references rush.applications (id) on delete cascade,
  evaluator_id uuid not null references rush.profiles (id),
  status rush.assignment_status not null default 'ASSIGNED',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (round_id, application_id, evaluator_id)
);
create index evaluation_assignments_evaluator_status_idx
  on rush.evaluation_assignments (evaluator_id, status);
create table rush.evaluations (
  id text primary key default gen_random_uuid()::text,
  assignment_id text not null references rush.evaluation_assignments (id) on delete cascade,
  evaluator_id uuid not null references rush.profiles (id),
  rubric_id text not null references rush.rubrics (id),
  version integer not null default 1 check (version > 0),
  status rush.evaluation_status not null default 'DRAFT',
  evidence text check (evidence is null or char_length(evidence) <= 10000),
  submitted_at timestamptz,
  supersedes_id text references rush.evaluations (id),
  voided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assignment_id, version),
  check (supersedes_id is null or supersedes_id <> id)
);
create table rush.criterion_ratings (
  id text primary key default gen_random_uuid()::text,
  evaluation_id text not null references rush.evaluations (id) on delete cascade,
  criterion_id text not null references rush.rubric_criteria (id),
  score integer check (score is null or score between 1 and 5),
  note text check (note is null or char_length(note) <= 4000),
  unique (evaluation_id, criterion_id)
);
create table rush.conflict_declarations (
  id text primary key default gen_random_uuid()::text,
  application_id text not null references rush.applications (id) on delete cascade,
  declarer_id uuid not null references rush.profiles (id),
  reason text not null check (char_length(trim(reason)) between 1 and 2000),
  created_at timestamptz not null default now(),
  unique (application_id, declarer_id)
);
create table rush.decisions (
  id text primary key default gen_random_uuid()::text,
  cycle_id text not null references rush.rush_cycles (id),
  application_id text not null references rush.applications (id),
  outcome rush.decision_outcome not null,
  status rush.decision_status not null default 'PENDING',
  reason text not null check (char_length(trim(reason)) between 1 and 4000),
  created_by_id uuid not null references rush.profiles (id),
  supersedes_id text references rush.decisions (id),
  created_at timestamptz not null default now(),
  locked_at timestamptz,
  released_at timestamptz,
  check (supersedes_id is null or supersedes_id <> id)
);
create unique index decisions_one_active_per_application_idx
  on rush.decisions (application_id)
  where status in ('PENDING', 'APPROVED', 'LOCKED', 'RELEASED');
create index decisions_cycle_status_idx on rush.decisions (cycle_id, status);
create table rush.decision_approvals (
  id text primary key default gen_random_uuid()::text,
  decision_id text not null references rush.decisions (id) on delete cascade,
  approver_id uuid not null references rush.profiles (id),
  created_at timestamptz not null default now(),
  unique (decision_id, approver_id)
);
create table rush.events (
  id text primary key default gen_random_uuid()::text,
  cycle_id text references rush.rush_cycles (id) on delete set null,
  name text not null check (char_length(trim(name)) between 1 and 160),
  kind text not null default 'GENERAL' check (char_length(trim(kind)) between 1 and 80),
  status rush.event_status not null default 'DRAFT',
  starts_at timestamptz not null,
  checkin_opens_at timestamptz not null,
  checkin_closes_at timestamptz not null,
  checkin_token_digest text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (checkin_closes_at > checkin_opens_at)
);
create table rush.checkins (
  id text primary key default gen_random_uuid()::text,
  pnm_id text not null references rush.pnms (id),
  event_id text not null references rush.events (id),
  checked_in_at timestamptz not null default now(),
  unique (pnm_id, event_id)
);
create table rush.claim_tokens (
  id text primary key default gen_random_uuid()::text,
  application_id text not null references rush.applications (id) on delete cascade,
  token_digest text not null unique,
  expires_at timestamptz not null,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);
create table rush.mutation_receipts (
  actor_id uuid not null references auth.users (id) on delete cascade,
  mutation_key text not null check (char_length(mutation_key) between 8 and 200),
  operation text not null check (char_length(operation) between 1 and 120),
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (actor_id, mutation_key)
);
create table rush.audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users (id) on delete set null,
  cycle_id text references rush.rush_cycles (id) on delete set null,
  action text not null check (char_length(action) between 1 and 120),
  resource text not null check (char_length(resource) between 1 and 120),
  resource_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_events_cycle_created_idx on rush.audit_events (cycle_id, created_at desc);
create index audit_events_actor_created_idx on rush.audit_events (actor_id, created_at desc);
create function rush.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger profiles_set_updated_at before update on rush.profiles
for each row execute function rush.set_updated_at();
create trigger rush_cycles_set_updated_at before update on rush.rush_cycles
for each row execute function rush.set_updated_at();
create trigger pnms_set_updated_at before update on rush.pnms
for each row execute function rush.set_updated_at();
create trigger applications_set_updated_at before update on rush.applications
for each row execute function rush.set_updated_at();
create trigger rounds_set_updated_at before update on rush.rounds
for each row execute function rush.set_updated_at();
create trigger assignments_set_updated_at before update on rush.evaluation_assignments
for each row execute function rush.set_updated_at();
create trigger evaluations_set_updated_at before update on rush.evaluations
for each row execute function rush.set_updated_at();
create trigger events_set_updated_at before update on rush.events
for each row execute function rush.set_updated_at();
create function rush.prevent_audit_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit events are append-only' using errcode = '42501';
end;
$$;
create trigger audit_events_append_only
before update or delete on rush.audit_events
for each row execute function rush.prevent_audit_mutation();
create function rush.has_cycle_role(target_cycle_id text, allowed_roles rush.member_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from rush.memberships m
    join rush.profiles p on p.id = m.user_id
    where m.user_id = auth.uid()
      and m.cycle_id = target_cycle_id
      and m.active
      and p.active
      and m.role = any (allowed_roles)
  );
$$;
create function rush.owns_application(target_application_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from rush.applications a
    join rush.pnms p on p.id = a.pnm_id
    where a.id = target_application_id
      and p.auth_user_id = auth.uid()
  );
$$;
revoke all on function rush.has_cycle_role(text, rush.member_role[]) from public;
revoke all on function rush.owns_application(text) from public;
grant execute on function rush.has_cycle_role(text, rush.member_role[]) to authenticated, service_role;
grant execute on function rush.owns_application(text) to authenticated, service_role;
alter table rush.profiles enable row level security;
alter table rush.profiles force row level security;
alter table rush.rush_cycles enable row level security;
alter table rush.rush_cycles force row level security;
alter table rush.memberships enable row level security;
alter table rush.memberships force row level security;
alter table rush.pnms enable row level security;
alter table rush.pnms force row level security;
alter table rush.applications enable row level security;
alter table rush.applications force row level security;
alter table rush.rounds enable row level security;
alter table rush.rounds force row level security;
alter table rush.rubrics enable row level security;
alter table rush.rubrics force row level security;
alter table rush.rubric_criteria enable row level security;
alter table rush.rubric_criteria force row level security;
alter table rush.evaluation_assignments enable row level security;
alter table rush.evaluation_assignments force row level security;
alter table rush.evaluations enable row level security;
alter table rush.evaluations force row level security;
alter table rush.criterion_ratings enable row level security;
alter table rush.criterion_ratings force row level security;
alter table rush.conflict_declarations enable row level security;
alter table rush.conflict_declarations force row level security;
alter table rush.decisions enable row level security;
alter table rush.decisions force row level security;
alter table rush.decision_approvals enable row level security;
alter table rush.decision_approvals force row level security;
alter table rush.events enable row level security;
alter table rush.events force row level security;
alter table rush.checkins enable row level security;
alter table rush.checkins force row level security;
alter table rush.claim_tokens enable row level security;
alter table rush.claim_tokens force row level security;
alter table rush.mutation_receipts enable row level security;
alter table rush.mutation_receipts force row level security;
alter table rush.audit_events enable row level security;
alter table rush.audit_events force row level security;
create policy profiles_read_self on rush.profiles for select to authenticated
using (id = auth.uid());
create policy profiles_read_cycle_colleagues on rush.profiles for select to authenticated
using (exists (
  select 1 from rush.memberships mine
  join rush.memberships theirs on theirs.cycle_id = mine.cycle_id
  where mine.user_id = auth.uid() and mine.active
    and theirs.user_id = profiles.id and theirs.active
));
create policy cycles_read_participant on rush.rush_cycles for select to authenticated
using (
  rush.has_cycle_role(id, array['MEMBER', 'BOARD', 'PANEL', 'OWNER']::rush.member_role[])
  or exists (
    select 1 from rush.applications a join rush.pnms p on p.id = a.pnm_id
    where a.cycle_id = rush_cycles.id and p.auth_user_id = auth.uid()
  )
);
create policy memberships_read_own_or_manager on rush.memberships for select to authenticated
using (
  user_id = auth.uid()
  or rush.has_cycle_role(cycle_id, array['BOARD', 'OWNER']::rush.member_role[])
);
create policy pnms_read_owner_or_internal on rush.pnms for select to authenticated
using (
  auth_user_id = auth.uid()
  or exists (
    select 1 from rush.applications a
    where a.pnm_id = pnms.id
      and rush.has_cycle_role(a.cycle_id, array['BOARD', 'PANEL', 'OWNER']::rush.member_role[])
  )
);
create policy applications_read_owner_or_internal on rush.applications for select to authenticated
using (
  rush.owns_application(id)
  or rush.has_cycle_role(cycle_id, array['BOARD', 'PANEL', 'OWNER']::rush.member_role[])
  or exists (
    select 1 from rush.evaluation_assignments ea
    where ea.application_id = applications.id and ea.evaluator_id = auth.uid()
  )
);
create policy rounds_read_cycle_participant on rush.rounds for select to authenticated
using (rush.has_cycle_role(cycle_id, array['MEMBER', 'BOARD', 'PANEL', 'OWNER']::rush.member_role[]));
create policy rubrics_read_cycle_participant on rush.rubrics for select to authenticated
using (exists (
  select 1 from rush.rounds r where r.id = rubrics.round_id
  and rush.has_cycle_role(r.cycle_id, array['MEMBER', 'BOARD', 'PANEL', 'OWNER']::rush.member_role[])
));
create policy rubric_criteria_read_cycle_participant on rush.rubric_criteria for select to authenticated
using (exists (
  select 1 from rush.rubrics rb join rush.rounds r on r.id = rb.round_id
  where rb.id = rubric_criteria.rubric_id
  and rush.has_cycle_role(r.cycle_id, array['MEMBER', 'BOARD', 'PANEL', 'OWNER']::rush.member_role[])
));
create policy assignments_read_evaluator_or_manager on rush.evaluation_assignments for select to authenticated
using (
  evaluator_id = auth.uid()
  or exists (
    select 1 from rush.rounds r where r.id = evaluation_assignments.round_id
    and rush.has_cycle_role(r.cycle_id, array['BOARD', 'OWNER']::rush.member_role[])
  )
);
create policy evaluations_read_author_or_locked_panel on rush.evaluations for select to authenticated
using (
  evaluator_id = auth.uid()
  or exists (
    select 1 from rush.evaluation_assignments ea
    join rush.rounds r on r.id = ea.round_id
    where ea.id = evaluations.assignment_id
      and evaluations.status = 'LOCKED'
      and rush.has_cycle_role(r.cycle_id, array['PANEL', 'OWNER']::rush.member_role[])
      and not exists (
        select 1 from rush.conflict_declarations c
        where c.application_id = ea.application_id and c.declarer_id = auth.uid()
      )
  )
);
create policy ratings_read_with_evaluation on rush.criterion_ratings for select to authenticated
using (exists (select 1 from rush.evaluations e where e.id = criterion_ratings.evaluation_id));
create policy conflicts_read_own_or_manager on rush.conflict_declarations for select to authenticated
using (
  declarer_id = auth.uid()
  or exists (
    select 1 from rush.applications a where a.id = conflict_declarations.application_id
    and rush.has_cycle_role(a.cycle_id, array['BOARD', 'OWNER']::rush.member_role[])
  )
);
create policy decisions_read_owner_or_panel on rush.decisions for select to authenticated
using (
  (status = 'RELEASED' and rush.owns_application(application_id))
  or (
    rush.has_cycle_role(cycle_id, array['PANEL', 'OWNER']::rush.member_role[])
    and not exists (
      select 1 from rush.conflict_declarations c
      where c.application_id = decisions.application_id and c.declarer_id = auth.uid()
    )
  )
);
create policy approvals_read_panel on rush.decision_approvals for select to authenticated
using (exists (
  select 1 from rush.decisions d where d.id = decision_approvals.decision_id
  and rush.has_cycle_role(d.cycle_id, array['PANEL', 'OWNER']::rush.member_role[])
));
create policy events_read_participant on rush.events for select to authenticated
using (
  cycle_id is not null and (
    rush.has_cycle_role(cycle_id, array['MEMBER', 'BOARD', 'PANEL', 'OWNER']::rush.member_role[])
    or exists (
      select 1 from rush.applications a join rush.pnms p on p.id = a.pnm_id
      where a.cycle_id = events.cycle_id and p.auth_user_id = auth.uid()
    )
  )
);
create policy checkins_read_owner_or_board on rush.checkins for select to authenticated
using (
  exists (select 1 from rush.pnms p where p.id = checkins.pnm_id and p.auth_user_id = auth.uid())
  or exists (
    select 1 from rush.events e where e.id = checkins.event_id and e.cycle_id is not null
    and rush.has_cycle_role(e.cycle_id, array['BOARD', 'OWNER']::rush.member_role[])
  )
);
create policy receipts_read_own on rush.mutation_receipts for select to authenticated
using (actor_id = auth.uid());
create policy audit_read_board on rush.audit_events for select to authenticated
using (cycle_id is not null and rush.has_cycle_role(cycle_id, array['BOARD', 'OWNER']::rush.member_role[]));
grant select on all tables in schema rush to authenticated;
grant all on all tables in schema rush to service_role;
grant usage, select on all sequences in schema rush to service_role;
grant usage on type rush.member_role to authenticated, service_role;
grant usage on type rush.cycle_status to authenticated, service_role;
grant usage on type rush.application_status to authenticated, service_role;
grant usage on type rush.round_status to authenticated, service_role;
grant usage on type rush.assignment_status to authenticated, service_role;
grant usage on type rush.evaluation_status to authenticated, service_role;
grant usage on type rush.decision_outcome to authenticated, service_role;
grant usage on type rush.decision_status to authenticated, service_role;
grant usage on type rush.event_status to authenticated, service_role;
alter default privileges in schema rush revoke all on tables from public, anon, authenticated;
alter default privileges in schema rush grant select on tables to authenticated;
alter default privileges in schema rush grant all on tables to service_role;
alter default privileges in schema rush revoke all on functions from public, anon;
alter default privileges in schema rush grant execute on functions to authenticated, service_role;
