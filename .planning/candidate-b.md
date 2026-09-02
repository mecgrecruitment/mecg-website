# Candidate B: Clerk at the edge, UUID identity in the domain

## Problem

Replace Supabase Auth with Clerk for signup, verification, password login, recovery, sessions, bot protection, and email delivery while retaining Supabase Postgres, Storage, RLS, and the existing recruitment authorization model. The repository makes this non-trivial: `rush.profiles.id` is the application identity, many domain foreign keys are UUIDs, 48 migration files contain 257 `auth.uid()` calls, 12 migration files reference `auth.users`, one browser flow uploads directly to Storage, and 56 application files enter through `currentUser`/`require*`. Clerk's native Supabase integration supplies a string `sub`; `auth.uid()` attempts to cast that value to UUID. Existing password users must retain their password where possible, and production must remain unchanged until a stop/go gate passes.

## Grounded current flow

Today `/api/auth/signup`, `/api/auth/login`, `/api/auth/forgot-password`, `/api/auth/reset-password`, `/api/auth/logout`, and `/auth/callback` own Supabase Auth. `src/proxy.ts` refreshes the Supabase cookie and performs coarse route protection. `src/lib/auth.ts` calls `supabase.auth.getUser()`, then loads the UUID profile and memberships; pages and handlers rely on its `currentUser` and `require*` functions for application authorization. `src/lib/supabase/server.ts` forwards the Supabase cookie to PostgREST/RPC/Storage, while `src/lib/supabase/client.ts` does the same implicitly in the browser. RLS and RPCs derive the UUID actor through `auth.uid()`. The signup trigger in `20260821100000_auth_profiles.sql` creates `rush.profiles` from `auth.users`; several other domain tables still reference `auth.users` directly. Applicant resume replacement uploads directly from the browser, so a server-only token conversion would be incomplete.

## Usage (caller's view)

The common caller keeps using domain identity and never handles Clerk users, JWT claims, issuers, or identity-map rows:

```ts
// Server Component: unchanged caller shape.
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function MemberPage() {
  const user = await requireMember();
  const supabase = await createClient(); // Clerk token is attached internally.
  const { data, error } = await supabase.rpc("my_grading_events");
  // user.id is the stable UUID application identity.
}
```

```ts
// Route Handler: authentication remains beside the protected operation.
export async function POST(request: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = await createClient();
  return saveForActor(supabase, user.id, request);
}
```

```tsx
// The one direct browser-to-Storage path obtains a token-aware client via a hook.
"use client";
import { useSupabaseClient } from "@/lib/supabase/browser";

function ResumeReplace() {
  const supabase = useSupabaseClient();
  // Storage RLS resolves the same UUID actor as server requests.
  // await supabase.storage.from("resumes").upload(path, file, options)
}
```

Authentication screens delegate the complete transaction to Clerk and redirect to one application-owned router afterward:

```tsx
// /login and /apply/account use Clerk-hosted components with MECG appearance settings.
<SignIn forceRedirectUrl="/post-auth" />
<SignUp forceRedirectUrl="/post-auth" />

// /post-auth is the only post-auth routing entry point.
export default async function PostAuthPage() {
  redirect(await currentDestination() ?? "/login");
}
```

The provisioning seam is server-only and is not available to ordinary feature callers:

```ts
type Issuer = string & { readonly __brand: "Issuer" };
type ExternalSubject = string & { readonly __brand: "ExternalSubject" };
type AppUserId = string & { readonly __brand: "AppUserId" }; // validated UUID

type VerifiedExternalPrincipal = Readonly<{
  issuer: Issuer;
  subject: ExternalSubject;
  primaryEmail: string;
  displayName: string;
}>;

// Input may only be constructed from Clerk's verified server auth result plus currentUser().
async function ensureAppIdentity(
  principal: VerifiedExternalPrincipal,
): Promise<AppUserId>;
```

## Shape

### Core identity model

Keep the UUID application identity as the sole key visible to recruitment code. Add an external-identity map rather than changing domain keys to Clerk strings:

```sql
create table rush.auth_identities (
  issuer text not null,
  subject text not null,
  app_user_id uuid not null references rush.profiles(id),
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (issuer, subject),
  unique (issuer, app_user_id)
);

create function rush.actor_id() returns uuid ...;
-- Reads the verified request JWT's exact (iss, sub), returns the mapped UUID only
-- when the mapping is enabled, and otherwise returns NULL. It never casts sub.
```

Use exact issuer plus subject, not a bare Clerk ID or a generic provider label. That prevents a development Clerk instance, a second Clerk tenant, or a rollback Supabase issuer from colliding with production. Backfill one mapping for each existing Supabase user and one for each successfully imported Clerk user. The UUID remains the single source of truth for memberships, applicants, assignments, audit actors, storage ownership, and idempotency receipts.

`rush.actor_id()` is a small, stable, `security definer` boundary with `search_path = ''`. It reads `auth.jwt()->>'iss'` and `auth.jwt()->>'sub'`, performs an indexed lookup, and returns null for missing, disabled, or malformed claims. Revoke table access from `anon`/`authenticated`; grant only function execution required by policies. `anon` must receive null. Tests must demonstrate that a forged/unconfigured issuer, a known subject under the wrong issuer, and an unmapped subject all fail closed. This concentrates external-token knowledge in one database module, per boundary-discipline and minimize-reader-load.

Convert every **live** policy, function, trigger, view, and Storage policy from `auth.uid()` to `rush.actor_id()`. Do this from a catalog inventory rather than a blind migration-file replacement: historical migrations may contain superseded definitions, while live objects are the security boundary. Add a CI/catalog assertion that no live object in application schemas depends on `auth.uid()` or joins `auth.users`. Fresh-database replay still must finish with that assertion passing.

Drop domain foreign keys to `auth.users` and repoint them to the application-owned profile identity where the referenced UUID denotes an application actor. This includes `profiles`, applicant linkage, audit actors, mutation receipts, reminders, project staffing, resume ownership, and event-grading actors. Preserve nullable/on-delete behavior deliberately; Clerk deletion should disable access and retain recruitment/audit history, not cascade-delete it. Keep the existing `pnms.auth_user_id` column name during the auth cutover because renaming it would enlarge the security migration and can break PL/pgSQL bodies; record a later domain-language cleanup to `app_user_id` after stabilization.

### Server identity boundary

Keep `src/lib/auth.ts` as the deep application-facing module:

```ts
export type CurrentUser = Readonly<{
  id: AppUserId;
  email: string;
  name: string;
  active: boolean;
  memberships: readonly CurrentMembership[];
}>;

export async function currentUser(): Promise<CurrentUser | null>;
export async function currentDestination(): Promise<AuthDestination | null>;
export async function requireUser(): Promise<CurrentUser>;
export async function requireMember(): Promise<CurrentUser>;
export async function requireAdmin(): Promise<CurrentUser>;
export async function requireBoard(): Promise<CurrentUser>;
```

Internally, `currentUser()` obtains the verified Clerk session with `await auth()`, loads the Clerk user only when profile fields are needed, validates issuer/subject/email/name into domain types, idempotently resolves or provisions the UUID identity, then loads profile and memberships through the Clerk-token Supabase client. Existing authorization remains in `hasPermission`; Clerk metadata and organizations do **not** become authorization sources. This preserves the 56 callers and ensures no feature module compares Clerk roles or IDs.

Provisioning is synchronous on the first authenticated application request, with the webhook as reconciliation rather than a prerequisite:

1. If `(issuer, subject)` exists and is enabled, return its UUID.
2. If no mapping exists but the email belongs to an existing `auth.users` record, fail with an `IDENTITY_LINK_REQUIRED` operational error. Never auto-link by email; the import/backfill ledger must make that association explicitly.
3. Otherwise atomically create a new UUID profile plus identity map and return it.
4. Concurrent repeats return the same UUID through unique constraints and retry/read-after-conflict behavior.

Implement the atomic transition as one service-role-only database RPC called by a `server-only` module. Only that module may translate a verified Clerk principal into RPC parameters. The RPC must not be executable by `authenticated` or `anon`, and logs must never contain tokens, password digests, secret keys, or full import payloads.

Handle `user.created`, `user.updated`, and `user.deleted` at `/api/webhooks/clerk`. Verify the webhook before parsing trusted fields, record the Clerk event ID for idempotency, call the same provisioning/reconciliation operation, and mark identities disabled plus profiles inactive on deletion. A webhook may arrive before, during, or after the first request without changing the result. Do not cascade-delete historical application or audit data.

### Supabase token adapters

`src/lib/supabase/server.ts` remains one deep factory. It obtains `(await auth()).getToken()` and passes it through the Supabase `accessToken` callback; absent sessions produce an anonymous client. It no longer manages Supabase Auth cookies. `src/lib/supabase/browser.ts` exposes `useSupabaseClient()`, uses Clerk's session token internally, and memoizes the Supabase client. The only current browser caller is resume replacement. Transport types and raw token callbacks remain private to these factories.

Do not make callers coordinate `getToken()`, `createClient()`, and provisioning. That would be a shallow temporal API and would leak Clerk into every data caller. Also do not wrap every Supabase method: the client factory adds real policy/token adaptation, while query capability stays with the existing typed Supabase client.

### Next.js and authentication UX

Install a Next-16-compatible `@clerk/nextjs`, wrap the root layout body in `ClerkProvider`, and replace `src/proxy.ts` with `clerkMiddleware` using the documented `proxy.ts` matcher. Proxy performs coarse authentication only. Server Components, Route Handlers, and Server Actions continue to enforce identity/role beside each operation through `currentUser`/`require*`; do not trust matcher coverage for authorization.

Use Clerk's prebuilt sign-in, sign-up, password recovery, verification, and user-profile/password-management surfaces first. Configure applicant signup to collect the display name required by the app, Smart bot protection, verified production sending domain, password rules, lockout, and enumeration protection. Remove the old `/api/auth/*` flows, recovery marker, callback, Supabase-cookie refresh, and application signup/login IP limiters only after Clerk is active; keeping them on the active path would retain the bottleneck Clerk is meant to remove. Keep rate limits for non-auth operations such as application submission and resume workflows.

Clerk's published signup/sign-in limits are short per-IP bursts, not an hourly two-email ceiling, but campus NAT remains a load-test requirement. Obtain a written production-throughput answer from Clerk for the expected peak before the stop/go gate.

### Module map

| Module | Owns | Must not own |
|---|---|---|
| `src/lib/auth.ts` | Current UUID user, membership loading, destination, require helpers | Clerk UI, raw JWT parsing, database service key |
| `src/lib/identity/clerk-server.ts` (`server-only`) | Verified Clerk principal conversion and idempotent UUID provisioning | Recruitment authorization or feature queries |
| `src/lib/supabase/server.ts` | Server Supabase client with Clerk access token | User provisioning or permission policy |
| `src/lib/supabase/browser.ts` | Hook returning browser Supabase client with Clerk token | Generic auth state or UI |
| `src/proxy.ts` | Coarse protected-route/session middleware | Role decisions or sole authorization enforcement |
| `src/app/post-auth/page.tsx` | One post-auth destination redirect | Identity mapping rules |
| `src/app/api/webhooks/clerk/route.ts` | Signature verification and event dispatch | Non-idempotent profile lifecycle logic |
| `rush.auth_identities`, `rush.actor_id()` | External `(iss, sub)` to domain UUID boundary | Email/profile truth or role assignment |
| Existing `rush.memberships` + `hasPermission` | Domain authorization | Clerk roles/organizations/metadata |
| One forward identity migration | FK repointing and all live RLS/RPC/Storage rewrites | Password import or Clerk API calls |
| `scripts/migrate-auth-users.*` | Auditable export/import/backfill ledger, resume and dry-run | Runtime signup or webhook processing |

The public interfaces are intentionally small: feature code sees `CurrentUser`, `require*`, and a typed Supabase client. They hide session validation, token attachment, issuer isolation, UUID mapping, concurrency, and lifecycle reconciliation. The call chain for an ordinary protected operation remains caller -> auth/client boundary -> database, with no pass-through service layer.

## Synthesis decision

Two structurally distinct shapes were considered.

**Shape 1: database identity map (chosen).** Clerk authenticates a string subject; one `(issuer, subject) -> UUID` table and `rush.actor_id()` adapt it to the existing domain. This has the deepest interface: application and database callers keep using one UUID actor while provider and token complexity is hidden at two boundaries.

**Shape 2: Clerk IDs become domain primary keys.** Convert profiles, memberships, applicants, assignments, audit records, projects, reminders, receipts, Storage paths, RPC parameters, and generated types from UUID to text. This removes the lookup but exposes Clerk's identifier representation across nearly every caller and persisted object, produces the largest migration blast radius, and makes rollback/provider replacement harder. It was rejected.

A metadata-claim variant was also screened: import the UUID into Clerk metadata and add it to each session token. It avoids a lookup but makes authorization depend on Clerk metadata synchronization and token refresh timing, consumes custom-claim budget, and duplicates the mapping source across Clerk and Postgres. It was rejected in favor of a database-owned authorization mapping.

Red-flag screen: the chosen shape has no multi-step public auth protocol (no shallow module), external claims do not escape the identity boundary (no information leakage), provisioning and reconciliation share one identity-owned operation rather than load/validate/save modules (no temporal decomposition), and the Supabase factories add token policy rather than merely forwarding arguments (no pass-through layer).

## Staged implementation plan

### Stage 0 — inventory and measurable acceptance criteria (no production change)

1. Generate a live catalog inventory of policies, functions, views, triggers, grants, foreign keys, Storage policies, Realtime use, and seed/test fixtures coupled to `auth.uid()`, JWT claims, Supabase cookies, or `auth.users`.
2. Record current signup, verification, login, reset, RLS denial, and resume-upload behavior. Define rush-night peak concurrency, shared-IP shape, acceptable p95/p99 response time, email-delivery target, and error budget.
3. Obtain Clerk production limits/support confirmation, pricing/MAU expectations, DNS ownership, retention requirements, and production instance ownership.
4. Produce a reversible data report: every `auth.users` UUID, primary email, verification state, identity type, profile presence, and every domain FK. Report only counts and opaque IDs outside the secured migration environment.

Exit: catalog inventory is complete and every existing UUID has a disposition; otherwise do not estimate or implement the security migration.

### Stage 1 — make the database provider-neutral while Supabase Auth still runs

1. Add `rush.auth_identities` and backfill the current Supabase issuer/UUID subjects to the same UUID.
2. Add and harden `rush.actor_id()`.
3. Repoint domain FKs from `auth.users` to the canonical application profile identity without changing UUID values.
4. Recreate every live policy/function/view/trigger/Storage rule to use `rush.actor_id()`; preserve grants, volatility, `security definer`, and `search_path` deliberately.
5. Update SQL tests to issue claims containing exact issuer and subject. Add catalog assertions for zero live `auth.uid()`/`auth.users` dependencies.
6. Run fresh migration replay, linked/local database tests, SQL lint, generated-type diff review, workflow verification, and existing app tests.

Exit: the unmodified Supabase Auth app passes all behavior against `rush.actor_id()`. Rollback is the inverse forward migration or restoring the prior deployment before any Clerk user is admitted.

### Stage 2 — Clerk development spike and migration rehearsal

1. Create a disposable Clerk development instance and enable native Supabase third-party auth for a disposable/local Supabase environment. Do not use the deprecated Supabase JWT template.
2. Implement the Clerk server identity seam, token-aware server/browser clients, webhook verification, and idempotent provisioning behind development-only configuration.
3. Replace auth UI/routes in the worktree; keep application authorization unchanged. Verify the direct browser Storage upload specifically.
4. Build a resumable, dry-run-first import tool. Import primary email and verification state, bcrypt `passwordDigest` with `passwordHasher: "bcrypt"`, and old Supabase UUID as Clerk `externalId`; then write the explicit Clerk `(issuer, subject)` mapping to the old UUID. Never log or commit digests.
5. Pilot synthetic users, then a small approved sample of real hash formats. Test unchanged-password sign-in, duplicate email behavior, unverified users, social-only identities, disabled users, Unicode names, and retry/resume after partial failure.

Exit: all four research gates pass—unchanged-password login, native Clerk-token RLS, old-record UUID continuity plus new-user creation without `auth.users`, and agreed NAT/email burst behavior.

### Stage 3 — production-ready rehearsal, still no public cutover

1. Create the separate Clerk production instance; configure verified sending domain (SPF/DKIM and DMARC policy), exact allowed origins/redirects, Smart bot protection, password/lockout rules, and webhook secret.
2. Rehearse a complete export/import/backfill in an isolated production-like database from a recent sanitized/secured snapshot. Reconcile counts by state; require zero unexplained mismatches.
3. Run full unit, route, proxy, SQL/RLS, Storage, webhook replay, fresh-schema, end-to-end, accessibility, and load suites. Exercise Clerk `429` handling with `Retry-After` and provider outage behavior.
4. Prepare dashboards and alerts for signup completion, verification latency, password-login failure, reset completion, Clerk 429/5xx, webhook lag/retry, identity conflicts/unmapped claims, RLS denials, and support volume.
5. Freeze identity-schema changes and prepare an immutable old deployment artifact plus rollback runbook. Schedule cutover outside the application rush and before public registration opens.

Exit: a timed rehearsal completes inside the maintenance window and the rollback rehearsal restores Supabase Auth for internal canary users.

### Stage 4 — controlled production cutover

1. Briefly freeze signup/password mutation; take the final user export.
2. Import/upsert Clerk users, backfill mappings, and reconcile counts before accepting traffic.
3. Enable Clerk native integration in Supabase and deploy the database-neutral schema plus Clerk app release as the rehearsed coordinated unit.
4. Force reauthentication because Supabase sessions cannot become Clerk sessions. Start with internal canaries, then a bounded applicant cohort, then open traffic.
5. Keep `auth.users` and the old deployment artifact read-only and intact through the recovery window. Do not delete Supabase auth data or secrets during cutover.

Exit: monitoring remains within thresholds for the defined soak period and support confirms critical user journeys.

### Stage 5 — retire only after the recovery window

Remove obsolete Supabase Auth routes, callback/recovery marker, cookie proxy helper, auth-only rate-limit buckets/functions, auth-user triggers, old UI/tests, and finally unused auth secrets. Keep the domain UUID map as permanent architecture. Supabase Auth itself may remain enabled at platform level if it cannot be disabled, but no application path should use it. Rename misleading domain columns such as `pnms.auth_user_id` only as a separate, independently verified cleanup.

## Verification matrix

| Boundary | Required proof |
|---|---|
| Identity resolution | Correct issuer+subject maps to one UUID; wrong issuer, missing subject, disabled identity, and unmapped identity yield no actor |
| Concurrency | First request and webhook in either order, duplicates, and retries create exactly one profile/mapping |
| Authorization | Existing member/applicant/admin/conflict/recusal tests produce the same allow/deny decisions under Clerk tokens |
| Database completeness | Catalog query finds no live `auth.uid()` or `auth.users` dependency; fresh migration replay agrees |
| Storage | Applicant can upload only to UUID-owned path; another user and anon cannot read/write it |
| Existing users | Imported bcrypt user signs in unchanged; UUID-linked applications, memberships, audit records, and files remain accessible |
| New users | Clerk signup, verification, first request, profile creation, application routing, and reset complete without an `auth.users` row |
| Auth UX | Login, signup, resend, recovery, change password, logout, lockout, bot challenge, expired links/codes, and accessible errors |
| Webhooks | Invalid signature rejected; duplicate/reordered events idempotent; deletion disables access without deleting history |
| Capacity | Expected peak and shared campus NAT meet agreed p95/p99 and delivery targets; 429 UI respects retry timing |
| Rollback | Before public opening, old artifact plus untouched Supabase users restores internal sign-in and all UUID authorization |

Repository verification commands to retain and extend are `npm test`, `npm run test:e2e`, `npm run test:supabase:local` (and linked when authorized), `npm run check:sql`, `npm run verify:workflow`, `npm run verify:auth`, `npm run lint`, and `npm run build`. Record command, exit status, and meaningful result for the implementation handoff.

## Rollback and point of no return

Stages 0–3 are reversible without user-visible identity change. Stage 1 deliberately supports existing Supabase JWTs through issuer mappings, so the old app artifact can continue against the provider-neutral database. During Stage 4 canary, rollback means close Clerk ingress, redeploy the old artifact, restore Supabase Auth routing, and leave Clerk/import mappings for analysis.

Once public users can create Clerk-only accounts or change passwords in Clerk, instant Supabase credential rollback is no longer honest: those accounts/password changes do not exist in Supabase Auth. Therefore the **public registration opening is the point of no return for seamless auth rollback**, not merely the deployment. Cut over outside rush, soak with internal/imported accounts first, and do not open public signup until the stop/go gate passes. A later emergency fallback must keep Clerk authentication while rolling back only application/database changes, or require an explicit account-import/reset incident plan.

## Stop/go gate before public production cutover

GO only with all of the following signed off:

- 100% of in-scope existing users reconcile among Supabase export, Clerk import, and `rush.auth_identities`; zero unexplained duplicate emails or missing profiles.
- A representative production-format bcrypt sample signs in with unchanged passwords; social-only and unverified accounts have documented treatment.
- Catalog audit reports zero live `auth.uid()`/`auth.users` dependencies and all RLS/Storage negative tests pass.
- New-user first-request provisioning and webhook races are proven idempotent; unmapped or wrong-issuer sessions fail closed and alert.
- Expected peak signup/login from the measured campus-NAT model passes the load target, verification email meets the delivery SLO, and Clerk has confirmed production throughput/support escalation.
- DNS, bot protection, password policy, lockout, redirect/origin settings, webhook verification, secret storage/rotation, monitoring, support messaging, and incident owners are ready.
- The internal-canary rollback rehearsal succeeds within the recovery objective, and stakeholders acknowledge that public Clerk-only signup is the seamless-rollback point of no return.

Any failed item is STOP. Continue Supabase Auth unchanged and revise the design or operational assumptions; do not compensate by weakening RLS, auto-linking users by email, minting a legacy JWT template, or bypassing bot/rate protections.

## Tradeoffs accepted

- We accept one indexed identity lookup per RLS actor evaluation in exchange for preserving every UUID domain key and making identity-provider changes local.
- We accept a permanent application identity table in exchange for not making Clerk the source of recruitment authorization truth.
- We accept service-role provisioning code in a narrow server-only module in exchange for synchronous first-request readiness; strict grants, verified principal construction, and idempotency are mandatory.
- We accept keeping the misleading `auth_user_id` column name temporarily in exchange for separating auth cutover risk from a broad PL/pgSQL/domain rename.
- We accept forced reauthentication at cutover in exchange for not attempting to translate live sessions between issuers.
- We accept Clerk-hosted auth UI constraints in exchange for mature verification, recovery, CAPTCHA, resend, and abuse flows with less custom security code.

## Alternatives considered

- **Convert the domain to Clerk text IDs:** hides the lookup but leaks provider representation through the entire schema and caller surface; rejected for blast radius, rollback cost, and shallow provider coupling.
- **Put the UUID in Clerk custom session claims:** gives RLS a direct UUID but duplicates authorization-critical mapping into eventually refreshed metadata and session tokens; rejected because callers and operations must understand claim synchronization.
- **Use webhooks as the only user-sync path:** simplifies the request path but exposes eventual-delivery ordering to every first login; rejected because the caller must then understand and retry an internal provisioning stage.
- **Proxy all Supabase access through Next.js:** avoids browser token integration but turns the app into a pass-through API for PostgREST/Storage and expands latency and maintenance; rejected because the native third-party token path already preserves RLS.
- **Continue Supabase Auth with custom SMTP:** smallest implementation, but the user explicitly does not want that operational model; excluded from this candidate.

## Open questions and risks

- What exact production issuer string appears in Clerk session tokens, and how will preview/development issuers be allowlisted without ever mapping to production identities?
- What are the actual counts and states of password, OAuth-only, unverified, banned, duplicate-email, and orphaned domain users in production?
- Does a pilot confirm Clerk accepts the exact Supabase bcrypt digests and verification state without forcing resets?
- What peak number of signup/sign-in creations shares one campus public IP, and what written capacity/support commitment will Clerk provide?
- Should Clerk own member self-service password changes entirely, and what incident procedure covers password divergence after the no-return point?
- Which user fields are authoritative in Clerk versus `rush.profiles`, and what retention/anonymization behavior is legally and operationally required on deletion?
- Are Realtime channels used in production, and if so do their authorization paths appear in the live catalog inventory and load test?
- Can the database service-role provisioning RPC be restricted further to a dedicated Postgres role or backend function rather than the general service key?
- Which existing social identities can be migrated or safely relinked, and what user messaging is required when they cannot?
- Does Clerk-hosted UI meet MECG branding, accessibility, applicant full-name capture, and destination-routing needs, or is a later custom UI justified after the secure cutover?

## Next implementation step

Build the Stage 0 live database identity-dependency inventory and reconciliation report first; do not add Clerk code until it proves the complete RLS/FK surface and existing-user states.
