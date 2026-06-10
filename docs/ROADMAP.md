# MECG Digital Platform — Build Roadmap (Fable-ready)

<!-- Created 2026-06-10. Companion to docs/PRD.md (the spec). This is the EXECUTION plan. -->
<!-- Global rules in ~/.claude/CLAUDE.md apply. Hard stops (external email send, migrations on prod, deploys) require explicit in-session confirmation. -->

> **How to read this:** `docs/PRD.md` is the source of truth for *what* and *why* (data model §10, RLS §11, design system §7, page specs §8–9). This roadmap is *how* and *in what order*, grounded in the current half-built repo. Every phase cites the PRD section it implements. Do **not** re-spec — build to the PRD; flag contradictions instead of inventing.

## Locked decisions (this push)

1. **Two parallel tracks:** A = External design elevation, B = Internal ATS backend.
2. **Design direction:** elevate the existing dark-navy + maize editorial aesthetic to award-tier (motion choreography, scroll scenes, kinetic type, canvas/WebGL accents, micro-interactions). No new art direction.
3. **Hard deadline:** internal ATS production-ready by **late Aug / early Sep 2026** (~12 weeks from 2026-06-10). The backend is the long pole.
4. **Alumni/internship content:** members **self-submit** profiles in the portal (Track B7); those opt-in profiles feed the public placement/alumni surface (Track A5). Build the member-profile schema once, consume it on both sides.

---

## ⚠️ Phase 0 — Foundation & drift reconciliation (Week 1, BLOCKS both tracks)

Nothing else should be built on top of the current backend until this is done, or rework compounds.

### 0.1 Resolve the schema drift (decision, then code)
- **Problem:** `src/app/auth/actions.ts` queries `profiles.role` (a quick hack from the "connected to supabase" commit). The PRD's canonical model (§10.2, §11.3) is `members` (PK `members.id` ≠ `auth.uid()`, linked via `members.user_id`) plus security-definer helpers `current_member_id()` / `current_member_role()`.
- **Decision:** adopt the PRD model. It's RLS-correct and already reconciled across 18 contradictions (PRD Appendix C). Discard `profiles.role`.
- **Action:** refactor `auth/actions.ts` and `src/middleware.ts` to resolve role via the helper functions, not a `profiles` lookup. Two identity types coexist: **members** (internal) and **applicants/candidates** (external `/apply/dashboard` login, gated per §11.2).

### 0.2 Stand up the migration workflow
- Create `supabase/` with `supabase/migrations/`. Adopt CLI-based migrations (PRD §12 tech stack). No more ad-hoc dashboard edits.
- Wire Supabase typegen → a generated `database.types.ts`; replace hand-written shapes over time.

### 0.3 Build the canonical schema (PRD §10 in full) — START DAY 1, it's the long pole
- Enums (§10.1), all tables (§10.2): `members`, `recruitment_cycles`, `candidates`, `application_questions`, `score_submissions` (append-only), `decisions` (append-only), `notes`, `reactions`, `evaluator_assignments`, `hash_session_participants`, `placement_features`, `stage_transitions`, COI fields, `members.placement_consent`.
- Derived views, NOT base columns (§10.3, reconciliation I4). Rubric versioning (§10.4). Blind-until-submitted enforcement (§10.5). RLS indexing (§10.6).
- Security-definer helpers (§11.3) + full RLS policy matrix (§11.4) + storage bucket policies for resumes (§11.7).
- Seed: the 10 board members from `src/lib/internal-data.ts` / `site-content.ts` with correct roles.

### 0.4 Design foundation (shared by Track A; also fixes PRD §7 violations)
- **Fonts:** kill the render-blocking `@import` in `globals.css:1`; move to `next/font` per the §7.2 font-loading contract (Space Grotesk display / Manrope text, or the PRD's canonical faces if different — check §7.2).
- **Tokens:** promote the `:root` vars to the full §7.10 token set (spacing, grid, radii, borders — §7.5).
- **Reduced motion:** add the §7.7 `prefers-reduced-motion` mapping. Currently absent — every `reveal`/`spin` animation ignores it. This is an accessibility blocker (§13.1).

**Phase 0 exit criteria:** migrations apply cleanly to a fresh DB; auth resolves real roles via helpers; one internal page reads one real table (not `internal-data.ts`); fonts load via `next/font`; reduced-motion respected.

---

## Track A — External design elevation (Weeks 2–9)

Goal: take the public site from "good" to awwwards-submittable, keeping the dark/maize identity. Implements PRD §7 (art direction) + §8 (pages) + §13 (perf/a11y).

- **A1 — Motion system.** Replace fire-on-load `reveal`/`reveal-2`/`reveal-3` (they all trigger on mount, not on view) with scroll-triggered, Lenis-synced reveals via IntersectionObserver or a motion lib. Build the §7.7 motion inventory ("the 80%"). All effects reduced-motion safe.
- **A2 — Hero & signature moments.** Kinetic/variable-weight display type, a canvas/WebGL accent (the gear logo as a shader/3D motif is the obvious brand hook), magnetic CTAs, optional custom cursor. One memorable "scene," not effects everywhere.
- **A3 — Per-page art direction.** Polish in recruiting-value order: **Placement / "Where We Work" (§8.2 — highest recruiting value)** → Home (§8.1) → **Trek (§8.3, make it a scroll-told story)** → Team (§8.4) → Recruitment (§8.5) → Services (§8.6) → About (§8.7) → Contact (§8.8).
- **A4 — Page transitions & imagery.** View Transitions API (or framer-motion) between routes; real asset/image pipeline (`next/image`, art-directed crops).
- **A5 — Alumni / internship surface (NEW; depends on B7).** Public page: "where our members intern/work" + internship-story highlights. Reads opt-in `placement_features` from member self-submitted profiles (§9.9 → §8.2). Gate strictly on `members.placement_consent`. Coordinate the field shape with B7 — design once.
- **A6 — Perf & a11y hardening.** Hit PRD §13.2 (Lighthouse/CWV) and §13.1 (WCAG 2.2 AA). Turnstile on `/apply` (keys already in `.env.example`).

---

## Track B — Internal ATS (Weeks 2–10) — the hard deadline

Goal: a recruitment committee can run the **full Fall 2026 cycle** end-to-end on this. Implements PRD §9 + §11.

- **B1 — Auth, roles, gating.** member / recruitment / board (§9.1, §11.1). Signup gating (§11.2). Real route protection in `src/app/(internal)/layout.tsx` (middleware currently only refreshes the session — it does **not** gate `/internal`).
- **B2 — Application intake (`/apply`).** The ONLY public write path (§11.6). Turnstile, resume upload (PDF ≤10MB via service-role Route Handler — no anon storage writes, §11.7), per-cycle uniqueness `(cycle_id, lower(email))`. Drives the applicant `/apply/dashboard`.
- **B3 — Candidate roster + profile aggregation (§9.8).** Plus the general-member read surface (§11.8): members see the open-rush roster (names/basic info), never scores/notes/hash.
- **B4 — Stage scoring.** Configurable weighted rubrics (§9.2). **Blind-until-submitted** via append-only `score_submissions` (§9.3, §10.5) — the bias-mitigation crown jewel. Integer 1–5 scores; z-score-per-evaluator-within-stage normalization (§9.6, sample stddev n−1). Covers Application, Speed Dating, Group Case, Interview.
  - **INPUT NEEDED:** real rubric criteria + weights live in the club's Google Docs (PRD open question). Get those converted before building rubric config, or build against `rubricCriteria` placeholders in `internal-data.ts` and swap later.
- **B5 — Notes, reactions, COI.** Notes on candidate profiles (§9.5). Conviction reactions = like/dislike/discuss (§9.4). Conflict-of-interest flags (§9.7).
- **B6 — Hash mode.** Live deliberation, **anonymous votes by default** (per-session flip), board-only (§9.10). Backs `/internal/hash/[id]`.
- **B7 — Member self-profiles (§9.9).** Members edit their own profile; opt-in `placement_consent` exposes selected fields to Track A5. **Shared dependency with A5 — single schema, two consumers.**
- **B8 — Audit, decisions, admin config.** Append-only audit trail (§9.12). Decisions: accepted / rejected / waitlisted (append-only). Board-set per-cycle parameters (§9.14).

---

## Phase Final — Integration & launch (Weeks 10–12)

- Seed real content (board, clients, trek, rubrics from the Google Docs).
- **Dry-run a full recruitment cycle** with synthetic candidates: apply → score (blind) → reveal → notes/reactions → hash → decision. This is the real acceptance test.
- Perf/a11y/security audit against PRD §13 + §11.9 threat model.
- Deploy to Vercel + custom domain. **(Deploy = hard stop; needs explicit go-ahead.)**

---

## Cross-cutting risks & flags

| Risk | Mitigation |
|---|---|
| **Backend is the long pole** | Phase 0.3 starts day 1, runs through Track B. Don't let external polish starve it. |
| **Schema drift (`profiles` vs `members`)** | Resolve in Phase 0.1 before any more backend code, or rework compounds. |
| **A5 ↔ B7 shared model** | Design member-profile / `placement_features` schema once; both tracks consume it. |
| **Real rubric criteria/weights** | Locked in club Google Docs (PRD OQ). User to provide → convert. Blocks B4 config polish. |
| **Applicant confirmation email** | External send = **HARD STOP** (global rules). Stub the trigger; do not wire a real send without explicit per-session approval. |
| **U-M / CoE brand + client-logo permission** | PRD open questions. Confirm before public launch; use placeholders meanwhile. |

## Open inputs needed from MECG (gate the build)
1. The recruitment-scoring Google Docs → real rubric criteria + weights (blocks B4).
2. Trek content/photos for the §8.3 scroll-story (Track A3).
3. U-M brand constraints + permission to display client logos.
4. Confirmation of recruitment open date (anchors the Week-10 deadline).
