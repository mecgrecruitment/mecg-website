# Section 7 audit: build, CI, tests, tooling, over-engineering

Scope: `package.json`/`package-lock.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`,
`postcss.config.mjs`, `.gitignore`/`.env*`, `.github/workflows/ci.yml`, `scripts/**`,
`supabase/config.toml`, `docs/**`, every `*.test.{ts,js,mjs}`. Read-only: no files edited, no
packages installed by this audit, no migrations run, no remote database touched.

**Environment note.** At the start of this audit `node_modules/` did not exist in the working tree,
so `npm run lint`, `npx tsc --noEmit`, and `npm run build` all failed on missing tooling rather than
on real errors. Partway through the session `node_modules/` appeared and `npm install`,
`npm run lint`, `npm test`, `npm run build`, and `npx tsc --noEmit -p tsconfig.json` invocations
show up in `~/.npm/_logs/` with `cwd: /Users/rbhavan/pro` that this audit did not issue (this audit's
own commands are plain `npm run lint` / `npx tsc --noEmit` / `npm test` / `npm run build`, no `-p`
flag, no `npm install`). Something else — a concurrent process against this same checkout, most
likely editor/LSP tooling — ran `npm install` during the session. This audit did not run it and ran
no other install. Once dependencies were present, the results below are genuine.

## Build / test / lint status (verbatim, final state with dependencies installed)

### `npm run lint`
```
> mecgwebsite@0.1.0 lint
> eslint

(no output, exit 0)
```
Clean, zero problems.

### `npx tsc --noEmit`
```
(no output, exit 0)
```
Clean. (Before dependencies existed, `npx tsc` silently resolved and installed an unrelated
abandoned package literally named `tsc` from the registry — see Finding LOW-1.)

### `npm test`
Three chained `node --test` invocations, all exit 0:
```
group 1 (plain node --test):      tests 10, pass 10, fail 0
group 2 (--experimental-strip-types): tests 29, pass 29, fail 0
group 3 (+ --experimental-test-module-mocks, custom loader): tests 42, pass 42, fail 0
```
81 tests total, 0 failures, 0 skipped.

Before dependencies existed, group 2 failed with `ERR_MODULE_NOT_FOUND: pdfjs-dist` inside
`pdf-validation.test.ts`, and because the three groups are chained with `&&`, group 3 (7 test
files: `env.test.ts`, `recovery-marker.test.ts`, `proxy.test.ts`, and four route tests) never ran
at all — not "skipped," never invoked. This is a structural property of the script, not an
artifact of the missing install: any real failure in group 1 or 2 hides group 3 entirely. See
Finding HIGH-1.

### `npm run build`
```
▲ Next.js 16.3.1 (Turbopack)
✓ Compiled successfully in 7.6s
  Running TypeScript ...
  Finished TypeScript in 2.6s ...
Error occurred prerendering page "/join". Read more: https://nextjs.org/docs/messages/prerender-error
Error: Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL
    at <unknown> (src/lib/env.ts:3:21)
    at q (src/app/(marketing)/join/page.tsx:91:50)
Export encountered an error on /(marketing)/join/page: /join, exiting the build.
⨯ Next.js build worker exited with code: 1 and signal: null
```
**Stopping here per instructions rather than inventing values.** The build needs
`NEXT_PUBLIC_SUPABASE_URL` (and by the same code path, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) because
`/join` is statically prerendered and calls `requireEnv` at build time. `.github/workflows/ci.yml`
supplies exactly these two as either repo secrets or `https://ci.invalid` / `ci-placeholder`
fallbacks for the same reason — this is documented, expected behavior, not a bug. Compiling and
typechecking both succeed before the prerender step, so the build is otherwise sound.

## Environment variables

Every `process.env.*` read in `src/` and `scripts/` (test files excluded):

| Variable | Read at | Required/optional | Documented in `.env.example`? | Missing-value behavior |
|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_MECG_SUPABASE_URL` | `src/lib/env.ts` (`getSupabasePublicEnv`) | required (one of the pair) | yes | throws `Missing required environment variable`, fails the build/boot — fail-fast, good |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `NEXT_PUBLIC_MECG_SUPABASE_ANON_KEY` | same | required (one of the pair) | yes | same, fail-fast |
| `SUPABASE_SERVICE_ROLE_KEY` / `MECG_SUPABASE_SERVICE_ROLE_KEY` | `src/lib/env.ts`, `src/instrumentation.ts` | required for any admin route | yes | `instrumentation.ts` logs `[boot] DEGRADED` at startup instead of crashing — every admin route then fails individually at call time. Correct: this key is not needed by the public site, so a hard crash would take down marketing pages over an admin-only misconfiguration |
| `RESEND_API_KEY` | `src/lib/email.ts`, `instrumentation.ts` | required for email | yes | `instrumentation.ts` logs `DEGRADED`; `email.ts` presumably no-ops or throws per-call (not re-verified here) — visible at boot, not silent |
| `RESEND_FROM_EMAIL` | same | required for email | yes | same |
| `CONTACT_TO_EMAIL` | `src/app/api/contact/route.ts:40` | optional | yes | falls back to `mecg-board@umich.edu` hardcoded in the route — silent, not documented as a fallback in `.env.example` |
| `CRON_SECRET` | `src/app/api/maintenance/prune-resumes/route.ts:20` | required for the cron route | **no** | fails closed with a logged error + HTTP 503; `docs/RELEASE_AUDIT_FINDINGS.md:32` already flags this as an open item ("must be set in Vercel") |
| `BASE_URL` | `src/app/admin/events/[id]/page.tsx:62` | optional | **no** | falls back to inferring from the request's `Host` header — reasonable default, but undocumented |
| `NODE_ENV` | `next.config.ts`, two auth routes | platform-managed | n/a | standard |
| `NEXT_RUNTIME` | `instrumentation.ts:4` | platform-managed | n/a | standard Next.js internal |
| `VERCEL_DEPLOYMENT_ID` | `next.config.ts:47` | optional, platform-set | n/a | undefined is fine, passed straight to `deploymentId` |

`NEXT_PUBLIC_*` scoping is correct throughout: only the Supabase URL and anon/publishable key are
exposed to the client, matching what the anon key is designed for. No server secret (service role
key, Resend key, cron secret) is ever read through a `NEXT_PUBLIC_` name.

Two real gaps: `CRON_SECRET` and `BASE_URL` are read in code but absent from `.env.example`, so a
new deploy target has no record that they exist short of grepping the source (see Finding
MEDIUM-1).

## Documentation freshness

| File | Verdict | Basis |
|---|---|---|
| `docs/RELEASE_AUDIT_FINDINGS.md` | **current** | Dated 2026-08-31 (yesterday). Spot-checked three claims against the live tree: B1's fix (`combineRoundScores` filtering `round.weight > 0`) is in `src/lib/evaluation.js:49`; `.github/workflows/ci.yml` is tracked (`git ls-files` confirms, closing B9); all six files S25 named as dead code are gone from the tree. All three checks matched the doc. Treat as accurate. |
| `docs/SQLITE_MIGRATION_REPORT.md` | **historical record, correctly labelled by content** | Describes a one-time inspection of a legacy `prisma/dev.db` (zero rows) before Prisma removal. No `prisma/` directory, no `sqlite`/`better-sqlite`/`.db` reference anywhere in `src/` or `scripts/` today — the app is fully on Postgres/Supabase. The doc is not miscategorized; it reads as a completed migration note, not a live guide. Only vestige: `.gitignore` still has an unused `/prisma/*.db` pattern (harmless, see Delete list). |
| `docs/SUPABASE_FULL_FUNCTIONAL_PLAN.md` | **stale in one respect, otherwise historical** | RELEASE_AUDIT_FINDINGS.md's S27 claims this file "contradicts itself: line 5 says Prisma is removed, line 15 says every route still imports it." Current line 15 is a section heading (`## What "ultra functional" means here`) with no such claim anywhere in the file, and `grep -rn "prisma" src package.json` returns nothing — Prisma really is gone. Either S27's specific line reference is already stale (the file was edited since that finding was written) or referred to a different revision. No live contradiction found now. |
| `docs/RUSH_PLATFORM_PLAN.md` | **historical, self-labelled** | Opens with "> Historical. This is the original build plan, written in future tense; the work it describes has shipped. Read it as a record of intent, not as a backlog." Correctly flagged by its own author; no action needed. |
| `docs/DESIGN.md` | **current** | Describes the live design system (tokens, type scale, section-label grammar); dated decision record 2026-08-22, consistent with recently-touched marketing/UI files. |
| `docs/CREDIBILITY_CONTENT_INTAKE.md` | **current, operational** | A blank intake worksheet for future content approval, not a claim about the codebase; nothing to go stale. |
| `docs/apex-consulting-reference.md` | **current, dated research note** | Competitive research dated 2026-08-30, explicitly scoped as "borrow the strategy, not the exact styling." Time-stamped and self-contained; will age but isn't wrong today. |

No doc in scope currently makes a claim that contradicts the code as it stands.

## Findings

### [HIGH] Chained `&&` test script silently skips later test files on any earlier failure
`package.json:10`. The `test` script is three `node --test` invocations joined by `&&`. If any
test in group 1 or group 2 fails, group 3 — `env.test.ts`, `recovery-marker.test.ts`,
`proxy.test.ts`, and three route tests, 42 of the suite's 81 tests — never runs. `npm test` still
exits non-zero so CI won't go green, but the TAP output undercounts what actually failed, making
triage slower, and anyone reading "fail 1" from group 2's output would reasonably assume the other
groups ran and passed rather than never started.
Smallest fix: collapse the three invocations into one. Node's `--test` runner already
auto-discovers files matching `*.test.{js,mjs,ts}` recursively (verified: running
`node --experimental-test-module-mocks --import ./scripts/test-esm-loader.mjs --test` with no
file list picks up all 15 test files, 87 subtests, unaffected by files that don't need the loader
or module mocks). A single command replaces the hand-maintained list and removes the `&&`
short-circuit — every file gets a chance to report, and `--experimental-strip-types` can be
dropped since Node 22.23.1 strips TS types by default (see LOW-2).
**Caveat before doing this:** `scripts/test-esm-hooks.mjs` and `scripts/test-esm-loader.mjs`
themselves match Node's default `test-*.?(c|m)js` discovery glob and get silently executed as
zero-assertion passing "tests" (confirmed in the full-glob run above: `ok 2 -
scripts/test-esm-hooks.mjs`, `ok 3 - scripts/test-esm-loader.mjs`). Rename them (e.g.
`scripts/esm-loader.mjs`, `scripts/esm-hooks.mjs`) before switching to bare `--test` discovery, or
scope discovery to `src/ scripts/*.test.mjs`.

### [MEDIUM] `CRON_SECRET` and `BASE_URL` are read in code but absent from `.env.example`
`src/app/api/maintenance/prune-resumes/route.ts:20`, `src/app/admin/events/[id]/page.tsx:62`,
`.env.example` (whole file). Every other server-read variable is listed with a placeholder;
these two are not. `CRON_SECRET` matters more: without it the cron route fails closed (503) and
abandoned resume uploads are never pruned — already called out as an open item in
`docs/RELEASE_AUDIT_FINDINGS.md:32`, but that finding lives in an audit doc, not the environment
template someone actually copies when standing up a new deploy target.
Fix: add both to `.env.example` with a one-line comment each (`CRON_SECRET` — required, generated
secret for Vercel Cron; `BASE_URL` — optional, overrides Host-header inference for QR check-in
links).

### [MEDIUM] Dead `overrides.deepmerge-ts` pin from the removed Prisma dependency
`package.json:42-44`. `git log -p -- package.json` shows this override was added in the same
commit that added `"prisma": "^6.19.3"` to devDependencies, and Prisma has since been fully
removed (no `prisma` in `package.json`, no `prisma/` directory, confirmed above). `deepmerge-ts`
does not appear anywhere in `package-lock.json` — `grep -ci deepmerge package-lock.json` returns
`0`. Nothing in the current dependency tree resolves to this package; the override is inert.
Fix: delete the `overrides` block (3 lines).

### [MEDIUM] `@next/env` used directly but never declared as a dependency
`scripts/lib/supabase-env.mjs:1` imports `@next/env` (`loadEnvConfig`) to read `.env.local` outside
the Next.js runtime for the four `verify-*`/`sync-*` scripts. `@next/env` is not in
`package.json`'s `dependencies` or `devDependencies` — it resolves only because `next` itself
depends on it and npm hoists it into the top-level `node_modules`. That's an implicit contract on
`next`'s own dependency tree, not a guaranteed one; if a future Next major stops shipping
`@next/env` as a direct dependency, every `verify:*`/`supabase:sync-env` script breaks with no
signal until someone runs one.
Fix: add `@next/env` to `devDependencies` at whatever version `next` currently pulls (one line).

### [LOW] `npx tsc --noEmit` without local TypeScript resolves the wrong package
Before `node_modules` existed, `npx tsc --noEmit` silently fetched and ran a real but unrelated
and deprecated npm package literally named `tsc` (`tsc@2.0.4`, "This is not the tsc command you
are looking for") instead of erroring or refusing. This is an `npx` footgun independent of this
repo, but it means CI or a contributor running the documented command outside `npm ci` gets a
confusing wrong-tool result rather than "install dependencies first." Not actionable in this repo
beyond what CI already does correctly (`npm ci` before `npx tsc --noEmit`); noting it because the
audit instructions asked for verbatim command output and this was the real, if surprising, result.

### [LOW] `--experimental-strip-types` is redundant on the pinned CI Node version
`package.json:10`, `.github/workflows/ci.yml:12` (`node-version: 22`). Verified directly: Node
22.23.1 strips `.ts` type annotations without any flag (`node script.ts` ran unmodified;
`node --help` shows the flag is now `--no-experimental-strip-types`, i.e. the feature defaults to
on). The flag is harmless to keep — it's a no-op, not an error — but it no longer does anything on
the Node version this project actually runs. `--experimental-test-module-mocks` is still a real,
required flag: `node:test`'s `t.mock.module` genuinely needs it. The custom loader
(`scripts/test-esm-loader.mjs` → `scripts/test-esm-hooks.mjs`) is also still needed: `node --test`
has no bundler, so without the loader's resolve hook neither the `@/*` path alias nor the
extensionless `next/server` subpath export would resolve, and 49 files across the app import via
`@/`. Keep the loader; the strip-types flag can be dropped whenever convenient, no urgency.

### [LOW] Duplicated Supabase-env precedence logic between `src/lib/env.ts` and `scripts/lib/supabase-env.mjs`
Both files implement the identical "prefer `MECG_`-prefixed var, fall back to unprefixed, throw if
neither is set" logic (`src/lib/env.ts:1-45`, `scripts/lib/supabase-env.mjs:5-33`) — reasonable
given the scripts run as plain `node script.mjs` with no `--experimental-strip-types` flag in their
npm scripts (`"verify:backend": "node scripts/verify-backend.mjs"`), so they can't `import` the
`.ts` module directly today. If the flag were added to those three npm scripts, the `.mjs`
duplicate (33 of its 46 lines) could be deleted in favor of importing `getSupabasePublicEnv` /
`requireSupabaseServiceRoleKey` from `src/lib/env.ts`, leaving only the scripts-specific
`fetchWithTimeout` helper. Not urgent — the two copies are short and currently in sync — but worth
doing next time either one changes, since nothing currently tests that they stay identical.

### CI: what actually runs vs. what a broken deploy needs caught
`.github/workflows/ci.yml` runs, in order: `npm ci`, `npm run lint`, `npm test`, `npx tsc --noEmit`,
`npm run build` (with placeholder Supabase env vars so the `/join` prerender degrades gracefully
instead of failing). That is a reasonable, complete app-layer gate, and it is genuinely wired up
(`.github/workflows/ci.yml` is tracked in git, closing the B9 finding from
`docs/RELEASE_AUDIT_FINDINGS.md`).

What it does **not** run, and why each is a real gap rather than an oversight to dismiss:
- `supabase db lint` (`npm run supabase:lint`) — never runs in CI. A migration that violates
  RLS/grant conventions ships silently.
- `supabase test db` (`npm run test:supabase`, `supabase/tests/rush_foundation.sql`) — never runs
  in CI. SQL-level behavior (the actual RLS policies, the SECURITY DEFINER functions) has zero
  automated coverage on every PR; only the four `verify-*.mjs` integration scripts exercise it, and
  none of those run in CI either, because they require a linked live Supabase project and real
  secrets.
- Migration ledger parity (`supabase migration list --linked`, done by `verify-backend.mjs:29-30`)
  — never checked in CI. `docs/RELEASE_AUDIT_FINDINGS.md`'s own B6 finding describes exactly this
  kind of drift (a migration file edited after being applied, ledger reporting converged while the
  live schema wasn't) causing a real production outage. CI cannot catch a repeat of that today.
- `docs/RELEASE_AUDIT_FINDINGS.md:41-53` (the "Gate results" table in that doc) says the same thing
  in its own words: "A green gate set is not evidence of a healthy pipeline here." That line is
  still true of the current `ci.yml`.

None of this means CI is misconfigured — running live-database integration scripts against a
shared linked Supabase project on every PR from a fork is a real secrets-exposure and
test-pollution risk, and the four `verify-*.mjs` scripts create and delete real Auth users, so
keeping them out of the public PR-triggered workflow is the right default. But it does mean CI can
be green while RLS, migrations, and the true end-to-end workflow are broken — which is exactly
what happened in the incident `RELEASE_AUDIT_FINDINGS.md` documents. If there's a way to run
`supabase db lint` in CI without a live project (it can lint against the local migration set), that
one is the highest-value addition since it needs no secrets.

### Branch protection / secrets handling
No branch protection configuration is visible from the repo (that's a GitHub setting, not a file),
so it can't be verified from here either way. Secrets handling in `ci.yml` is correct: the two
`NEXT_PUBLIC_*` values are the client-exposed anon key/URL pair, not secrets, and the workflow
explicitly documents (in a code comment) why placeholders are safe to fall back to. No
service-role key, Resend key, or `CRON_SECRET` is referenced anywhere in the workflow, so there's
nothing sensitive for a fork's PR to exfiltrate via this workflow.

### Are the four `verify-*.mjs` scripts redundant with real tests?
No. Each does something the Node unit tests structurally cannot:
- `verify-backend.mjs` (31 lines) — hits the live Supabase REST API to confirm RLS actually denies
  anonymous reads, confirm required RPCs exist in the deployed OpenAPI schema, and confirm the
  local and remote migration ledgers match. Unit tests exercise TypeScript/JavaScript logic in
  isolation; none of them touch a real deployed Postgres instance or its RLS policies.
- `verify-full-workflow.mjs` (54 lines) — creates three real Supabase Auth users, exercises RLS as
  each of them, calls `verify_full_workflow` (which rolls back its own transaction), and cleans up.
  This is the only thing in the repo that exercises the full stack (Auth → RLS → SQL function)
  together.
- `verify-auth-routing.mjs` (170 lines) — drives the actual running HTTP server through five real
  login/redirect scenarios end to end (server must be running separately at
  `AUTH_TEST_BASE_URL`). No unit test can cover this without a running server.
- `verify-supabase-project.mjs` (131 lines) — a deploy-target sanity check (right project, right
  keys, right status) via the Supabase management API. This is closer to a pre-flight script than
  a test; it has no unit-test equivalent because its entire job is confirming which real project
  you're pointed at.

These are appropriately excluded from CI (they need a live linked project, real secrets, and in
`verify-auth-routing.mjs`'s case a separately-running dev server) and are not duplicating anything
the Node test suite already covers. They belong in the "manual pre-release checklist" category,
which is exactly how `docs/RELEASE_AUDIT_FINDINGS.md`'s gate table already treats them.

## Delete list (ranked by lines/risk removed)

1. **`overrides.deepmerge-ts` pin** — `package.json:42-44`, 3 lines. Confirmed dead: added
   alongside the now-fully-removed Prisma dependency, and `deepmerge-ts` has zero occurrences in
   `package-lock.json`. Zero risk to delete.
2. **`--experimental-strip-types` flag, 3 occurrences** — `package.json:10`, ~60 characters total.
   Confirmed no-op on Node 22.23.1 (the pinned CI version). Cosmetic cleanup, not urgent.
3. **Duplicated env-precedence logic in `scripts/lib/supabase-env.mjs`** — up to 33 of its 46
   lines, conditional on first adding `--experimental-strip-types` to the three `verify:*`/
   `supabase:sync-env` npm scripts so they can import the `.ts` version directly from
   `src/lib/env.ts`. Not free-standing dead code today (it's the only implementation those scripts
   have access to under their current invocation), so this is a "do it alongside a real touch of
   either file" cleanup, not a drop-everything one.
4. **Vestigial `.gitignore` SQLite entries** — `.gitignore`'s `/prisma/*.db` and
   `/prisma/*.db-journal` lines (2 lines). No `prisma/` directory exists in the tree; harmless but
   dead now that `docs/SQLITE_MIGRATION_REPORT.md` confirms the SQLite/Prisma path was fully
   retired.
5. **`@next/env` phantom dependency** — not a deletion, the opposite (add 1 line to
   `devDependencies`), but grouped here because it's the same "tidy up what the dependency
   manifest actually says" pass as items 1 and 3.

No components, exports, or scripts were found to be genuinely dead beyond what
`docs/RELEASE_AUDIT_FINDINGS.md`'s own S25 already identified and which has already been deleted
from the tree (verified: all six named files are gone). A pass over `src/components/*` found zero
files with no in-tree importer. This codebase was audited and cleaned very recently (yesterday, per
the dated findings doc) — there isn't much low-hanging dead code left to cut.
