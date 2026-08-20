# MEMORY

Decision log for the MECG website. Read at the start of every session; never contradict a logged decision without flagging it first.

## Hard stops (open — do not bypass)

These are standing owner constraints. Agents must flag and stop, not improvise around them:

1. **Production Supabase push** — local-first; do not `supabase db push` / apply migrations to hosted/prod without an explicit owner request.
2. **Trek content** — `/trek` stays an honest "in drafting" surface; do not invent itinerary, dates, or photos.
3. **Outbound email** — applicant confirmation / transactional send is an external hard stop; do not wire a real ESP or spam club inboxes from local/dev.
4. **Package manager** — npm + `package-lock.json` only (no Bun/pnpm/yarn migration).
5. **Art direction** — elevate the locked aesthetic; do not start a new brand system.

## 2026-08-20 — Applicant portal friction cut (apply/check-in)
What: Mapped create→apply→submit→dashboard→check-in; removed fake progress strip; keep check-in after submit; resume PDF/10MB Zod+client UX; dynamic cycle questions via admin read; human stage/status from `my_application`; next-step check-in errors; surfaced Auth email + post-apply receipt gaps. Turnstile/RLS untouched. typecheck green. No commit.
Why: Cut apply/check-in friction without inventing backend behavior.
Rejected: Wiring applicant confirmation email (hard stop); inventing stage timelines beyond DB enums.

## 2026-08-20 — DevX daily-loop hardening
What: Mapped scripts; added `seed:users`, `db:test`/`test:rls` (SQL runner via **docker exec psql** — `supabase db query` rejects `\set`), `test:role-smoke` (signed-out redirect curl), `verify`; strengthened `check-env.mjs` (CI/process mode, reject localhost URLs, Turnstile pair + refuse public service-role); CI fails on env contract + optional e2e when `E2E_BASE_URL` secret set; Playwright covers `/placement`, canonical aliases, all protected redirect prefixes, signup gated behind `E2E_ALLOW_SIGNUP`/`E2E_BASE_URL`; README 10-minute setup + seed table + 127.0.0.1 callout. Verified: `npm run db:test` → 5/5 PASS on seeded local DB.
Why: Make the daily loop boring and reliable; cut agent friction on env/auth/RLS discovery.
Rejected: Bun migration; committing secrets; inventing trek/email/prod push.

## 2026-08-20 — Production readiness checklist (prep only)
What: Added `docs/LAUNCH-CHECKLIST.md` (Owner/Eng + blocked-on), aligned `.env.example` + `scripts/check-env.mjs` with real required keys and Turnstile pair-on/off rule, README link + Turnstile half-config note, `.gitignore` `!.env.example`. Did not run remote `db push`; did not invent email provider (gap documented).
Why: Remove launch friction without violating hard stops.
Rejected: remote migration apply; wiring Resend/Postmark/etc.

## 2026-08-20 — Codebase audit + unslop + QoL pass
What: Audited against `/Users/rbhavan/projects/mecg-website` (Documents/mecgwebsite was empty). Applied grant_membership_by_email migration, env guards (`src/lib/env.ts`), Zod on internal/checkin FormData actions, portal→/auth/login, calendar→events redirect, homepage/trek/site-content unslop, CI workflow, check-env script, e2e hero/canonical route updates. Verified: lint/typecheck/build green; board login to /internal + members grant UI; public routes 200; protected routes 307→login.
Why: Full-repo quality pass with computer-use proof and decision trail under `.audit/` (gitignored).
Rejected: Bun (repo is npm-lockfile); new art direction; production Supabase push; inventing Trek itinerary.

## 2026-06-10 — Track A2–A3 executed: "Precision Blueprint" redesign with 3D (✅ build green, all routes QA'd)
What: Full external-site redesign on top of the A1 motion foundation, concept "Precision Blueprint" (site as a living engineering drawing). (1) 3D: three 0.184 + R3F 9.6 + drei 10.7; procedural gear geometry (`src/components/three/gearGeometry.ts`), hero scene = 12-tooth logo gear driving a solid pinion + a wireframe "drawn" ring gear (`GearAssembly.tsx`), scroll advances the drivetrain, pointer tilts it; perf-guarded canvas (`GearCanvas.tsx`: dpr≤1.75, IO+visibility pause, RM static pose) mounted via client-side ssr:false wrapper (`HeroGears.tsx`). (2) MotionProvider v2: SplitText masked line reveals ([data-split], free since GSAP 3.13), [data-parallax], [data-counter] roll-ups, [data-magnetic] CTAs, drafting cursor (dot+ring, fine-pointer only), scroll-HUD gear ([data-hud-gear]); existing [data-reveal] API kept; all inside gsap.matchMedia RM guard. (3) Design system additions in globals.css: film grain (.grain), .annotation/.dim-rule drafting voice, .display-xl (11.5vw), .text-ghost stroke type (opacity 0.4 — 0.22 was illegible over canvas), paper "sheet" tokens (--paper/--on-paper) for inverted sections, marquee, cursor + HUD CSS, all RM-safe. (4) Layout: fixed scroll-aware SiteHeader (client) with mono-numbered nav + full-screen mobile menu; footer = CTA band + link grid + engineering title block + ghost MECG wordmark. (5) All external pages rebuilt to the system (home w/ 3D hero + client marquee + sheet sections; about/services/team/recruitment/placement/contact; trek = designed "in drafting" page since content is still an open input). /apply flow untouched (Turnstile+schema contract preserved); contact form still plain mailto.
Why: /goal directive "complete redesign, world-class, 3D, awwwards-tier" executed as Track A elevation per the locked no-new-art-direction decision. Verified: tsc clean, `npm run build` green, Playwright screenshots of 9 routes × 2 viewports × 3 scroll states, zero console errors.
Rejected: new typefaces (locked: Space Grotesk/Manrope/Space Mono); drei Environment HDRIs (network dep — lights only); View Transitions config flag (deferred, avoid config churn); inventing trek content (open input from club). Note: web-research workflow agents died on a session limit mid-run (only the repo inventory agent succeeded); design direction came from the frontend-design skill + model knowledge. Next 16 gotchas confirmed from bundled docs: ssr:false only in client components, params/searchParams are Promises, middleware→proxy.ts already done.

## 2026-06-08 — Project setup
What: Initialized the repo, connected it to `github.com/amanigupta27/mecg-website`, and added Claude Code config (CLAUDE.md, .gitignore, README, LICENSE).
Why: Bootstrap the project so work can begin with git history and consistent conventions in place.
Rejected: Scaffolding a full Next.js app now — chose git + config only so the stack/structure can be set deliberately. Creating a personal fork of the repo — chose to push to the existing amanigupta27 repo.

## 2026-06-10 — Phase 0 executed (schema, auth, design foundation) ✅
What: Full Phase 0 of docs/ROADMAP.md built and verified. (1) `supabase/` with 8 migrations implementing PRD §10–§11 verbatim: all enums, ~22 tables, security-definer helpers (`current_member_id`/`current_member_role`/`is_board`/`has_submitted_for`/…), append-only triggers, per-cycle-seq, signup gating on auth.users (@umich.edu + invite_allowlist), audit triggers, derived views (incl. `mv_evaluator_stage_stats` + blind-gated `v_score_*`), full default-deny RLS matrix, storage buckets. (2) Local-only Supabase via colima + CLI (installed this session); `supabase db reset` applies cleanly + idempotently; seed creates 12 auth users (10 board PLACEHOLDER emails per CON-8 + committee.test/member.test, password123) through the real signup triggers. (3) `profiles` drift killed: `auth/actions.ts` uses `rpc("current_member_role")`, internal layout gates on a `members` row; `middleware.ts` → `proxy.ts` (Next 16 rename) with optimistic /internal bounce. (4) Typed clients via generated `src/lib/database.types.ts` (`npm run db:types`). (5) Design foundation: Google-Fonts `@import` removed (next/font Manrope+Space Grotesk+Space Mono), full token architecture in `:root` + Tailwind v4 `@theme inline`, `prefers-reduced-motion` baseline + Lenis never instantiated under reduced motion. (6) `supabase/tests/rls_phase0.sql` passes all 7 checks (anon-deny, member surface, open-rush roster gate, blind-until-submitted 0→4 flip, board visibility, append-only, signup gate); `npm run build` green.
Why: Roadmap Phase 0 blocks both tracks; locked decisions honored (PRD token ARCHITECTURE with current navy/orange palette + Space Grotesk/Manrope — PRD §7 hex/Archivo superseded by owner choice; local DB only, remote apply still a hard stop).
Rejected: applying to a remote Supabase project (owner chose local-first); `scores.status` blind mechanism (PRD reconciliation B mandates `score_submissions`); sweeping all components onto tokens now (Track A scope). Note: `/apply` submit, event check-in, applicant dashboard data, and internal calendar are intentionally STUBBED (old code wrote to nonexistent `applications`/`recruitment_events`/`event_attendance` tables with the anon client — rebuilt properly in Track B2). `recruitment_events`/attendance need a schema spec (not in PRD §10) before the check-in flow returns.
Next session: Track A1 (scroll-triggered motion) and/or Track B1–B2 (role-gated internal pages, /apply intake Route Handler). Get real rubric criteria + board roster emails (CON-8) from the club.

## 2026-06-10 — Build roadmap created (docs/ROADMAP.md)
What: Created a Fable-ready execution roadmap (companion to the PRD, not a re-spec). Two parallel tracks — A: external design elevation (elevate existing dark/maize aesthetic to awwwards-tier), B: internal ATS backend. Phase 0 (foundation, blocks both) → tracks → integration/launch.
Why: Owner asked to map the work before switching to Fable 5 for execution. The PRD already covers ~95% of the feature list; the gap is execution, design polish, and one new surface (alumni/internship).
Decisions locked (owner via popup): both tracks in parallel; ELEVATE current aesthetic (no new art direction); hard deadline late Aug/early Sep 2026 for internal ATS; alumni/internship content via member self-submitted profiles feeding the public page.
Key findings grounding the plan: (1) NO migrations / no supabase/ dir — entire data layer unbuilt; backend is the long pole. (2) Schema DRIFT — auth/actions.ts queries `profiles.role`, contradicting PRD canonical `members` + current_member_id()/current_member_role() helpers (§11.3); must reconcile in Phase 0.1 before more backend code. (3) Design gaps vs PRD §7: fonts via render-blocking @import not next/font; reveals fire on mount not scroll; no prefers-reduced-motion handling; no scroll choreography/WebGL/page transitions. (4) Middleware only refreshes session, does NOT gate /internal.
Open inputs needed (gate build): rubric criteria/weights from club Google Docs (blocks B4); trek content/photos; U-M brand + client-logo permission; confirmed recruitment open date.
Next session: start Phase 0 (schema drift reconciliation + canonical migrations + design foundation) with Fable.

## 2026-06-08 — PRD finalized (docs/PRD.md)
What: Produced the board-ready v1.0 PRD (`docs/PRD.md`, ~1,450 lines) for the MECG Digital Platform — public art-directed site + gated internal recruitment ATS — via a multi-agent /workflow (7 domain specialists + adversarial critic), then a reconciliation+synthesis pass. Owner draft kept at `docs/PRD-draft-source.md`.
Why: Owner asked for a complete, self-consistent PRD. Parallel enrichment produced 18 cross-domain contradictions + 13 gaps; all resolved via authoritative reconciliation decisions (Appendix C in the PRD).
Decisions locked (owner via popup): deliverable = PRD doc only; general members CAN view open-rush candidate roster (names/basic info, no scores/notes/hash); hash votes ANONYMOUS by default (per-session flip); native `/apply` intake.
Key reconciliations (canonical, do not contradict): identity via `current_member_id()`/`current_member_role()` security-definer helpers (`members.id` PK ≠ `auth.uid()`, linked by `members.user_id`); blind-until-submitted via append-only `score_submissions` table (no `scores.status`); per-cycle candidate uniqueness `(cycle_id, lower(email))`; `decisions` append-only (`accepted|rejected|waitlisted`); resume PDF-only ≤10MB via server-mediated service-role Route Handler (no anon writes); ink focus ring default (maize only on dark bg); sample stddev (n−1) normalization; integer 1–5 scores; derived values in views not base columns; new tables recruitment_cycles, evaluator_assignments, hash_session_participants, placement_features, application_questions, stage_transitions + members.placement_consent.
Still OPEN (OQ): U-M/CoE brand+logo constraints; client-logo display permission; real rubric criteria/weights (from club Google Docs); applicant confirmation email (external send = hard stop).
Next session: confirm open OQs with MECG; then Phase 0 scaffold (Next.js + Supabase + Tailwind tokens + RLS baseline).
