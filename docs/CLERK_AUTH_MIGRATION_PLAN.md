# Clerk authentication migration plan

Status: proposed plan only. No application, database, dependency, dashboard, or production change has been made.

- Branch: `codex/clerk-auth-plan`
- Base commit: `992ec75`
- Research: [clerk-auth-research.md](./clerk-auth-research.md)

## Recommendation

Proceed with a time-boxed Clerk migration spike. Do not approve a production migration yet.

Clerk can own signup, email verification, password login, password reset, sessions, sign-out, bot protection, and account lockout. Supabase should keep Postgres, Storage, the Data API, RLS, RPC authorization, and all recruitment data. This removes Supabase's built-in two-auth-emails-per-hour sender from the signup and reset paths.

Use Supabase's native Clerk third-party-auth integration. Do not use the deprecated Clerk JWT template.

The migration is not an SDK swap. The current database treats Supabase Auth UUIDs as permanent application user IDs. Clerk session tokens use string subjects such as `user_123`. Preserve the UUIDs and add one explicit mapping between an external issuer and subject and the existing UUID.

## Target architecture

### Identity model

Keep `rush.profiles.id uuid` as the canonical application identity. Existing memberships, applications, audit records, evaluator assignments, projects, reminders, and Storage paths keep their UUID values.

Add a private identity table with this conceptual shape:

```sql
rush.auth_identities(
  issuer text,
  subject text,
  app_user_id uuid references rush.profiles(id),
  disabled_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  primary key (issuer, subject),
  unique (issuer, app_user_id)
)
```

The exact `(issuer, subject)` pair identifies an external account. This prevents development, preview, production, legacy Supabase, and Clerk identities from colliding. Feature code continues to use only the UUID.

Move the primary email needed by reminders and server-side routing into application-owned data, initially `rush.profiles.primary_email`. Clerk is authoritative for sign-in identifiers. The application stores the normalized current primary email needed for domain workflows. The webhook reconciles it. A uniqueness constraint is added only after the production inventory proves the existing data is conflict-free.

### Database actor boundary

Add one hardened `rush.actor_id() returns uuid` function. It reads the verified JWT `iss` and `sub`, performs an indexed lookup in `rush.auth_identities`, and returns the application UUID only for an enabled mapping.

Requirements:

- Missing, malformed, disabled, unmapped, or wrong-issuer claims fail closed.
- The function has a fixed empty `search_path`, fully qualified object names, reviewed ownership, and minimal grants.
- It is executable by `authenticated`. Anonymous requests do not need execution and may receive permission denied. Public operations must not depend on it.
- Security-definer write functions reject a null actor before any mutation.
- Every live RLS policy, RPC, view, trigger, Storage policy, and authorization helper uses this boundary instead of `auth.uid()`.
- Domain foreign keys currently pointing to `auth.users` move to the application-owned UUID record with each deletion rule reviewed separately.

The database remains the final authorization authority. Clerk roles, organizations, or metadata do not replace cycle memberships or `hasPermission`.

### Application boundary

Keep the existing caller-facing API:

```ts
currentUser(): Promise<CurrentUser | null>
currentDestination(): Promise<AuthDestination | null>
requireUser(): Promise<CurrentUser>
requireMember(): Promise<CurrentUser>
requireAdmin(): Promise<CurrentUser>
requireBoard(): Promise<CurrentUser>
```

`CurrentUser.id` remains the application UUID. Callers never receive Clerk subjects or raw claims.

One server-only identity module verifies the Clerk principal and calls one service-role-only, atomic provisioning operation. For a new Clerk user, that operation creates one UUID profile and one identity mapping. Concurrent first requests and webhook delivery must resolve to the same row. Imported users never link by email. Their mappings come from the audited import ledger.

Clerk webhooks reconcile `user.created`, `user.updated`, and `user.deleted`, but the first authenticated request does not wait for webhook delivery. A delete revokes only that external identity by default. Profile deactivation or applicant anonymization follows the existing retention policy and requires a separate decision.

### Supabase clients and Next.js

- `src/lib/supabase/server.ts` obtains the verified Clerk session token with `await auth()` and supplies it through Supabase's `accessToken` callback.
- A browser client hook does the same for the direct resume Storage flow.
- `src/proxy.ts` uses Clerk middleware under the Next.js 16 `proxy.ts` convention for coarse signed-in routing only.
- Server Components, Route Handlers, and Server Functions keep authorization beside the protected operation.
- The root layout adds `ClerkProvider`.
- Start with Clerk's prebuilt sign-in, sign-up, verification, recovery, and account components. Keep MECG's `/login` and `/apply` URLs and post-auth destination logic.

## Work plan

### Phase 0: inventory and acceptance criteria

1. Query the deployed database catalog for every policy, function, view, trigger, grant, foreign key, Storage policy, and Realtime rule coupled to `auth.uid()`, JWT claims, or `auth.users`.
2. Inventory production users by authentication method, confirmation state, password-hash format, duplicate normalized email, missing profile, applicant link, membership, MFA factor, and disabled status. Do not put hashes, tokens, or personal data in reports.
3. Define peak signup and login volume, largest expected shared campus IP cohort, response-time targets, verification delivery target, acceptable `429` rate, and rollback thresholds.
4. Get written Clerk guidance for that production email burst and shared-IP pattern. Clerk publishes short-window IP limits but no general production verification-email ceiling.
5. Confirm the required Clerk plan, Supabase third-party MAU cost, dashboard ownership, support level, log retention, DNS ownership, and incident contacts.

Exit: every live identity-dependent object and existing account has a recorded disposition. Missing inventory is a stop.

### Phase 1: four-proof technical spike

Use a disposable Clerk development instance and local or disposable Supabase environment.

Prove all of the following before changing production architecture:

1. A representative Supabase bcrypt digest imports into Clerk and the original password signs in.
2. A native Clerk session token reaches Supabase and enforces positive and negative RLS decisions.
3. An existing Clerk mapping reaches records under the original UUID, while a new Clerk user gets a new UUID without an `auth.users` row.
4. The browser resume upload and signed-download paths work under Clerk-authenticated Storage policies.
5. A same-NAT and distributed-IP load run meets the agreed signup, login, `429`, and email-delivery targets.

Exit: every proof passes. A failure changes the architecture or stops the migration.

### Phase 2: make the database provider-neutral

1. Add the identity mapping and application-owned primary email.
2. Backfill a legacy Supabase issuer and UUID subject mapping for every current user.
3. Add and harden `rush.actor_id()`.
4. Repoint domain foreign keys from `auth.users` to the canonical profile UUID. Preserve history and nullable actor behavior deliberately.
5. Recreate every live authorization object and Storage policy against `rush.actor_id()` after individual review. Do not mechanically rewrite historical migration files.
6. Move reminder and portal email reads away from `auth.users`.
7. Update pgTAP claims, generated types, workflow fixtures, and catalog assertions. CI must find zero live domain dependencies on `auth.uid()` or `auth.users`.
8. Deploy this phase while the current Supabase Auth application still serves all traffic.

Exit: the unchanged application passes all existing behavior against the provider-neutral database. The previous application release remains a valid rollback artifact.

### Phase 3: add Clerk with no public traffic

1. Add compatible Clerk packages after the spike fixes exact versions.
2. Add `ClerkProvider`, Clerk Proxy integration, token-aware Supabase client factories, the identity module, post-auth routing, webhook verification, and prebuilt auth pages.
3. Preserve `CurrentUser`, destination routing, and domain permission semantics.
4. Convert the browser Storage client and classify every server Supabase caller as authenticated or anonymous.
5. Make the legacy auth endpoints dormant and return `410 Gone` in the Clerk release. Keep the old implementation in the rollback artifact during the recovery window so stale forms and bots cannot create Supabase-only users.
6. Keep non-auth rate limits for application submission, messages, surveys, and file workflows. Retire signup and login buckets only when those routes leave the active path.

Exit: unit, route, Proxy, SQL, RLS, Storage, webhook, browser, accessibility, lint, and build checks pass in the isolated environment.

### Phase 4: rehearse user migration and operations

1. Build a resumable, dry-run-first importer. Its secure ledger records source UUID, Clerk ID, result, attempt count, and sanitized error. It never logs or commits password digests.
2. Import primary email, verification state, supported bcrypt digest, creation time where supported, and old UUID as Clerk `externalId`.
3. Prevent the import/webhook race. Preload an approved migration ledger keyed by the old UUID. During import, queue webhook reconciliation or require the webhook to use `externalId` and that ledger. It must never create a fresh UUID for an imported user.
4. Re-run the importer to prove idempotency. Reconcile every eligible source account, Clerk account, identity mapping, and UUID-linked record.
5. Define exception paths for OAuth-only, unverified, duplicate-email, disabled, unsupported-hash, MFA, and missing-email accounts.
6. Rehearse the full migration against an isolated production-like database and exercise delayed, duplicate, reordered, and invalid webhooks.
7. Configure production DNS, SPF, DKIM, DMARC, allowed origins, redirect URLs, Smart bot protection, password rules, lockout, secrets, monitoring, and support copy.
8. Document Clerk signing-key rotation and incidents around Supabase's documented key-cache delay of up to roughly 30 minutes.

Exit: 100% of in-scope accounts reconcile or appear on an approved exception list, and a timed rehearsal completes inside the maintenance window.

### Phase 5: controlled production cutover

1. Schedule cutover outside rush and before public applications open.
2. Freeze signup, password mutation, and identity-schema changes for a short announced window.
3. Take the final user export, run the restartable import, load mappings, and reconcile counts before accepting traffic.
4. Enable Clerk's native Supabase integration, production domain, security settings, and verified webhook endpoint.
5. Deploy only the rehearsed Clerk application and any small post-rehearsal database delta. The provider-neutral database migration is already live from Phase 2.
6. Force reauthentication because Supabase sessions cannot become Clerk sessions.
7. Start with internal canaries, then a bounded applicant cohort. Open public signup only after migrated-login, RLS, Storage, and email canaries pass.

Exit: the defined soak period stays within thresholds and critical user journeys succeed.

### Phase 6: recovery window and retirement

Keep `auth.users`, Supabase secrets, the old release artifact, and legacy issuer mappings intact through an agreed recovery window.

After a clean audit, remove obsolete Supabase Auth routes, callback and recovery marker, cookie refresh helper, auth-only limiter buckets, auth-user triggers, old UI, old tests, and unused secrets. Keep the UUID identity mapping as permanent application architecture. Rename misleading domain columns such as `pnms.auth_user_id` only in a later cleanup.

## Verification matrix

| Boundary | Required proof |
|---|---|
| Identity | Exact issuer and subject map to one UUID; wrong issuer, missing subject, disabled mapping, and forged or unmapped claims fail closed |
| Concurrency | First request, webhook, duplicates, retries, and import events create exactly one intended mapping |
| Authorization | Applicant, member, committee, panel, board, owner, conflict, recusal, and cross-cycle allow and deny results remain unchanged |
| Database completeness | Live catalog and fresh migration replay show no retained dependency on `auth.uid()` or `auth.users` |
| Storage | The owner can upload and retrieve the UUID-scoped resume; another user and anonymous caller cannot |
| Existing users | Imported bcrypt users retain passwords and all UUID-linked history; exception accounts have an approved path |
| New users | Signup, verification, first request, profile creation, routing, reset, and sign-out work without `auth.users` |
| Webhooks | Invalid signatures fail; duplicate, delayed, and reordered events are idempotent; deletion revokes identity without deleting history |
| Capacity | Distributed and campus-NAT tests meet response, `429`, and delivery targets |
| Operations | Key rotation, provider outage, webhook lag, user lockout, and support escalation have tested runbooks |

Repository commands to retain and extend include:

```text
npm test
npm run test:e2e
npm run check:sql
npm run test:supabase:local
npm run supabase:lint:local
npm run verify:backend
npm run verify:workflow
npm run verify:auth
npm run lint
npm run build
```

Live or linked checks run only in the authorized environment. Record the command, exit status, and meaningful result during implementation.

## Rollback and point of no return

Before public Clerk signup opens, rollback routes traffic to the old application release. Keep the provider-neutral database migration in place. Its legacy issuer mappings still accept Supabase sessions. Do not reverse the identity migration during an incident.

Once a public user creates a Clerk-only account or changes a password in Clerk, seamless rollback to Supabase Auth is no longer possible for that user. This is the point of no return, not the deployment itself. After that point, an emergency response should keep Clerk authentication online while rolling back application writes, or use an approved account recovery plan. Never dual-write passwords.

Set numeric rollback triggers during Phase 0 for sustained signup or login failure, mail delivery latency, unexpected Clerk `429` or `5xx` rates, mapping conflicts, unmapped subjects, RLS denials, Storage regressions, and webhook lag.

## Production stop/go gate

Production is a go only when evidence shows:

- Clerk confirms or testing proves the expected email burst and shared-IP behavior.
- Representative production bcrypt hashes work with unchanged passwords.
- Every eligible Supabase UUID maps to exactly one Clerk subject, apart from approved exceptions.
- The live catalog has no retained `auth.uid()` or `auth.users` dependency.
- Native Clerk tokens pass all role, cross-user, RPC, and Storage tests.
- New-user provisioning and import/webhook races are idempotent and fail closed.
- The old Supabase application works against `rush.actor_id()` for pre-public rollback.
- DNS, bot protection, password and lockout policy, allowed origins, redirects, webhook verification, secret rotation, monitoring, support messaging, and incident ownership are ready.
- The rollback rehearsal meets the recovery objective.
- Stakeholders accept that opening Clerk-only public signup ends seamless Supabase credential rollback.

Any failed item is a stop. Do not compensate by weakening RLS, linking accounts by email, using a legacy JWT template, bypassing bot controls, or dual-writing passwords.

## Explicitly rejected designs

- Converting UUID domain keys to Clerk text IDs.
- Putting the UUID in Clerk metadata or custom session claims as the authorization source.
- Depending on webhooks as the only first-login provisioning path.
- Automatically linking existing accounts by matching email.
- Proxying every Supabase query through Next.js.
- Using the deprecated Clerk Supabase JWT template.
- Deleting Supabase users or secrets before the recovery window closes.

## Decisions still needed

- Forecast peak signup and login traffic and the largest shared public-IP cohort.
- Required Clerk plan, support tier, MFA, log retention, and incident response.
- Treatment of OAuth-only, MFA, disabled, unverified, duplicate-email, and unsupported-hash accounts.
- Authority and retention rules for primary email, display name, deletion, and anonymization.
- Whether Clerk's prebuilt UI meets MECG branding, accessibility, and full-name capture requirements.
- The recovery-window length and the people authorized to open public signup or retire Supabase Auth artifacts.

## First implementation step

Build the Phase 0 live database identity inventory and user reconciliation report. Do not add Clerk to the application until the Phase 1 spike proves password portability, native-token RLS, UUID continuity, direct browser Storage, and campus-NAT capacity.
