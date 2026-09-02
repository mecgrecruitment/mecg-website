# Candidate A: database-mapped Clerk identity

Status: architecture candidate only. This document authorizes no production change.

## Problem

Clerk can take over signup, verification email, password login, password reset, sessions, bot checks, and lockout. Supabase should continue to own Postgres, RLS, RPC authorization, Storage, and the recruitment data. The difficult seam is identity. Clerk emits a string `sub` such as `user_123`, while this database treats a Supabase Auth UUID as the user everywhere: `rush.profiles.id`, applicant ownership, memberships, audit actors, Storage paths, and many SQL functions and policies. Forty-eight migration files contain `auth.uid()`, and current foreign keys still point at `auth.users`. Existing password users also need to keep their passwords and UUID-linked history. A safe migration must change the identity boundary without re-keying the domain.

## Usage, from the caller's view

The application keeps its current authorization vocabulary. Pages and handlers should not handle Clerk subjects, JWT claims, or identity mappings.

```ts
// Server page
import { requireAdmin } from "@/lib/auth";
import { createServerDataClient } from "@/lib/supabase/server";

export default async function AdminPage() {
  const user = await requireAdmin();
  const db = await createServerDataClient();
  const { data } = await db.rpc("member_applicants", {
    target_cycle_id: user.memberships[0].cycleId,
  });
  // user.id is the existing application UUID, never a Clerk user ID.
}
```

```ts
// Route Handler
import { currentUser } from "@/lib/auth";
import { createServerDataClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const db = await createServerDataClient();
  await db.rpc("save_application_draft", { /* domain input only */ });
  return Response.json({ ok: true });
}
```

```tsx
// The one browser-side Supabase caller, resume replacement
"use client";
import { useAuthenticatedDataClient } from "@/lib/supabase/browser";

export function ResumeReplace() {
  const db = useAuthenticatedDataClient();
  // Storage receives the current Clerk session token through accessToken.
}
```

```tsx
// Auth UI
import { SignIn } from "@clerk/nextjs";

export default function LoginPage() {
  return <SignIn fallbackRedirectUrl="/auth/complete" />;
}
```

`/auth/complete` loads or creates the application identity, computes the existing `AuthDestination`, and redirects. Password reset and account password changes use Clerk's prebuilt flows. The old `/api/auth/signup`, `/api/auth/login`, `/api/auth/forgot-password`, `/api/auth/reset-password`, `/api/auth/logout`, and Supabase callback cease to be active entry points.

## Grounded current flow

- `src/proxy.ts` refreshes a Supabase cookie and treats it as the coarse route gate. Next 16.3.1's bundled Proxy guide says Proxy is not the final authorization boundary, so `currentUser()` and the database checks remain mandatory.
- `src/lib/auth.ts` gets the Supabase user, uses that same ID in `profiles` and `memberships`, then derives portal destinations and role access. Sixty-six server modules import the current Supabase server factory. Preserving this caller shape avoids an auth rewrite across the whole app.
- `src/lib/supabase/server.ts` currently transports Supabase Auth cookies. It must instead supply `(await auth()).getToken()` through Supabase's `accessToken` callback. The sole browser factory consumer is `src/app/applicant/resume-replace.tsx`.
- `rush.handle_new_auth_user()` creates `profiles` rows from `auth.users`. Clerk's native integration does not create `auth.users`, so application-user creation must move out of that trigger.
- `rush.profiles`, `pnms.auth_user_id`, mutation receipts, audit actors, reminders, projects, resume documents, and event-grading records have UUID links to `auth.users`. Those links must point to an application-owned UUID record before Clerk serves traffic.
- The active resume Storage policies use the current UUID in ownership and path checks. They need the same actor helper as table policies and RPCs.

## Shape

### Core identity data

Keep `rush.profiles.id uuid` as the canonical application user ID. Remove only its foreign key to `auth.users`; do not rename or re-key it. Add the application's copy of the primary email because `currentUser()` and reminder delivery can no longer read `auth.users`.

```sql
alter table rush.profiles
  add column primary_email text;

create table rush.auth_identities (
  issuer text not null,
  subject text not null,
  app_user_id uuid not null references rush.profiles(id),
  state text not null check (state in ('ACTIVE', 'REVOKED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (issuer, subject),
  unique (app_user_id, issuer)
);
```

`issuer + subject` is the external identity key. `app_user_id` is the domain key. An application user may have one legacy Supabase identity and one Clerk identity during migration. Authenticated clients get no direct table privileges. RLS is forced. Runtime code never links an existing UUID by email.

Use branded application types at the TypeScript boundary so Clerk IDs cannot be passed to domain queries by accident.

```ts
declare const appUserIdBrand: unique symbol;
export type AppUserId = string & { readonly [appUserIdBrand]: true };

type VerifiedClerkIdentity = Readonly<{
  issuer: string;
  subject: string;
  primaryEmail: string;
  displayNameSeed: string;
}>;

export type CurrentUser = Readonly<{
  id: AppUserId;
  email: string;
  name: string;
  active: boolean;
  memberships: readonly CurrentMembership[];
}>;
```

### One database actor boundary

Add one stable helper and make it the only way policies and RPCs derive a user.

```sql
create function rush.actor_id() returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select i.app_user_id
  from rush.auth_identities i
  where i.issuer = auth.jwt()->>'iss'
    and i.subject = auth.jwt()->>'sub'
    and i.state = 'ACTIVE'
$$;
```

The final migration must fully qualify every referenced object, lock ownership and grants, grant execution only to the roles that need it, and return `null` for missing, malformed, revoked, or unmapped claims. RLS comparisons then fail closed. Every security-definer write RPC must also reject a null actor explicitly before doing work.

Backfill a legacy identity for every existing Supabase user using the exact production JWT issuer and UUID subject. Imported Clerk identities add a second row pointing at the same profile UUID. This makes the database migration compatible with both verified token types and gives rollback a stable base.

Replace effective database objects, not historical migration text:

- all current policies, functions, views, and triggers that use `auth.uid()`;
- every current foreign key to `auth.users`, repointed to `rush.profiles` with deletion behavior reviewed rather than copied blindly;
- all current reads or joins against `auth.users`, including reminders and portal restrictions;
- Storage policies and UUID folder checks;
- database tests, fixtures, generated TypeScript types, and operational scripts.

The implementation begins with a live-catalog inventory from `pg_policy`, `pg_proc`, `pg_views`, `pg_trigger`, `pg_constraint`, and Storage policy catalogs. The repository's count of 48 migration files is evidence of scope, not a migration checklist.

### Application identity boundary

Keep one deep server module responsible for Clerk verification, first-request creation, and the domain user projection.

```ts
// src/lib/auth.ts, public operations
export function currentUser(): Promise<CurrentUser | null>;
export function currentDestination(): Promise<AuthDestination | null>;
export function requireUser(): Promise<CurrentUser>;
export function requireMember(): Promise<CurrentUser>;
export function requireAdmin(): Promise<CurrentUser>;
export function requireBoard(): Promise<CurrentUser>;

// src/lib/auth/identity.ts, server-only internals
function verifiedClerkIdentity(): Promise<VerifiedClerkIdentity | null>;
function ensureApplicationIdentity(
  identity: VerifiedClerkIdentity,
): Promise<AppUserId>;
function loadCurrentUser(
  db: RushClient,
  appUserId: AppUserId,
): Promise<CurrentUser | null>;
```

`currentUser()` does the whole operation. It verifies the Clerk session, asks the Clerk-token Supabase client for the mapped actor, and, only when unmapped, invokes a service-role bootstrap operation and retries once. Callers do not coordinate load, map, bootstrap, and retry.

Bootstrap is idempotent on `issuer + subject`. It creates a fresh profile UUID for a genuinely new Clerk user and seeds display name and primary email. It never attaches to an existing profile by matching email. Imported users must have their mapping loaded before traffic. A duplicate or conflicting mapping is an error that pages report as account setup unavailable, not a reason to create another user.

The service-role key stays in a `server-only` module. Bootstrap arguments come from Clerk's verified server session and configured issuer, never request JSON or a decoded browser token. A Clerk webhook route verifies signatures, records event IDs for idempotency, updates non-authorization profile data, and marks deleted identities revoked. It reconciles state but is not on the signup critical path.

### Data clients and Proxy

```ts
// src/lib/supabase/server.ts
export function createServerDataClient(): Promise<RushClient>;

// src/lib/supabase/browser.ts
export function useAuthenticatedDataClient(): RushClient;
```

Both factories hide Clerk token transport behind Supabase's `accessToken` callback. They expose generated domain database types, not Clerk or JWT types. Server callers should first use `currentUser()` or a `require*()` helper when they need an identity. Public database reads can receive an anonymous client with no token.

`src/proxy.ts` becomes Clerk middleware using the Next 16 `proxy.ts` convention. Its matcher excludes static assets and Clerk's auth pages and webhook, and it applies a coarse signed-in check to protected page/API families. Every Route Handler, page, and Server Function retains its local authorization check. Proxy does not bootstrap identities or query roles.

Put `ClerkProvider` in the root layout. Use Clerk's prebuilt `SignIn`, `SignUp`, and `UserProfile` components first. Keep `/login` and `/apply` as MECG routes so existing links and destination logic survive. `/apply` shows `SignUp` when signed out and the application after `/auth/complete` has established the domain identity.

### Interface-depth judgment

The public application interface remains the six auth operations callers already understand plus two data-client factories. Behind it sit Clerk session verification, token transport, UUID lookup, idempotent bootstrap, retry, and profile projection. This is a deep module: callers gain capability without learning the mapping protocol. Exposing `getClerkSubject()`, `findIdentity()`, `createProfile()`, and `retryMappedRequest()` would create a shallow temporal API, so those operations stay private. The SQL side follows the same rule: policies know `rush.actor_id()`, not issuer parsing or mapping layout.

## Module map

| Module | Owns | Must not own |
|---|---|---|
| `src/lib/auth.ts` | Current domain user, destination, role guards | Clerk components, raw JWT claims |
| `src/lib/auth/identity.ts` | Verified Clerk identity and idempotent profile bootstrap | Domain authorization decisions |
| `src/lib/supabase/server.ts` | Server Supabase client with Clerk token | User provisioning |
| `src/lib/supabase/browser.ts` | Browser Supabase client with Clerk token | Domain identity mapping |
| `src/proxy.ts` | Coarse signed-in routing and matcher | Final role or row authorization |
| `src/app/auth/complete/*` | Post-auth destination handoff | Mapping SQL or service-role details |
| `src/app/api/webhooks/clerk/route.ts` | Signature verification and event dispatch | Signup correctness |
| `src/lib/clerk/webhook.ts` | Idempotent reconciliation policy | HTTP response formatting |
| new Supabase migration | Canonical UUID ownership, identity map, `actor_id()`, RLS/RPC/Storage conversion | Clerk Backend API calls |
| `scripts/migrate-auth-users.*` | Restartable export/import manifest and Clerk import | Runtime authentication |

## Synthesis decision

This candidate compared three whole shapes.

1. **Chosen: database mapping plus `rush.actor_id()`.** It keeps all UUID domain links stable and hides Clerk's representation behind one SQL function. The database remains the authorization source of truth. The cost is one indexed identity lookup when an actor is derived.
2. **Custom `app_user_id` Clerk session claim.** This removes the mapping lookup, but identity assignment moves into Clerk metadata and token issuance. Provisioning, claim refresh delay, the token-size budget, and rollback become authorization concerns shared by Clerk configuration and SQL. Its interface is shallower because callers and operators must understand claim freshness.
3. **Re-key the domain to Clerk string IDs.** This follows Clerk's basic Supabase example but touches nearly every user foreign key, audit field, RPC signature, Storage path, fixture, and historical record. It exposes the provider's ID format throughout the domain and makes a later provider change expensive. It hides almost nothing.

The database-mapped design wins because its public interfaces are smaller and its migration can be made backward-compatible before the app switches providers.

## Red-flag screen

- **Shallow modules:** rejected. Callers do not orchestrate mapping or bootstrap stages. The public helpers complete user loading and role enforcement.
- **Information leakage:** Clerk subjects exist only in the identity table, Clerk adapter, import manifest, and verified webhook handler. Domain records and application callers use UUIDs.
- **Temporal decomposition:** load, bootstrap, retry, and profile projection stay in one identity-owned module even though they occur at different times. Webhooks reconcile the same identity rules but cannot gate first login.
- **Pass-through methods:** no provider-neutral `AuthService` wrapper is proposed. There is one provider and one direct Clerk adapter. The existing `require*()` functions remain because each adds redirect and authorization policy.

## Staged implementation and verification

### Stage 0: inventory and spike

1. Query the deployed database catalogs for every identity-dependent policy, function, trigger, view, foreign key, and Storage policy. Record object definitions and owners.
2. Export aggregate user facts without secrets: account count, password versus OAuth identities, confirmation state, duplicate normalized emails, missing emails, banned/deleted users, and bcrypt digest variants.
3. In disposable Clerk development and local Supabase, prove one bcrypt import with the original password, one native Clerk token through Supabase RLS, one existing UUID mapping, one new profile without `auth.users`, and one Storage operation.
4. Ask Clerk for written production guidance on the forecast shared-campus-NAT burst and verification-email throughput. Published short-window IP limits can still affect a synchronized event.

Exit condition: all five spike proofs pass. Otherwise redesign before implementation.

### Stage 1: make the database provider-compatible

1. Add `profiles.primary_email`, detach `profiles.id` from `auth.users`, add `auth_identities`, and backfill legacy Supabase issuer/subject mappings.
2. Repoint current `auth.users` foreign keys to `profiles`. Preserve audit/history rows on account deletion unless the approved retention policy says otherwise.
3. Add and harden `rush.actor_id()`. Convert each effective RLS policy, RPC, view, trigger, and Storage policy with review per object. Do not run a blind replacement.
4. Regenerate database types and update pgTAP fixtures to mint issuer plus subject claims.
5. Deploy this stage while the existing Supabase Auth app still runs. Its verified tokens resolve through the legacy mappings.

Exit condition: current production behavior is unchanged under Supabase Auth; SQL lint, pgTAP, authorization negatives, Storage tests, and full workflow verification pass.

### Stage 2: add Clerk behind no production traffic

1. Add compatible `@clerk/nextjs` and test packages only after the spike fixes exact versions.
2. Add ClerkProvider, Clerk Proxy, token-aware Supabase factories, identity bootstrap, webhook reconciliation, auth-complete handoff, and prebuilt auth/account pages.
3. Replace `supabase.auth.getUser()` inside `src/lib/auth.ts` while preserving `CurrentUser` and `AuthDestination` semantics.
4. Replace the one browser Storage client. Audit all 66 server client imports and classify each as authenticated or anonymous.
5. Make legacy auth endpoints return `410 Gone` in the Clerk release so old forms or bots cannot create Supabase-only accounts. Remove them only after the recovery window.

Exit condition: unit, type, lint, build, Proxy matcher, Route Handler, and end-to-end auth tests pass in the isolated environment.

### Stage 3: rehearse user migration

1. Build a deterministic importer. Store source UUID, resulting Clerk ID, status, attempt count, and sanitized error in an encrypted manifest. Never log or commit password digests.
2. Import email, verification state, bcrypt digest with `passwordHasher: "bcrypt"`, and the old UUID as Clerk `externalId`; write the corresponding identity mapping.
3. Re-run safely to prove idempotency. Reconcile counts and sample UUID-linked applications, memberships, audits, and files.
4. Test migrated password users, OAuth-only users if any, reset, deletion, email change, duplicate webhook delivery, webhook reordering, and delayed webhooks.

Exit condition: 100% of eligible accounts reconcile or appear on an approved exception list, with no duplicate domain identities.

### Stage 4: capacity and security proof

Run the expected rush-night load from distributed IPs and a simulated campus NAT. Measure signup completion, Clerk `429` plus `Retry-After`, verification delivery latency, login throughput, bootstrap conflicts, webhook lag, Supabase RLS denials, and Storage failures. Run positive and negative authorization cases for applicant, member, committee, panel, board, and owner roles. Include cross-user and unmapped, revoked, forged, missing, and malformed claim cases.

Exit condition: measured targets agreed by the team are met, and a database security review signs off on every converted security-definer function and policy.

### Stage 5: production cutover

1. Freeze signup and identity-affecting schema changes for a short announced window.
2. Take the final Supabase user export, run the restartable Clerk import, load Clerk mappings, and reconcile before routing traffic.
3. Enable Clerk's production email domain, security settings, native Supabase integration, redirect URLs, and verified webhook endpoint.
4. Deploy the Clerk application release. Existing Supabase sessions cannot transfer, so everyone signs in again.
5. Open signup only after migrated-login and RLS canaries pass. Watch the metrics listed below with named responders.

## Stop/go gate before production

Production cutover is a **go** only when all of the following have evidence attached:

- Clerk confirms or testing proves the expected signup burst, shared-IP behavior, and email target.
- A representative bcrypt sample signs in with unchanged passwords; every unsupported auth method has an approved user path.
- The import manifest reconciles every eligible Supabase UUID to exactly one Clerk subject, apart from a signed-off exception list.
- Native Clerk tokens pass role, cross-user, RPC, Realtime if used, and Storage RLS tests; unmapped and revoked subjects fail closed.
- The catalog inventory has no remaining effective `auth.uid()` or `auth.users` dependency in the retained domain path.
- The old Supabase app works against the new `actor_id()` database for rollback.
- Support copy, forced re-login notice, dashboard configuration checklist, secrets ownership, monitoring thresholds, and on-call roles are approved.
- The team accepts the rollback limitation for users created after Clerk signup opens.

Any missing item is a stop, not a soft warning.

## Rollback

Keep Supabase Auth records, the old app release, and legacy identity mappings unchanged through a defined recovery window. Do not drop the Supabase trigger, auth routes, or secrets until that window closes.

Before Clerk signup opens, rollback is straightforward: route traffic to the previous application release. Its Supabase sessions and auth calls continue to work because `rush.actor_id()` resolves the legacy issuer and subject. Leave the provider-compatible database migration in place.

After Clerk signup opens, rollback is deliberately degraded. Users created only in Clerk have no Supabase password or session and cannot sign into the old release. During a rollback, close new signup, preserve those Clerk identities and domain rows, and give affected users a documented recovery path after Clerk service returns. Do not attempt insecure password dual-write. The human cutover gate must accept this limitation and set a threshold for rolling back versus keeping Clerk auth online while disabling writes.

Rollback triggers should include sustained login or signup failure, verification mail outside the agreed target, unexpected Clerk `429` rates, identity bootstrap conflicts, unmapped-subject errors, or any authorization/Storage regression. Set numeric thresholds from Stage 4 rather than inventing them in code.

## Tests and commands to add or run

- Existing repository checks: `npm test`, `npm run lint`, `npm run build`, `npm run check:sql`, local Supabase lint, pgTAP, auth routing, backend verification, and full workflow verification.
- New unit tests: identity parser boundaries, destination parity, bootstrap retry and conflict, webhook idempotency, and provider-independent `CurrentUser.id`.
- New Proxy tests: `unstable_doesProxyMatch`, public asset/auth/webhook exclusions, protected pages, protected APIs, and direct Server Function authorization.
- New database tests: legacy and Clerk issuers, duplicate subjects, revoked identity, null/malformed claims, FK preservation, every role, cross-cycle and cross-owner denial, security-definer null-actor rejection, and Storage folder ownership.
- New browser tests using Clerk test helpers: signup, verification, migrated password login, wrong password, reset, sign-out, expired session, account settings, return URL, first-request bootstrap, and delayed webhook.
- Migration rehearsal: restart the importer after partial failure and compare source, Clerk, mapping, profile, and domain-history counts.
- Load proof: same-NAT and distributed-IP signup/login runs against a non-production Clerk instance configured as close to production as Clerk permits.

Record every command, exit status, and meaningful result in the implementation handoff. No production claim should rest only on mocked tokens.

## Tradeoffs accepted

- We accept an indexed identity lookup in exchange for keeping provider IDs out of every domain table and policy.
- We accept a service-role bootstrap path in exchange for making first login independent of webhook timing. The path is server-only, narrow, idempotent, and tested as security-sensitive code.
- We accept forced re-login at cutover in exchange for not trying to translate live Supabase sessions.
- We accept a period where legacy auth artifacts remain dormant in exchange for a tested rollback path.
- We accept that post-cutover Clerk-only accounts make rollback degraded in exchange for avoiding password dual-write.

## Open questions and risks

1. What are the forecast peak signups per ten seconds, total signups per hour, and size of the largest shared campus NAT cohort?
2. Will Clerk commit to that production email and request volume, and which paid plan, support level, MFA, log retention, and bot settings does MECG need?
3. Which production users use password, OAuth, phone, or other identities, and do the actual Supabase password digests import successfully?
4. Should Clerk email/name changes update `profiles.primary_email` and `display_name`, or should MECG's member profile remain authoritative after initial creation?
5. On Clerk deletion, should the app only revoke the identity, also deactivate the profile, or apply a retention/anonymization policy to applicant records?
6. Does any deployed object absent from the repository still depend on `auth.uid()`, `auth.users`, Supabase Realtime authorization, or Storage owner metadata?
7. What numeric SLOs and rollback thresholds define acceptable signup completion, email latency, login errors, webhook lag, and Clerk throttling?
8. How long must Supabase Auth records and secrets remain available for recovery, and who can authorize final retirement?

## Next implementation step

Run Stage 0's deployed catalog and user-shape inventory, then build the four-proof Clerk-to-local-Supabase spike before adding Clerk to the application.
