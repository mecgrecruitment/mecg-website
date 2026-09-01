# Section 3 Audit: HTTP API Route Handlers

**Scope:** all `route.ts` files under `src/app/api/**` (34 files), `src/lib/api-route.ts`, `src/lib/pdf-validation.ts`, `src/lib/email.ts`, and the four existing route test files.

## Verdict

This is a well-built API layer. Nearly every state-changing RPC (`rsvp_slot`, `book_buddy_slot`, `respond_to_offer`, `check_in`, `create_decision`, `submit_application`) does its real authorization and idempotency work in Postgres with `for update` row locks, advisory locks, and `on conflict do nothing`/unique constraints, so the database is the authoritative gate even where the route handler's own permission check is weak or absent — double-submits and cross-cycle/cross-owner tampering were checked against the actual SQL and come back safe in every case tested. The resume upload pipeline (start → client-side storage upload → finalize) validates real file bytes (magic number, EOF marker, encryption, JS/embedded-file/annotation scanning via pdfjs, size, page count, SHA-256) only after the bytes land in storage but before the document is marked usable, rejects and deletes on failure, and a cron job reaps anything abandoned mid-flow. `npm run lint` and `npx tsc --noEmit` both pass clean, and the 42 existing tests (4 route-level, the rest unit-level) all pass. The gaps are consistency gaps, not the database-bypassing kind: one admin route (`admin/setup`) skips the app-layer permission check every sibling admin route performs (the DB still blocks non-owners, so this is not currently exploitable); a handful of member/admin routes hand-roll `req.json().catch(() => null)` with no size cap instead of using the `readJsonBody` helper the rest of the codebase converged on; and there is no dedicated CRITICAL finding. Full detail below.

## Route Inventory

| Route | Method(s) | Auth family | Input validated? | Tested? |
|---|---|---|---|---|
| `/api/health` | GET | Public | N/A (no input) | Yes |
| `/api/contact` | POST | Public | Yes (readJsonBody + regex + length caps + honeypot) | Yes |
| `/api/interest` | POST | Public | Yes (readJsonBody + length caps) | No |
| `/api/apply` | POST | Applicant (session) | Yes (readJsonBody + `parseApplicationIntake`) | Yes |
| `/api/apply/draft` | POST | Applicant (session) | Yes (readJsonBody + `parseApplicationDraft`) | No |
| `/api/apply/resume` | GET | Applicant (session) | Partial (path length only; ownership via RPC) | No |
| `/api/apply/resume/start` | POST | Applicant (session) | Yes (readJsonBody + filename/size checks) | Yes |
| `/api/apply/resume/finalize` | POST | Applicant (session) | Yes (readJsonBody + UUID regex + byte-level PDF validation) | Yes |
| `/api/apply/resume/cancel` | POST | Applicant (session) | Yes (readJsonBody + UUID regex) | Yes |
| `/api/auth/login` | POST | Public | Partial (hand-rolled `req.json()`, no size cap; length/format checks present) | No |
| `/api/auth/logout` | POST | Public/session | N/A | No |
| `/api/auth/signup` | POST | Public | Partial (hand-rolled, no size cap; length/format checks present) | No |
| `/api/auth/forgot-password` | POST | Public | Partial (hand-rolled, no size cap) | No |
| `/api/auth/reset-password` | POST | Recovery-session (special cookie) | Partial (hand-rolled, no size cap) | No |
| `/api/admin/login` | POST | Public (re-export of auth/login) | same as auth/login | No |
| `/api/admin/logout` | POST | Public/session (re-export) | N/A | No |
| `/api/admin/setup` | POST | **Any authenticated user** (no `hasPermission` check; DB enforces OWNER) | Partial (hand-rolled `req.json()`, no size cap) | No |
| `/api/account/password` | POST | Session (any authenticated user) | Partial (hand-rolled, no size cap; no rate limit) | No |
| `/api/admin/decisions` | POST | Admin (`hasPermission` DECIDE/RELEASE, cycleId re-derived from DB for non-CREATE/PREVIEW) | Yes (mostly), PREVIEW's cycleId is client-trusted for the app-layer check only | No |
| `/api/admin/events` | POST | Admin (`selectAuthorizedCycleId` + RECRUITMENT_OPERATIONS) | Yes (UTC offset enforcement, date ordering) | No |
| `/api/admin/events/[id]/rotate` | POST | Admin (`hasPermission` RECRUITMENT_OPERATIONS, cycleId from DB lookup) | Yes | No |
| `/api/admin/export` | GET | Admin (`selectAuthorizedCycleId` EXPORT) | Yes (CSV injection guarded) | No |
| `/api/admin/rush` | POST | Admin (`hasPermission` per-action permission map) | Yes (readJsonBody, enum sets, `isMemberRole`) | No |
| `/api/admin/screening` | POST | Admin (`hasPermission` RECRUITMENT_OPERATIONS) | Yes (hand-rolled `req.json()`, but strict `parsePacketContent`) | No |
| `/api/admin/applications/[id]/resume` | GET | Admin (RPC `authorize_resume_access`) | Yes (delegates to RPC) | No |
| `/api/applicant/rsvp` | POST | Applicant (session) | Yes (readJsonBody) | No |
| `/api/applicant/offer` | POST | Applicant (session) | Yes (readJsonBody) | No |
| `/api/applicant/buddy` | POST | Applicant (session) | Yes (readJsonBody) | No |
| `/api/applicant/survey` | POST | Applicant (session) | Yes (readJsonBody) | No |
| `/api/checkin/[token]` | POST | Applicant (session) + opaque token | Yes (delegates to RPC hashing) | No |
| `/api/events/[id]/ics` | GET | Public | Yes (id match against public RPC data) | No |
| `/api/interest`, see above | | | | |
| `/api/maintenance/prune-resumes` | GET, POST | Maintenance (`CRON_SECRET` bearer) | Yes | No |
| `/api/member/buddy` | POST | Member (session; no local permission check, relies on RPC) | Partial (hand-rolled `req.json()`, `String()` coercion, no size cap) | No |
| `/api/member/conflicts` | POST | Member (session; relies on RPC) | Partial (hand-rolled `req.json()`, no size cap) | No |
| `/api/member/evaluations/[assignmentId]` | POST | Member (session; relies on RPC) | Yes (`parseRatings`, hand-rolled `req.json()`, no size cap) | No |
| `/api/member/impressions` | POST | Member (session; relies on RPC) | Yes (readJsonBody + explicit checks) | No |
| `/api/member/screening` | POST | Member (session; relies on RPC) | Yes (`parseScreeningRatings`, hand-rolled `req.json()`, no size cap) | No |

## Findings

### [HIGH] `admin/setup` is the only admin mutation route with no app-layer permission check
`src/app/api/admin/setup/route.ts:6-14`

Every other admin-family POST route (`admin/rush`, `admin/events`, `admin/decisions`, `admin/events/[id]/rotate`, `admin/screening`) calls `hasPermission(user.memberships, cycleId, …)` before invoking its RPC. `admin/setup` calls only `currentUser()` and lets any authenticated, active user (including one with zero memberships, e.g. a bare applicant account) reach `supabase.rpc("create_cycle", …)`. The underlying `rush.create_cycle` function (`supabase/migrations/20260831020000_fix_profile_reads_and_create_cycle.sql:73-78`) does independently require an active `OWNER` membership and raises `42501` (mapped to 403 by `mapRpcError`) otherwise, so this is not exploitable today — but it is the one route in its family that depends entirely on the database for authorization while its siblings fail fast in the app layer. If that RPC-side check is ever loosened (e.g. during a future migration cleanup), this route has no independent backstop.

**Fix:** add `if (!hasPermission(user.memberships, ???, "MANAGE_CYCLE")) return 403` matching the sibling routes — the caveat being `create_cycle` has no scoping cycleId yet (it's creating one), so the check should be against "does the user hold OWNER in any cycle" rather than a specific `cycleId`; this mirrors what the RPC already does and just moves the rejection to the app layer.

### [MEDIUM] Inconsistent JSON body parsing: several routes bypass `readJsonBody`'s size cap
`src/app/api/auth/login/route.ts:7`, `src/app/api/auth/signup/route.ts:7`, `src/app/api/auth/forgot-password/route.ts:6`, `src/app/api/auth/reset-password/route.ts:7`, `src/app/api/admin/setup/route.ts:8`, `src/app/api/admin/decisions/route.ts:54`, `src/app/api/admin/screening/route.ts:38`, `src/app/api/member/buddy/route.ts:9`, `src/app/api/member/conflicts/route.ts:8`, `src/app/api/member/evaluations/[assignmentId]/route.ts:28`, `src/app/api/member/screening/route.ts:29`

`src/lib/api-route.ts`'s `readJsonBody(request, maxBytes)` is the established pattern (used by `contact`, `interest`, `apply`, `apply/draft`, all three resume routes, `applicant/rsvp`, `applicant/offer`, `applicant/buddy`, `applicant/survey`, `admin/rush`, `member/impressions`). The routes listed here instead call `await req.json().catch(() => null)`, which has no byte ceiling — Next.js/the hosting platform provides some upstream body-size limit, but it is not this codebase's own defense, and it means these eleven routes are the odd ones out relative to the helper that is the stated style anchor. It is also a real inconsistency within a single family: `member/impressions` uses `readJsonBody`, its four siblings (`buddy`, `conflicts`, `evaluations`, `screening`) do not.

**Fix:** route all of these through `readJsonBody(req, <cap>)` the same way `member/impressions` and `admin/rush` already do.

### [MEDIUM] `/api/account/password` has no rate limit, unlike every other credential-verification endpoint
`src/app/api/account/password/route.ts:18-22`

This route calls `supabase.auth.signInWithPassword` to verify the caller's current password before allowing a change — the same primitive `auth/login` uses, and `auth/login` is rate-limited per-IP and per-email (`checkRateLimit`). `account/password` has no `checkRateLimit` call at all. The blast radius is bounded (the caller must already hold a valid session cookie), but an attacker who has stolen a session token without the password (e.g. via a partial compromise) gets unlimited local password-guessing attempts against `signInWithPassword`, which is exactly the primitive the rest of the app treats as needing a rate limit.

**Fix:** add `checkRateLimit(`account-password:${user.id}`)` before the `signInWithPassword` call, mirroring the pattern in `auth/login`.

### [MEDIUM] `admin/decisions` PREVIEW branch checks permission against a client-supplied `cycleId` instead of the decision's real one
`src/app/api/admin/decisions/route.ts:58-71`

For `APPROVE`/`RELEASE` the route looks up the decision's real `cycle_id` from the database before calling `hasPermission`. For `PREVIEW` it skips that lookup and uses `body.cycleId` directly (`if (action !== "CREATE" && action !== "PREVIEW") { … lookup … }`), so the app-layer permission check for `PREVIEW` can be satisfied by naming any cycle the caller has `DECIDE` in, regardless of which cycle the target decision actually belongs to. The RPC (`rush.set_decision_preview`, `supabase/migrations/20260822140000_recruitment_ops.sql:349-356`) re-derives the decision's actual `cycle_id` from `target_decision_id` and checks `has_cycle_role` against that, so this is not exploitable — but it is inconsistent with `APPROVE`/`RELEASE` in the same handler and relies entirely on the RPC to save it.

**Fix:** do the same DB lookup for `PREVIEW` as for `APPROVE`/`RELEASE`, or drop the app-layer check for `PREVIEW` entirely and note in a comment that the RPC is authoritative (to avoid the false sense of a working app-layer gate).

### [LOW] No rate limiting on applicant-family state-changing actions
`src/app/api/applicant/rsvp/route.ts`, `src/app/api/applicant/offer/route.ts`, `src/app/api/applicant/buddy/route.ts`, `src/app/api/applicant/survey/route.ts`

Unlike `apply`, `apply/draft`, and both resume upload routes, none of these call `checkRateLimit`. Each RPC does serialize correctly under concurrent/duplicate calls (advisory locks, `for update`), so this is not a correctness bug, only a missing abuse-throttle on session-authenticated, low-cost mutations. Consistent within this narrower sub-family (all four skip it the same way), so it reads as a deliberate choice rather than an oversight, but it is worth confirming that was deliberate.

### [LOW] Proxy middleware matcher excludes the applicant API family
`src/proxy.ts:25-35`

The `config.matcher` covers `/api/admin/:path*`, `/api/member/:path*`, `/api/account/:path*`, `/api/auth/:path*` but not `/api/applicant/:path*`, `/api/apply/:path*`, or `/api/checkin/:path*`. Each of those routes independently calls `currentUser()` → `supabase.auth.getUser()`, which validates the session against Supabase Auth on every request regardless of the proxy, so unauthenticated requests are still rejected correctly. What's missing is the proxy's session-cookie *refresh* step (`refreshSupabaseSession`) for this family, which is a session-longevity/UX concern (a near-expiry applicant session may 401 instead of silently refreshing) rather than a security hole.

### [LOW] `.ics` `SUMMARY`/`LOCATION` fields are not RFC 5545-escaped
`src/app/api/events/[id]/ics/route.ts:18`

`event.name`/`event.location` are interpolated into the ICS text without escaping commas, semicolons, or backslashes per RFC 5545. Source data comes from `public_recruitment`, which only admins can populate (`create_event`), so this is not attacker-reachable today, but a comma or semicolon in an event name will silently corrupt the generated calendar file for every subscriber.

### [LOW] `prune-resumes` uses non-constant-time secret comparison
`src/app/api/maintenance/prune-resumes/route.ts:25-27`

`presented !== expected` is a standard `!==` string comparison, not timing-safe. Low practical risk (the secret is high-entropy and the endpoint is not a login form an attacker can iterate against cheaply), but this is the one place in the codebase comparing a bearer secret directly rather than through Supabase's own auth verification, and the `error-handling`/`api-design` skills' bar for secret comparisons is timing-safe by default.

## Non-findings worth recording (verified, not flagged)

- **Resume upload path is sound.** `start` issues a server-controlled path scoped to the caller (`begin_resume_upload`), the client PUTs bytes directly to Storage (RLS policy in `20260831120000_resume_document_lifecycle.sql` restricts inserts to the caller's own still-pending, hour-fresh path), and `finalize` downloads and validates the actual bytes (magic number, `%%EOF`, `/Encrypt`, JS/embedded-file/annotation/OpenAction scan via pdfjs, page count, declared-vs-actual size, SHA-256) before marking the document usable, rejecting and deleting on any mismatch. Orphaned pending uploads are swept by `stale_pending_resume_uploads` via the cron-guarded `prune-resumes` route. Content-type is never trusted — only real byte inspection gates acceptance.
- **Idempotency/race handling on state-changing RPCs is correct.** `rsvp_slot`, `book_buddy_slot`, `respond_to_offer`, `check_in`, `create_decision`, and `submit_application` all use `select … for update` and/or `pg_advisory_xact_lock` plus unique constraints or `on conflict do nothing`, and were read end-to-end to confirm double-submits return the existing result or a clean conflict rather than creating duplicates.
- **Cross-cycle/cross-owner tampering is blocked at the RPC layer even where the route's own check is weaker.** `submit_application` regex-validates that `resume_storage_path` is prefixed with the caller's own `auth.uid()` and requires the storage object to actually exist; `create_decision` cross-checks `application.cycle_id = target_cycle_id` server-side even though the route trusts the client-supplied `cycleId` for its own permission check.
- **No unhandled Supabase `{ data, error }` destructuring bugs found.** Every RPC call site checked either checks `error` explicitly or is written such that an early-return guard (e.g. requiring a non-empty derived field) makes an unchecked `error` unreachable before use.
- **Error responses do not leak stack traces or raw Postgres error text.** `mapRpcError` always returns a fixed client-safe message, uses the error's `code` only to choose an HTTP status, and every RPC failure is `console.error`'d server-side with the real error object first.

## Verification

- `npm run lint` — clean, no errors or warnings (after `npm install`, node_modules was absent at audit start).
- `npx tsc --noEmit` — clean, no errors.
- `npm test` — 42/42 passing (4 API-route test files: `apply`, `apply/resume` (start/finalize/cancel), `contact`, `health`; the remaining ~30 routes have zero direct tests).

## Test Coverage Gaps, Ranked by Blast Radius

1. **`admin/rush`, `admin/decisions`, `admin/screening`** — the highest-consequence admin mutation surface (membership grants, cycle/round/application status transitions, decision creation/approval/release) has zero route-level tests; correctness currently rests entirely on the RPC layer and manual QA.
2. **`admin/setup`** — zero tests, and per the HIGH finding above, its authorization currently depends entirely on the RPC.
3. **`auth/login`, `auth/signup`, `auth/reset-password`, `auth/forgot-password`, `account/password`** — the full credential lifecycle (including the recovery-marker single-use cookie logic) has no route-level tests, only the underlying `recovery-marker.test.ts` unit tests.
4. **`applicant/rsvp`, `applicant/offer`, `applicant/buddy`, `applicant/survey`, `checkin/[token]`** — the entire applicant self-service state-changing surface is untested at the route level.
5. **`member/*`** — evaluations, screening, impressions, conflicts, buddy slot creation: untested at the route level.
6. **`admin/export`** — CSV generation (including the CSV-injection guard `csvEscape`) has no test exercising a formula-prefixed field end-to-end.
7. **`events/[id]/ics`** — no test for the RFC 5545 escaping gap noted above or for the not-found path.
