-- Retire the abandoned Phase-0 "public" schema. The app has run
-- entirely on rush.* since 20260821090000_rush_foundation.sql (every
-- Supabase client is pinned to schema: "rush"; there are no .from()
-- calls anywhere in the app). Nothing in rush references public except
-- rush.create_cycle's cold-start check, which only fires when
-- rush.rush_cycles is empty, and it no longer is.
--
-- Two triggers on auth.users were still firing on every signup
-- (trg_auth_users_signup_gate, trg_auth_users_create_member). Both are
-- effectively no-ops today: the signup gate is a straight passthrough,
-- and the member handler only writes into these now-dead tables when
-- an email matches public.invite_allowlist (0 rows). Dropping the
-- functions with cascade removes those triggers along with 24 tables,
-- 9 views (7 of which the security advisor flags as security_definer
-- views, its highest-severity finding), and 23 functions.
--
-- Abort guard: rush.create_cycle's cold-start branch (application_intake.sql)
-- only takes the public.members path when rush.rush_cycles is empty. Verified
-- empty on 2026-08-25 (1 row) but that's a point-in-time fact, not an
-- invariant -- a DR restore or staging reset could hit this migration against
-- a database where it's empty again. Fail loudly instead of silently
-- breaking cold-start bootstrap.
do $$
begin
  if not exists (select 1 from rush.rush_cycles) then
    raise exception 'abort: rush.rush_cycles is empty; rush.create_cycle''s cold-start branch depends on public.members, which this migration drops. Populate rush.rush_cycles or update create_cycle before proceeding.';
  end if;
end $$;
drop view if exists public.v_candidate_controversy cascade;
drop view if exists public.v_candidate_roster cascade;
drop view if exists public.v_open_rush_events cascade;
drop view if exists public.v_placement_public cascade;
drop view if exists public.v_score_composite cascade;
drop view if exists public.v_score_composite_internal cascade;
drop view if exists public.v_score_normalized cascade;
drop view if exists public.v_team_public cascade;
drop view if exists public.vote_counts cascade;
drop table if exists public.application_questions cascade;
drop table if exists public.application_responses cascade;
drop table if exists public.apply_rate_limit cascade;
drop table if exists public.audit_log cascade;
drop table if exists public.candidates cascade;
drop table if exists public.coi_flags cascade;
drop table if exists public.decisions cascade;
drop table if exists public.evaluator_assignments cascade;
drop table if exists public.event_checkins cascade;
drop table if exists public.hash_session_participants cascade;
drop table if exists public.hash_sessions cascade;
drop table if exists public.invite_allowlist cascade;
drop table if exists public.members cascade;
drop table if exists public.membership_requests cascade;
drop table if exists public.notes cascade;
drop table if exists public.placement_features cascade;
drop table if exists public.reactions cascade;
drop table if exists public.recruitment_cycles cascade;
drop table if exists public.recruitment_events cascade;
drop table if exists public.rubric_criteria cascade;
drop table if exists public.rubric_versions cascade;
drop table if exists public.score_submissions cascade;
drop table if exists public.scores cascade;
drop table if exists public.stage_transitions cascade;
drop table if exists public.votes cascade;
drop function if exists public.check_in_by_phrase cascade;
drop function if exists public.current_member_id cascade;
drop function if exists public.current_member_role cascade;
drop function if exists public.fn_assign_per_cycle_seq cascade;
drop function if exists public.fn_audit cascade;
drop function if exists public.fn_deny_mutation cascade;
drop function if exists public.fn_enforce_signup_gate cascade;
drop function if exists public.fn_enforce_stage_lock cascade;
drop function if exists public.fn_freeze_member_role cascade;
drop function if exists public.fn_handle_new_auth_user cascade;
drop function if exists public.fn_refresh_evaluator_stage_stats cascade;
drop function if exists public.fn_set_updated_at cascade;
drop function if exists public.has_submitted_for cascade;
drop function if exists public.is_board cascade;
drop function if exists public.is_committee_or_above cascade;
drop function if exists public.is_member_or_above cascade;
drop function if exists public.my_application cascade;
drop function if exists public.my_checkins cascade;
drop function if exists public.prune_apply_rate_limit cascade;
drop function if exists public.request_membership cascade;
drop function if exists public.session_is_active cascade;
drop function if exists public.session_is_open cascade;
drop function if exists public.submit_application cascade;
