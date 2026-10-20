# Test strategy audit — 2026-10 redesign

Scope: independent AI code review, not a user study. Read-only inspection except this report; no live mutation checks or test/build artifacts generated. Concurrent source edits mean this is a point-in-time assessment, not a release certification.

## Confirmed defects / verification gaps

- **Public route coverage is narrow.** `tests/e2e/public-smoke.spec.ts:3–69` exercises home, contact navigation, headers, API rejection, and 404; it does not visit `/work`, project detail, `/team`, or `/join` (routes under `src/app/(marketing)/`). A green run cannot certify the public redesign.
- **No visual/accessibility regression gate.** The three `tests/e2e/*.spec.ts` files contain no screenshot comparisons, keyboard traversal, overflow, reduced-motion, or contrast assertions. `playwright.config.ts:18–28` runs desktop Chrome and Pixel 7 emulation, not Safari/Firefox. `docs/DESIGN.md` §§1–5 requires focus, contrast, 44px targets, section labels, restrained motion, and distinct public/workspace typography.
- **API smoke assertion can conceal routing failures.** `tests/e2e/public-smoke.spec.ts:54–55` only rejects status 500 for ICS; 404, redirects, or other unexpected failures pass. Tighten to explicit expected unavailable/not-found behavior under the isolated fixture configuration.
- **Authenticated browser coverage stops at account creation.** `tests/e2e/authenticated-clerk.spec.ts:11` verifies signup/email verification/session activation, not application persistence or member grading. `.github/workflows/ci.yml:99–109` runs it only on opted-in main pushes, not PRs.
- **Some application tests assert source spelling.** `src/app/apply/application-form.test.ts:68–92` reads implementation text; this is weaker than interaction evidence. The existing recovery E2E helps, but covers one interrupted-submit scenario only (`tests/e2e/application-reliability.spec.ts:3`).
- **README verification guidance is stale.** `README.md` Setup says Supabase Auth; `.env.example` says Clerk owns authentication. README claims `verify:backend` creates records and needs a dev server, while `scripts/verify-backend.mjs:13–35` checks Supabase REST/RPC denial and migration metadata directly. `scripts/verify-full-workflow.mjs:25–55` creates Clerk identities, not the Supabase Auth users described there.

## Existing coverage worth retaining

- `package.json` runs all source/script test globs in one Node invocation with module mocks and the alias loader (`scripts/esm-hooks.mjs`); no separate chained groups as described in older `docs/audit/07-build-ci-tests.md`.
- Application boundary/error/idempotency contracts: `src/app/api/apply/route.test.ts`; draft/upload recovery: `src/lib/application-draft-recovery.test.ts`, `src/lib/resume-upload.test.ts`, `src/app/api/apply/resume/resume-routes.test.ts`.
- Grading math: `src/lib/evaluation.test.js` covers missing observations, minimum coverage/count, independent ratings, 25-point disagreement, and round weighting; screening readiness/drafts have dedicated tests under `src/app/member/screening/`.
- Database behavior: `supabase/tests/rush_foundation.sql:1–4` declares 371 pgTAP checks and ends with rollback at line 1187; `.github/workflows/ci.yml:67–97` applies all migrations, lints, and tests an isolated database.
- `scripts/check-sql.py:22–24,90–95` explicitly cannot prove runtime schema/policy behavior or RPC argument compatibility. Keep pgTAP and route contract tests alongside it.

## Shortest reliable local matrix (recommended; not executed here)

| Gate | Minimum action | Evidence / limit |
| --- | --- | --- |
| Deterministic regression | `npm test`; `npm run lint`; `npx --no-install tsc --noEmit` | Covers application/grading helpers and mocked route boundaries; no real Clerk/RLS/storage integration. |
| SQL contract | `npm run check:sql` with CI-pinned `pglast==7.18` | Parser/name checks; supplement with database row below when migrations/RPCs change. |
| Production rendering | `npm run build` with the placeholder build env in `.github/workflows/ci.yml:27–44` | Match Node 22 CI; `E2E_LOCAL_HTTP=1` is a disposable local-browser build only. |
| Browser smoke + application recovery | `CI=1 npm run test:e2e` with CI runtime env at `.github/workflows/ci.yml:47–65` | Both default Chromium projects; fresh `next start`, not a potentially stale reused dev server. Do not enable Clerk E2E. |
| Public redesign acceptance | Visit all marketing routes plus a valid/invalid work slug at desktop and 390px; keyboard-test mobile nav, links, forms; check 200% zoom, overflow, focus, reduced motion, image loading, console errors | Compare against `docs/DESIGN.md`; intercept contact/interest submissions locally and exercise success/validation/503 without sending email or recording interest. |
| Application/grading interaction supplement | Extend local harness fixtures: invalid fields, failed upload, draft reload, double submit; isolated member fixture: partial draft, N/O, required evidence, submit lock | Current harness bypasses signup and seeds materials (`src/app/apply/test-harness/page.tsx`); mocked recovery cannot certify persisted submissions or signed-in grading UX. |
| Database, when backend changes | In a disposable copy, reproduce `.github/workflows/ci.yml:67–97`; then `npm run supabase:lint:local` and `npm run test:supabase:local` | CLI 2.116.0 + Docker; disable remote Clerk discovery as CI does. Reset only that disposable local database. Avoid linked variants. |

Build and browser steps must use matching environment values. `src/lib/env.ts:16–25` gives MECG-prefixed Supabase values precedence; override both naming variants if inherited values exist. Keep service-role/Resend credentials absent and disable/block external auth/provider calls. `playwright.config.ts` inherits process env, so its defaults alone do not ensure isolation.

## Hypotheses requiring execution

- New public layouts may overflow, hide keyboard focus, or violate token/section-label rules; no rendered UI inspected in this audit.
- Mocked application recovery may differ from real storage/Clerk/RLS behavior; the isolated database gate also excludes storage-api and PostgREST (`.github/workflows/ci.yml:90–91`).
- Renamed headings/CTAs may break exact-text smoke locators; update them to approved copy while retaining meaningful navigation assertions.

## Current environment and external boundaries

- Observed: Node `v26.8.1`, npm `11.19.0`, installed `node_modules`, existing `.next`, cached Chromium, and responding Docker daemon `29.7.2`; CI uses Node 22. Browser dependency usability and existing build freshness remain unverified.
- `supabase` is absent from PATH; Python `pglast` is unavailable. No `.env`/`.env.local` appeared in root inventory (only `.env.example`); inherited credential presence was not inspected. No dependencies installed or credentials printed.
- No test/lint/type/build/browser/database run was performed; there is no fresh pass/fail result. Do final gates after concurrent edits settle, in a disposable checkout where generated files cannot disrupt other agents.
- Excluded: `verify:auth`, `verify:workflow`, `test:e2e:clerk` create/delete external identities/data (`scripts/verify-auth-routing.mjs:40–68`, `scripts/verify-full-workflow.mjs:25–55`, `tests/e2e/authenticated-clerk.spec.ts`). `test:supabase` defaults to linked DB; never substitute it for the local gate.
- Also excluded: live backend denial probes, account/load scripts, seed/migration/sync commands, and real contact/interest submissions. `verify:infrastructure` is DNS-only (`scripts/verify-public-infrastructure.mjs:15–32`) and proves neither UI nor authentication flow.
