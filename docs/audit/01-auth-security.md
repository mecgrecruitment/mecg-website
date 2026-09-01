# Section 1 audit: authentication, session, and authorization

Scope: `src/proxy.ts`, `src/lib/auth*.ts`, `src/lib/rate-limit.ts`, `src/lib/env.ts`,
`src/lib/recovery-marker.ts`, `src/lib/supabase/**`, `src/app/api/auth/**`,
`src/app/api/admin/{login,logout,setup}`, `src/app/api/account/password`,
`src/app/auth/callback`, `src/app/{login,forgot-password,reset-password,access-denied}`,
`src/app/api/checkin/[token]`, `src/app/applicant/[token]`, plus every route/page these
reference (`/api/admin/**`, `/api/member/**`, `/api/applicant/**`, `/api/apply/**`,
`/admin/**`, `/member/**`, `/applicant`, `/apply`) to check the enforcement claims end to end.

## Verdict

This is a well-built auth layer: every server route re-derives authorization itself
(`currentUser()`/`requireAdmin()`/`hasPermission()`) rather than trusting the Next.js
middleware, so the several routes the proxy matcher does not cover (`/api/applicant/**`,
`/api/apply/**`) are not actually open; the check-in and password-reset token schemes are
sound (256-bit tokens, SHA-256 digests at rest, single-purpose HMAC markers, DB-enforced
time windows); rate limiting is genuinely DB-backed (`rush.check_rate_limit`, a Postgres
table keyed by bucket) rather than the in-memory-per-process anti-pattern the brief asked
me to check for; and every service-role client instantiation I found is guarded by
`import "server-only"`, DB-side `revoke ... from authenticated` grants, or both. The two
real problems are systemic rather than a missing `if`: the Supabase SSR cookie (both
access and refresh token) is not `HttpOnly` because the browser client is used for a
direct-to-storage resume upload, so any XSS anywhere in the app is a full session and
refresh-token theft, not just a UI defacement; and `/api/account/password` is the one
credential-bearing endpoint in the codebase with no rate limit on its
`signInWithPassword` re-authentication check, breaking the pattern every sibling endpoint
follows. Everything else below is LOW/informational or explicitly deferred to the
database audit.

## Route / role enforcement table

| Route | Who can reach it | Enforced where |
|---|---|---|
| `GET /login`, `GET /forgot-password`, `GET /reset-password` | Anyone | Public by design; proxy exempts `/login`; `/forgot-password` and `/reset-password` aren't in the proxy matcher at all (see LOW finding) but need no gate |
| `POST /api/auth/login` | Anyone | Self: credential check + `checkRateLimit` (IP + email bucket, fail-open) |
| `POST /api/auth/signup` | Anyone | Self: validation + `checkRateLimit` (IP, fail-closed) |
| `POST /api/auth/logout` | Any request (no auth required to call) | `supabase.auth.signOut()` is a no-op without a session; not a vuln |
| `POST /api/auth/forgot-password` | Anyone | Self: `checkRateLimit` (IP + email, fail-closed); always returns `{ok:true}`, no enumeration |
| `POST /api/auth/reset-password` | Holder of a valid Supabase session **and** a same-request recovery marker cookie | Self: `getUser()` + `recoveryMarkerValid()` (HMAC, 15 min TTL, path-scoped cookie) |
| `GET /auth/callback` | Anyone with a valid Supabase `code` param | Self: `exchangeCodeForSession`; destination is a closed enum, no open redirect |
| `POST /api/admin/login`, `POST /api/admin/logout` | Anyone | Re-exports of `/api/auth/login` and `/api/auth/logout` — same enforcement |
| `POST /api/admin/setup` (`create_cycle`) | Any authenticated user at the app layer | App only checks `currentUser()`; **OWNER-only check lives in the `rush.create_cycle` SQL function** (`supabase/migrations/20260831020000_fix_profile_reads_and_create_cycle.sql:75-77`) — DB-enforced, verified in migration, not app code |
| `POST /api/account/password` | Any authenticated user (own password only) | Self: `currentUser()` + `signInWithPassword` re-check; no rate limit (finding below) |
| `POST /api/checkin/[token]` | Any authenticated user holding a valid per-event token | Self: `currentUser()`; token validity, check-in window, cycle status, and membership/application requirement all enforced inside `rush.check_in` (security definer) |
| `GET /applicant/[token]` | Anyone | Dead route, unconditional `redirect("/applicant")`, no token is ever read |
| `/admin/**` pages | OWNER/BOARD/PANEL/RECRUITMENT_COMMITTEE with `WORKSPACE_ACCESS` | `requireAdmin()` in every page under `src/app/admin/**` (verified each file), plus per-page `hasPermission()` narrowing (e.g. `HASH_PANEL_ACCESS` in `admin/hash/page.tsx`) |
| `/member/**` pages | Any active membership with `WORKSPACE_ACCESS` | `requireMember()` in every page under `src/app/member/**` |
| `/applicant` page | Authenticated user whose `resolveAuthDestination()` result is exactly `/applicant` | `requireUser()` + explicit `if (destination !== "/applicant") redirect(...)` — correctly rejects a BOARD/MEMBER user who navigates here directly |
| `/apply` page | Authenticated user whose destination is `/apply`, or anonymous (signup form) | Same `currentDestination()` re-derivation pattern |
| `/api/admin/**` (decisions, events, export, rush, screening, applications/*/resume) | Per-action `hasPermission()`/`selectAuthorizedCycleId()` check against the caller's memberships for that specific `cycleId` | Self-enforced in every handler I read; also DB RPC-level checks (security definer functions) as second layer |
| `/api/member/**` (buddy, conflicts, evaluations, impressions, screening) | Authenticated member | Self: `currentUser()`; fine-grained ownership (e.g. "is this my assignment") enforced inside the RPCs — DB audit should confirm this, not re-derived from app code here |
| `/api/applicant/**`, `/api/apply/**` | Authenticated applicant | Self: `currentUser()` in every handler, even though these paths are **not** in the proxy `matcher` (see LOW finding — currently harmless because every handler self-checks) |
| `/api/contact`, `/api/interest`, `/api/events/[id]/ics`, `/api/health` | Public | Intentionally unauthenticated; rate-limited (contact, interest) or read-only public data (ics, health) |
| `/api/maintenance/prune-resumes` | Vercel Cron only | `CRON_SECRET` bearer check, fails closed if unset; explicitly documented as not CSRF-reachable since it ignores cookies |

## Findings

### [HIGH] Session cookie is not `HttpOnly`, so any XSS is a full session/refresh-token theft
`src/lib/supabase/server.ts:9`, `src/lib/supabase/proxy.ts:9`, `src/lib/supabase/admin.ts` (n/a), `src/app/apply/application-form.tsx:206-207`

None of `createServerClient(...)` call sites in this codebase pass `cookieOptions`, so the
Supabase SSR library's `DEFAULT_COOKIE_OPTIONS` apply, which set `httpOnly: false` (verified
against the installed `@supabase/ssr` package: `dist/main/utils/constants.js` —
`{ path: "/", sameSite: "lax", httpOnly: false, maxAge: 400 days }`, applied through
`applyServerStorage`/`createStorageFromOptions` whenever no override is supplied). This is
not an accidental omission: `src/app/apply/application-form.tsx` uses the *browser*
Supabase client (`src/lib/supabase/client.ts`) to upload resumes directly to Storage from
the client, which requires the browser-side SDK to read the session token out of
`document.cookie` — that only works if the cookie is JS-readable. So the architecture as
built requires `httpOnly: false` on the `sb-<ref>-auth-token` cookie carrying both the
access and refresh token.

**Impact**: any XSS anywhere in the app (not just in the files audited here) becomes
immediate full account takeover — an attacker script reads `document.cookie` and gets a
working, long-lived (400-day default `maxAge`) refresh token, not just a short-lived access
token. This is more severe than the typical "XSS steals a session" case because the refresh
token is also exposed.

**Fix**: change the resume-upload path to go through a server-issued signed upload URL
(mirroring the pattern already used for downloads via `createSignedUrl` in
`src/app/api/admin/applications/[id]/resume/route.ts` and
`src/app/api/apply/resume/route.ts`), so the browser never needs to hold a JS-readable
session token. Then set `cookieOptions: { httpOnly: true }` on every `createServerClient`
call (`server.ts`, `proxy.ts`) so the auth cookie can no longer be read by any script.

### [MEDIUM] `/api/account/password` has no rate limit on the re-authentication check
`src/app/api/account/password/route.ts:19-22`

Every other endpoint in this codebase that calls `supabase.auth.signInWithPassword` or
otherwise checks a credential (`/api/auth/login`) wraps it in `checkRateLimit`. This route
does not import `rate-limit.ts` at all. It requires an existing valid session
(`currentUser()` gate above it), so it is not an anonymous credential-stuffing endpoint,
but it is an unthrottled oracle for guessing the account's *current* password from inside
an already-authenticated session (e.g. a session obtained via a short-lived stolen cookie,
or a request forged through some other bug) — falling back only on Supabase Auth's
project-wide GoTrue rate limit, which is not tuned per-endpoint by this app the way its
sibling limiter is.

**Fix**: add `checkRateLimit(`account-password:${user.id}`)` before the
`signInWithPassword` call, same pattern as `reset-password`'s
`checkRateLimit(\`reset-password:${clientIp(request)}\`)`.

### [LOW] `/api/applicant/**` and `/api/apply/**` are outside the proxy matcher
`src/proxy.ts:26-38`

The `matcher` array only covers `/api/admin/:path*`, `/api/member/:path*`, and
`/api/account/:path*` (plus the auth/page routes). `/api/applicant/**` and `/api/apply/**`
never run through `refreshSupabaseSession`. I verified every handler under those two
directories (`buddy`, `offer`, `rsvp`, `survey`, `draft`, `resume`, `resume/start`,
`resume/finalize`, `resume/cancel`, and `apply/route.ts` itself) calls `currentUser()`
itself and returns 401 without it, so this is currently **not exploitable** — it's a
defense-in-depth gap, not a broken authorization gap. The risk is purely that a future
route added under either prefix could silently ship without an auth check and nothing
would catch it before production, since the middleware isn't the safety net for these two
prefixes the way it is for `/api/admin`, `/api/member`, and `/api/account`.

**Fix**: add `/api/applicant/:path*` and `/api/apply/:path*` to the matcher (mirroring how
`/api/member/:path*` is already handled) so a future route without its own `currentUser()`
check still 401s instead of leaking data.

### [LOW] `/forgot-password` and `/reset-password` pages are outside the proxy matcher
`src/proxy.ts:26-38`

Same category as above but for pages rather than API routes: `/forgot-password` and
`/reset-password` are not in `matcher`, so `refreshSupabaseSession` never runs for them.
This is harmless today because neither page component reads `currentUser()`/session state
server-side (`src/app/reset-password/page.tsx` and `src/app/forgot-password/page.tsx` are
pure client-form wrappers) and the actual authorization work happens inside the API route
handlers they call, which do their own checks. Flagging only so it isn't mistaken for
proxy coverage if either page gains server-side logic later.

### [LOW] `EMAIL_NOT_CONFIRMED` login response leaks whether an email is registered but unconfirmed
`src/app/api/auth/login/route.ts:28-30`

Wrong-password and unknown-email both return `INVALID_CREDENTIALS`, which is correct
anti-enumeration behavior. But a registered-and-unconfirmed email returns the distinct
code `EMAIL_NOT_CONFIRMED`, which confirms the email exists in the system. This is a minor,
common UX/security tradeoff (most apps make this same call) and I'm not aware of a
practical attack it enables beyond confirming an email was used to sign up — noting it
only because it's a deliberate deviation from the otherwise-consistent no-enumeration
policy used everywhere else (forgot-password always returns `{ok:true}`; signup relies on
Supabase's own no-enumeration behavior for already-registered emails, verified by reading
`signUp`'s handling in `src/app/api/auth/signup/route.ts:46-48`, which treats "already
registered, needs confirmation" and "genuinely new, needs confirmation" identically via
`!data.session`).

## Deferred to the database audit

- Fine-grained row ownership inside RPCs (e.g. that `submit_evaluation`,
  `declare_conflict`, `book_buddy_slot`, `rsvp_slot` etc. only let a member act on their
  own assignment/slot, not an arbitrary one) is enforced inside `security definer`
  Postgres functions, not app code. I did not re-derive each function body's row-level
  guard from migrations; the app-side handlers correctly pass through whatever id the
  RPC's own logic is trusted to check.
- Whether Supabase Auth project settings actually have "Confirm email" enabled (this is
  what makes the signup no-enumeration behavior in `signup/route.ts` hold in practice —
  if confirmation were disabled, `data.session` would be non-null immediately on
  duplicate-email signup attempts, which would then hit `auth.signUp`'s own error path
  instead and could behave differently). This is a dashboard/project setting, not app code.
- Whether `rush.rate_limits` prune job (`rush.prune_rate_limits`) is actually scheduled to
  run (referenced from `supabase/migrations/20260831190000_schedule_prune_jobs.sql`,
  outside this section's file scope) — unbounded row growth in that table is a DB
  operational concern, not an auth vulnerability.

## Nothing found

- No hardcoded secrets, API keys, or passwords in any file in scope.
- Service-role key (`SUPABASE_SERVICE_ROLE_KEY`/`MECG_SUPABASE_SERVICE_ROLE_KEY`) is only
  ever read via `requireSupabaseServiceRoleKey()`/`getSupabaseServiceRoleKey()`, and the
  only client factory that uses it (`src/lib/supabase/admin.ts`) is marked
  `import "server-only"`. Every call site that imports it either statically imports
  `admin.ts` from a `route.ts` (server-only by construction in the App Router) or, in
  `rate-limit.ts`, imports it dynamically specifically to avoid pulling `server-only`
  into any accidental client bundle. No path to `NEXT_PUBLIC_*` or client bundles found.
- Every service-role usage found (`admin.auth.admin.createUser`, `.listUsers`,
  `.deleteUser` in `api/admin/rush`; `finalize_resume_upload` RPC in
  `apply/resume/finalize`; `check_rate_limit` RPC; `prune-resumes` cron job) is backed by
  a DB-side `revoke ... from authenticated` / `grant ... to service_role` pair, confirming
  these are genuinely privileged operations and not cases where the anon/RLS client
  should have been used instead.
- Check-in token: 256 bits of randomness (`gen_random_uuid()::text || gen_random_uuid()::text`),
  only the SHA-256 digest is stored (`checkin_token_digest`), the plaintext token is
  returned once at creation/rotation and never persisted. `rush.check_in` enforces the
  check-in time window, cycle status, and membership/application requirement, and is
  idempotent (`on conflict ... do nothing`) — no replay concern beyond "check in again",
  which is the intended behavior.
- Password reset flow: no token reuse (recovery marker is single-use, cleared on success
  by the response setting `maxAge: 0`), no open redirect (both the callback's destination
  values and the login form's `router.replace(body.destination)` target are drawn from a
  closed enum returned by `resolveAuthDestination`, never from a user-supplied `next`/
  `redirect` query parameter).
- Rate limiting is DB-backed (`rush.rate_limits` table + `rush.check_rate_limit` security
  definer function, `EXECUTE` restricted to `service_role`), not per-process in-memory —
  it survives serverless cold starts and multiple instances, which is the failure mode
  the brief asked me to check for.
- Cookie `Secure` flag is correctly conditioned on `NODE_ENV === "production"` everywhere
  it's set explicitly (recovery marker cookie, both set and clear).
- Logout (`/api/auth/logout`) calls `supabase.auth.signOut()` server-side, which revokes
  the refresh token and clears cookies via the `setAll` callback — not a client-only
  logout.
- No stack traces, raw Postgres error messages, or Supabase error objects are ever
  returned to the client; `mapRpcError` and every route handler I read log the raw error
  server-side (`console.error`) and return a generic `{ error: string }` mapped from a
  small error-code allowlist.
- Error handling matches the project skill's checklist: every `catch`/error branch either
  logs and returns a generic message, or (in `login`, `signup`) explicitly signs the user
  back out on a downstream failure rather than leaving a half-authenticated state.
