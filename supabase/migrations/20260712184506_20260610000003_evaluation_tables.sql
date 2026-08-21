-- Phase 0 · Migration 3: evaluation tables (PRD §10.2, §10.4, §10.5)

create table public.rubric_versions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  cycle_id uuid not null references public.recruitment_cycles (id) on delete restrict,
  stage public.candidate_stage not null,
  version_number integer not null,
  label text,
  is_active boolean not null default false,
  created_by uuid not null references public.members (id) on delete restrict,
  unique (cycle_id, stage, version_number)
);

create unique index rubric_versions_one_active on public.rubric_versions (cycle_id, stage) where is_active;

-- Immutable once any scores reference the version (ATS-8); changes = new version.
create table public.rubric_criteria (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  rubric_version_id uuid not null references public.rubric_versions (id) on delete cascade,
  name text not null,
  description text,
  weight numeric(6, 4) not null default 1.0 check (weight > 0),
  min_score integer not null default 1 check (min_score >= 1),
  max_score integer not null default 5,
  display_order integer not null default 0,
  unique (rubric_version_id, name),
  check (max_score > min_score)
);

-- The sole blind-state mechanism (DM-29): a row here = evaluator submitted for (candidate, stage).
-- There is NO status column on scores. Append-only.
create table public.score_submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  submitted_at timestamptz not null default now(),
  candidate_id uuid not null references public.candidates (id) on delete cascade,
  evaluator_id uuid not null references public.members (id) on delete restrict,
  stage public.candidate_stage not null,
  rubric_version_id uuid not null references public.rubric_versions (id) on delete restrict,
  unique (candidate_id, evaluator_id, stage)
);

create index score_submissions_blind_idx on public.score_submissions (candidate_id, evaluator_id, stage);

create table public.scores (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  candidate_id uuid not null references public.candidates (id) on delete cascade,
  rubric_criterion_id uuid not null references public.rubric_criteria (id) on delete restrict,
  rubric_version_id uuid not null references public.rubric_versions (id) on delete restrict,
  evaluator_id uuid not null references public.members (id) on delete restrict,
  stage public.candidate_stage not null, -- denormalized for RLS/query
  value integer not null, -- K1: integer 1–5; range vs criterion enforced at API layer
  unique (candidate_id, rubric_criterion_id, evaluator_id)
);

create index scores_evaluator_id_idx on public.scores (evaluator_id);
create index scores_candidate_stage_idx on public.scores (candidate_id, stage);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz, -- D2: single soft-delete column
  candidate_id uuid not null references public.candidates (id) on delete cascade,
  author_id uuid not null references public.members (id) on delete restrict,
  stage public.candidate_stage not null, -- required for blind gate
  body text not null check (length(body) > 0)
);

create index notes_author_id_idx on public.notes (author_id);
create index notes_candidate_stage_live_idx on public.notes (candidate_id, stage) where deleted_at is null;

create table public.reactions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  candidate_id uuid not null references public.candidates (id) on delete cascade,
  evaluator_id uuid not null references public.members (id) on delete restrict,
  stage public.candidate_stage not null,
  value public.reaction_value not null,
  unique (candidate_id, evaluator_id, stage)
);

create index reactions_evaluator_id_idx on public.reactions (evaluator_id);

create table public.coi_flags (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  candidate_id uuid not null references public.candidates (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  description text,
  is_excluded_from_agg boolean not null default false, -- board-only write
  unique (candidate_id, member_id)
);

create index coi_flags_member_id_idx on public.coi_flags (member_id);

-- M2: NULL candidate_id = stage-wide assignment; non-NULL = candidate-specific.
create table public.evaluator_assignments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  cycle_id uuid not null references public.recruitment_cycles (id) on delete cascade,
  stage public.candidate_stage not null,
  evaluator_id uuid not null references public.members (id) on delete cascade,
  candidate_id uuid references public.candidates (id) on delete cascade,
  unique nulls not distinct (cycle_id, stage, evaluator_id, candidate_id)
);

create index evaluator_assignments_lookup_idx on public.evaluator_assignments (cycle_id, stage, evaluator_id);

-- M7: append-only funnel audit.
create table public.stage_transitions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  candidate_id uuid not null references public.candidates (id) on delete cascade,
  from_stage public.candidate_stage, -- NULL for initial assignment
  to_stage public.candidate_stage not null,
  actor_id uuid not null references public.members (id) on delete restrict,
  reason text
);

create index stage_transitions_candidate_idx on public.stage_transitions (candidate_id);
;
