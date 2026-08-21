-- Phase 0 · Migration 4: hash, decisions, audit, placement (PRD §10.2)

create table public.hash_sessions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cycle_id uuid not null references public.recruitment_cycles (id) on delete restrict,
  stage public.candidate_stage not null, -- the stage this hash decides
  name text not null,
  visibility public.hash_visibility not null default 'anonymous', -- I1: board-only change
  quorum_threshold integer not null default 0 check (quorum_threshold >= 0),
  is_active boolean not null default false,
  started_at timestamptz,
  ended_at timestamptz, -- NULL = open
  started_by uuid references public.members (id) on delete set null
);

create unique index hash_sessions_one_active_per_cycle on public.hash_sessions (cycle_id) where is_active;

-- M3: the eligible-voter set; quorum = distinct voters ÷ eligible.
create table public.hash_session_participants (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  session_id uuid not null references public.hash_sessions (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  unique (session_id, member_id)
);

create index hash_session_participants_session_idx on public.hash_session_participants (session_id);

-- I2: append-only; current vote = latest created_at per (session, candidate, voter).
-- voter_id concealed from non-board when session visibility = 'anonymous'.
create table public.votes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  session_id uuid not null references public.hash_sessions (id) on delete restrict,
  candidate_id uuid not null references public.candidates (id) on delete restrict,
  voter_id uuid not null references public.members (id) on delete restrict,
  value public.vote_value not null
);

create index votes_voter_id_idx on public.votes (voter_id);
create index votes_latest_idx on public.votes (session_id, candidate_id, voter_id, created_at desc);

-- E1/E2: append-only, NO update path ever. Latest row per (session, candidate) is authoritative;
-- a reversal is a new row.
create table public.decisions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  session_id uuid not null references public.hash_sessions (id) on delete restrict,
  candidate_id uuid not null references public.candidates (id) on delete restrict,
  value public.decision_value not null,
  decided_by uuid not null references public.members (id) on delete restrict,
  rationale text,
  voter_tally jsonb -- {"advance":n,"cut":n,"discuss":n,"total_voters":n} snapshot
);

create index decisions_latest_idx on public.decisions (session_id, candidate_id, created_at desc);

-- Board-only, append-only; populated by triggers (migration 5).
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_id uuid references public.members (id) on delete set null, -- NULL for system/anon-intake
  action public.audit_action not null,
  entity_type text not null,
  entity_id uuid not null,
  cycle_id uuid references public.recruitment_cycles (id) on delete set null,
  before_state jsonb,
  after_state jsonb,
  metadata jsonb
);

create index audit_log_entity_idx on public.audit_log (entity_type, entity_id);
create index audit_log_actor_idx on public.audit_log (actor_id);
create index audit_log_created_idx on public.audit_log (created_at);
create index audit_log_cycle_idx on public.audit_log (cycle_id);

-- M4: curation override layer for /placement. NULL member_id = fully manual entry.
create table public.placement_features (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cycle_id uuid references public.recruitment_cycles (id) on delete set null,
  member_id uuid references public.members (id) on delete set null,
  company text not null,
  role_title text,
  term text,
  logo_storage_path text,
  quote text,
  sort_order integer not null default 0,
  is_featured boolean not null default false
);
;
