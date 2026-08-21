-- Phase 0 · Migration 7: row-level security (PRD §11.4, ATS-1 default-deny)
-- Every table gets RLS enabled. No anon policies exist on any base table —
-- anon's only surfaces are v_team_public / v_placement_public (migration 6),
-- and the only public write path is the service-role /apply Route Handler
-- (Track B2). Helpers are wrapped in (select …) for the init-plan pattern.

-- Hardening: anon gets no base-table privileges at all. The blanket revoke
-- also catches views, so the two intentionally-public surfaces are re-granted.
revoke all on all tables in schema public from anon;
grant select on public.v_team_public to anon;
grant select on public.v_placement_public to anon;

alter table public.members enable row level security;
alter table public.invite_allowlist enable row level security;
alter table public.recruitment_cycles enable row level security;
alter table public.candidates enable row level security;
alter table public.application_questions enable row level security;
alter table public.application_responses enable row level security;
alter table public.apply_rate_limit enable row level security;
alter table public.rubric_versions enable row level security;
alter table public.rubric_criteria enable row level security;
alter table public.score_submissions enable row level security;
alter table public.scores enable row level security;
alter table public.notes enable row level security;
alter table public.reactions enable row level security;
alter table public.coi_flags enable row level security;
alter table public.evaluator_assignments enable row level security;
alter table public.stage_transitions enable row level security;
alter table public.hash_sessions enable row level security;
alter table public.hash_session_participants enable row level security;
alter table public.votes enable row level security;
alter table public.decisions enable row level security;
alter table public.audit_log enable row level security;
alter table public.placement_features enable row level security;

-- J: general members must never read the candidates base table. The REVOKE
-- runs before policies per the PRD; the re-GRANT is required because Postgres
-- privileges are per-role (committee members also connect as `authenticated`)
-- — the RLS SELECT policy below is what actually keeps general members out.
revoke select on public.candidates from authenticated;
grant select on public.candidates to authenticated;

-- ── members ──────────────────────────────────────────────────────────────────
create policy members_select on public.members for select to authenticated
  using (
    (select public.is_committee_or_above())
    or id = (select public.current_member_id())
    or is_public
  );

-- Post-signup creation happens via SECURITY DEFINER trigger (bypasses RLS);
-- this policy covers board manual adds only.
create policy members_insert on public.members for insert to authenticated
  with check ((select public.is_board()));

-- Role changes are frozen by trg_members_role_freeze (RLS cannot see OLD).
create policy members_update on public.members for update to authenticated
  using ((select public.is_board()) or id = (select public.current_member_id()))
  with check ((select public.is_board()) or id = (select public.current_member_id()));

create policy members_delete on public.members for delete to authenticated
  using ((select public.is_board()));

-- ── invite_allowlist (board-only, all ops) ───────────────────────────────────
create policy invite_allowlist_all on public.invite_allowlist for all to authenticated
  using ((select public.is_board()))
  with check ((select public.is_board()));

-- ── recruitment_cycles ───────────────────────────────────────────────────────
create policy recruitment_cycles_select on public.recruitment_cycles for select to authenticated
  using ((select public.is_member_or_above()));

create policy recruitment_cycles_insert on public.recruitment_cycles for insert to authenticated
  with check ((select public.is_board()));

create policy recruitment_cycles_update on public.recruitment_cycles for update to authenticated
  using ((select public.is_board()))
  with check ((select public.is_board()));

create policy recruitment_cycles_delete on public.recruitment_cycles for delete to authenticated
  using ((select public.is_board()));

-- ── candidates (committee+ only; general members use v_candidate_roster) ────
create policy candidates_select on public.candidates for select to authenticated
  using ((select public.is_committee_or_above()));

-- Public intake is server-mediated (service_role); board may add manually.
create policy candidates_insert on public.candidates for insert to authenticated
  with check ((select public.is_board()));

-- Phase 0: committee+ may update (stage/status moves); column-level limits are Track B3.
create policy candidates_update on public.candidates for update to authenticated
  using ((select public.is_committee_or_above()))
  with check ((select public.is_committee_or_above()));

create policy candidates_delete on public.candidates for delete to authenticated
  using ((select public.is_board()));

-- ── application_questions ────────────────────────────────────────────────────
-- The public /apply form reads these via the service-role Route Handler.
create policy application_questions_select on public.application_questions for select to authenticated
  using ((select public.is_committee_or_above()));

create policy application_questions_insert on public.application_questions for insert to authenticated
  with check ((select public.is_board()));

create policy application_questions_update on public.application_questions for update to authenticated
  using ((select public.is_board()))
  with check ((select public.is_board()));

create policy application_questions_delete on public.application_questions for delete to authenticated
  using ((select public.is_board()));

-- ── application_responses (append-only; INSERT via service role only) ───────
create policy application_responses_select on public.application_responses for select to authenticated
  using ((select public.is_committee_or_above()));

-- ── apply_rate_limit: service-role only — RLS enabled, no policies. ─────────

-- ── rubric_versions / rubric_criteria ────────────────────────────────────────
create policy rubric_versions_select on public.rubric_versions for select to authenticated
  using ((select public.is_committee_or_above()));

create policy rubric_versions_insert on public.rubric_versions for insert to authenticated
  with check ((select public.is_board()));

create policy rubric_versions_update on public.rubric_versions for update to authenticated
  using ((select public.is_board()))
  with check ((select public.is_board()));

create policy rubric_criteria_select on public.rubric_criteria for select to authenticated
  using ((select public.is_committee_or_above()));

create policy rubric_criteria_insert on public.rubric_criteria for insert to authenticated
  with check ((select public.is_board()));

create policy rubric_criteria_update on public.rubric_criteria for update to authenticated
  using ((select public.is_board()))
  with check ((select public.is_board()));

-- ── score_submissions (the blind trigger; append-only) ──────────────────────
create policy score_submissions_select on public.score_submissions for select to authenticated
  using (
    (select public.is_board())
    or evaluator_id = (select public.current_member_id())
  );

create policy score_submissions_insert on public.score_submissions for insert to authenticated
  with check (
    (select public.is_committee_or_above())
    and evaluator_id = (select public.current_member_id())
  );

-- ── scores (blind-until-submitted; DM-29) ────────────────────────────────────
create policy scores_select on public.scores for select to authenticated
  using (
    (select public.is_committee_or_above())
    and (
      evaluator_id = (select public.current_member_id())
      or (select public.is_board())
      or public.has_submitted_for(candidate_id, stage)
    )
  );

create policy scores_insert on public.scores for insert to authenticated
  with check (
    (select public.is_committee_or_above())
    and evaluator_id = (select public.current_member_id())
  );

-- Editable until stage lock (D1, enforced by trg_scores_stage_lock).
create policy scores_update on public.scores for update to authenticated
  using (
    (select public.is_board())
    or evaluator_id = (select public.current_member_id())
  )
  with check (
    (select public.is_board())
    or evaluator_id = (select public.current_member_id())
  );

-- ── notes (soft-delete via deleted_at; blind rule) ───────────────────────────
create policy notes_select on public.notes for select to authenticated
  using (
    (select public.is_board())
    or (
      (select public.is_committee_or_above())
      and deleted_at is null
      and (
        author_id = (select public.current_member_id())
        or public.has_submitted_for(candidate_id, stage)
      )
    )
  );

create policy notes_insert on public.notes for insert to authenticated
  with check (
    (select public.is_committee_or_above())
    and author_id = (select public.current_member_id())
  );

create policy notes_update on public.notes for update to authenticated
  using (
    (select public.is_board())
    or author_id = (select public.current_member_id())
  )
  with check (
    (select public.is_board())
    or author_id = (select public.current_member_id())
  );

-- ── reactions (blind rule; editable until lock) ─────────────────────────────
create policy reactions_select on public.reactions for select to authenticated
  using (
    (select public.is_board())
    or (
      (select public.is_committee_or_above())
      and (
        evaluator_id = (select public.current_member_id())
        or public.has_submitted_for(candidate_id, stage)
      )
    )
  );

create policy reactions_insert on public.reactions for insert to authenticated
  with check (
    (select public.is_committee_or_above())
    and evaluator_id = (select public.current_member_id())
  );

create policy reactions_update on public.reactions for update to authenticated
  using (
    (select public.is_board())
    or evaluator_id = (select public.current_member_id())
  )
  with check (
    (select public.is_board())
    or evaluator_id = (select public.current_member_id())
  );

-- ── coi_flags ────────────────────────────────────────────────────────────────
create policy coi_flags_select on public.coi_flags for select to authenticated
  using (
    (select public.is_board())
    or member_id = (select public.current_member_id())
  );

create policy coi_flags_insert on public.coi_flags for insert to authenticated
  with check (
    (select public.is_board())
    or (
      (select public.is_committee_or_above())
      and member_id = (select public.current_member_id())
    )
  );

-- Board-only toggle of is_excluded_from_agg.
create policy coi_flags_update on public.coi_flags for update to authenticated
  using ((select public.is_board()))
  with check ((select public.is_board()));

-- ── evaluator_assignments ────────────────────────────────────────────────────
create policy evaluator_assignments_select on public.evaluator_assignments for select to authenticated
  using (
    (select public.is_board())
    or evaluator_id = (select public.current_member_id())
  );

create policy evaluator_assignments_insert on public.evaluator_assignments for insert to authenticated
  with check ((select public.is_board()));

create policy evaluator_assignments_update on public.evaluator_assignments for update to authenticated
  using ((select public.is_board()))
  with check ((select public.is_board()));

create policy evaluator_assignments_delete on public.evaluator_assignments for delete to authenticated
  using ((select public.is_board()));

-- ── stage_transitions (append-only) ──────────────────────────────────────────
create policy stage_transitions_select on public.stage_transitions for select to authenticated
  using ((select public.is_committee_or_above()));

create policy stage_transitions_insert on public.stage_transitions for insert to authenticated
  with check (
    (select public.is_committee_or_above())
    and actor_id = (select public.current_member_id())
  );

-- ── hash_sessions (I1: committee sees active only; board controls) ──────────
create policy hash_sessions_select on public.hash_sessions for select to authenticated
  using (
    (select public.is_board())
    or ((select public.is_committee_or_above()) and is_active)
  );

create policy hash_sessions_insert on public.hash_sessions for insert to authenticated
  with check ((select public.is_board()));

create policy hash_sessions_update on public.hash_sessions for update to authenticated
  using ((select public.is_board()))
  with check ((select public.is_board()));

-- ── hash_session_participants ────────────────────────────────────────────────
create policy hash_session_participants_select on public.hash_session_participants for select to authenticated
  using ((select public.is_committee_or_above()));

create policy hash_session_participants_insert on public.hash_session_participants for insert to authenticated
  with check ((select public.is_board()));

create policy hash_session_participants_delete on public.hash_session_participants for delete to authenticated
  using ((select public.is_board()));

-- ── votes (I2: append-only; anonymous mode conceals voter_id) ────────────────
create policy votes_select on public.votes for select to authenticated
  using (
    (select public.is_board())
    or (
      (select public.is_committee_or_above())
      and (
        voter_id = (select public.current_member_id())
        or public.session_is_open(session_id)
      )
    )
  );

create policy votes_insert on public.votes for insert to authenticated
  with check (
    (select public.is_committee_or_above())
    and voter_id = (select public.current_member_id())
    and public.session_is_active(session_id)
    and exists (
      select 1 from public.hash_session_participants p
      where p.session_id = votes.session_id
        and p.member_id = (select public.current_member_id())
    )
  );

-- ── decisions (E1: append-only, board INSERT, no UPDATE policy ever) ─────────
create policy decisions_select on public.decisions for select to authenticated
  using ((select public.is_committee_or_above()));

create policy decisions_insert on public.decisions for insert to authenticated
  with check ((select public.is_board()));

-- ── audit_log (board SELECT only; INSERT via SECURITY DEFINER fn_audit) ─────
create policy audit_log_select on public.audit_log for select to authenticated
  using ((select public.is_board()));

-- ── placement_features (board curates; public surface is v_placement_public) ─
create policy placement_features_select on public.placement_features for select to authenticated
  using ((select public.is_member_or_above()));

create policy placement_features_insert on public.placement_features for insert to authenticated
  with check ((select public.is_board()));

create policy placement_features_update on public.placement_features for update to authenticated
  using ((select public.is_board()))
  with check ((select public.is_board()));

create policy placement_features_delete on public.placement_features for delete to authenticated
  using ((select public.is_board()));
;
