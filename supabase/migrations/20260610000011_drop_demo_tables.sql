-- ─────────────────────────────────────────────────────────────────────────────
-- Retire the demo_* layer.
--
-- The demo tables were never created by a migration — they only ever existed on
-- the old hosted database, which is why the portal pages errored against a fresh
-- schema. Now that every page reads/writes the real migration-backed schema
-- (members, candidates, score_submissions, scores, hash_sessions, votes,
-- decisions, recruitment_events, event_checkins, membership_requests, …), these
-- tables have no readers or writers left.
--
-- `if exists` makes this a clean no-op on a fresh local stack and real cleanup on
-- the hosted environment where the tables still linger.
-- ─────────────────────────────────────────────────────────────────────────────

drop table if exists public.demo_candidate_scores cascade;
drop table if exists public.demo_hash_votes cascade;
drop table if exists public.demo_scoring_assignments cascade;
drop table if exists public.demo_scores cascade;
drop table if exists public.demo_checkins cascade;
drop table if exists public.demo_events cascade;
drop table if exists public.demo_applications cascade;
drop table if exists public.demo_applicant_accounts cascade;
drop table if exists public.demo_internal_accounts cascade;
