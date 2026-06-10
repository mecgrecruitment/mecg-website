-- Phase 0 · Migration 2: identity + intake tables (PRD §10.2)

-- members: internal users. PK id ≠ auth.uid(); user_id is the auth link (reconciliation A1).
create table public.members (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  user_id uuid not null unique references auth.users (id) on delete cascade,
  role public.member_role not null default 'general_member',
  email text not null,
  full_name text not null,
  preferred_name text,
  year text,
  major text,
  bio text,
  photo_storage_path text,
  current_company text,
  current_role_title text,
  linkedin_url text,
  is_public boolean not null default false,
  -- M5: separate from is_public; true ⇒ company appears on /placement.
  placement_consent boolean not null default false
);

create unique index members_email_lower_key on public.members (lower(email));
create index members_user_id_idx on public.members (user_id);
create index members_role_idx on public.members (role);

-- invite_allowlist: board-controlled signup gating (reconciliation I3).
create table public.invite_allowlist (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  email text not null,
  role public.member_role not null default 'general_member',
  invited_by uuid references public.members (id) on delete set null,
  expires_at timestamptz, -- NULL = no expiry
  consumed_at timestamptz, -- set on successful registration
  notes text
);

create unique index invite_allowlist_email_lower_key on public.invite_allowlist (lower(email));

create table public.recruitment_cycles (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null unique,
  applications_open_at timestamptz,
  applications_close_at timestamptz,
  is_active boolean not null default false,
  -- J2: true ⇒ general members may read v_candidate_roster for this cycle.
  is_open_rush boolean not null default false,
  created_by uuid not null references public.members (id) on delete restrict
);

create unique index recruitment_cycles_one_active on public.recruitment_cycles (is_active) where is_active;
create unique index recruitment_cycles_one_open_rush on public.recruitment_cycles (is_open_rush) where is_open_rush;

-- candidates: applicants are rows here, NOT auth users (SEC-8).
create table public.candidates (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  cycle_id uuid not null references public.recruitment_cycles (id) on delete restrict,
  per_cycle_seq integer not null, -- trigger-assigned; displayed as C{seq:02d}
  full_name text not null,
  preferred_name text,
  phone text,
  year text,
  major text,
  email text not null,
  gpa numeric(3, 2) check (gpa between 0 and 4.0),
  resume_storage_path text, -- F3 canonical column name
  linkedin_url text,
  current_stage public.candidate_stage not null default 'applied',
  status public.candidate_status not null default 'active',
  unique (cycle_id, per_cycle_seq)
);

-- C1: per-cycle uniqueness; re-applicants get a new cycle-scoped row (C2).
create unique index candidates_cycle_email_lower_key on public.candidates (cycle_id, lower(email));
create index candidates_cycle_id_idx on public.candidates (cycle_id);

create table public.application_questions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  cycle_id uuid not null references public.recruitment_cycles (id) on delete cascade,
  key text not null,
  prompt text not null,
  input_type text not null default 'long_text' check (input_type in ('short_text', 'long_text', 'url', 'select')),
  required boolean not null default true,
  sort_order integer not null default 0,
  unique (cycle_id, key)
);

-- Immutable snapshots of answers at submission (M6, append-only).
create table public.application_responses (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  candidate_id uuid not null references public.candidates (id) on delete cascade,
  question_key text not null,
  question_text text not null, -- snapshot at submission time
  response_text text not null check (length(response_text) > 0),
  unique (candidate_id, question_key)
);

-- M8/L2: Postgres-backed /apply rate limiter (5 submissions / IP / 24h).
create table public.apply_rate_limit (
  ip_hash text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (ip_hash, window_start)
);
