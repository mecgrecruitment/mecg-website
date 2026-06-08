# MEMORY

Decision log for the MECG website. Read at the start of every session; never contradict a logged decision without flagging it first.

## 2026-06-08 — Project setup
What: Initialized the repo, connected it to `github.com/amanigupta27/mecg-website`, and added Claude Code config (CLAUDE.md, .gitignore, README, LICENSE).
Why: Bootstrap the project so work can begin with git history and consistent conventions in place.
Rejected: Scaffolding a full Next.js app now — chose git + config only so the stack/structure can be set deliberately. Creating a personal fork of the repo — chose to push to the existing amanigupta27 repo.

## 2026-06-08 — PRD finalized (docs/PRD.md)
What: Produced the board-ready v1.0 PRD (`docs/PRD.md`, ~1,450 lines) for the MECG Digital Platform — public art-directed site + gated internal recruitment ATS — via a multi-agent /workflow (7 domain specialists + adversarial critic), then a reconciliation+synthesis pass. Owner draft kept at `docs/PRD-draft-source.md`.
Why: Owner asked for a complete, self-consistent PRD. Parallel enrichment produced 18 cross-domain contradictions + 13 gaps; all resolved via authoritative reconciliation decisions (Appendix C in the PRD).
Decisions locked (owner via popup): deliverable = PRD doc only; general members CAN view open-rush candidate roster (names/basic info, no scores/notes/hash); hash votes ANONYMOUS by default (per-session flip); native `/apply` intake.
Key reconciliations (canonical, do not contradict): identity via `current_member_id()`/`current_member_role()` security-definer helpers (`members.id` PK ≠ `auth.uid()`, linked by `members.user_id`); blind-until-submitted via append-only `score_submissions` table (no `scores.status`); per-cycle candidate uniqueness `(cycle_id, lower(email))`; `decisions` append-only (`accepted|rejected|waitlisted`); resume PDF-only ≤10MB via server-mediated service-role Route Handler (no anon writes); ink focus ring default (maize only on dark bg); sample stddev (n−1) normalization; integer 1–5 scores; derived values in views not base columns; new tables recruitment_cycles, evaluator_assignments, hash_session_participants, placement_features, application_questions, stage_transitions + members.placement_consent.
Still OPEN (OQ): U-M/CoE brand+logo constraints; client-logo display permission; real rubric criteria/weights (from club Google Docs); applicant confirmation email (external send = hard stop).
Next session: confirm open OQs with MECG; then Phase 0 scaffold (Next.js + Supabase + Tailwind tokens + RLS baseline).
