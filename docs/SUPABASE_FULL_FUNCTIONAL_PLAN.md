# Supabase full-functionality plan

## Implementation status, August 21, 2026

The runtime cutover is complete. Supabase Auth and the additive `rush` schema now own applications, check-ins, memberships, assignments, evaluations, conflicts, cycles, rounds, events, decisions, approvals, exports, and audit history. Prisma, SQLite, scrypt password handling, and the custom session cookie have been removed from the repository.

The linked MECG Recruitment project has the full migration ledger, generated TypeScript types, forced RLS, named transactional functions, Auth profile synchronization, production and local callback URLs, email confirmation, password recovery, and TOTP enrollment support. The remote workflow verifier exercises the complete application-to-release path in a forced-rollback transaction and removes its temporary Auth identities.

## Outcome

Supabase becomes the only production authority for authentication, recruitment data, private files, permissions, and audit history. Prisma, SQLite, password hashes, and the custom `mecg_session` cookie leave the runtime after cutover.

The migration must preserve the stronger behavior in the current application. The existing cloud tables remain read-only during the transition because their global member roles and cycle-scoped `candidates` rows do not match the current domain.

## What "ultra functional" means here

The target is not to use every Supabase feature. It is to make the recruitment system safe to operate for a full cycle without Prisma or manual database work.

1. Supabase Auth owns every applicant, member, board, panel, and owner identity.
2. Postgres constraints, RLS, and named functions enforce permissions and workflow rules even if a route handler has a bug.
3. The app supports the full account lifecycle, application, check-in, evaluation, conflict, decision, release, export, and audit flows.
4. Private files, if MECG approves them, use Storage with owner-scoped policies and short-lived signed downloads.
5. Local development resets from migrations and seed data. Staging and production deploy the same migrations.
6. Operators can see failed Auth calls, RLS denials, function errors, latency, and missing audit writes, and they have a tested restore procedure.

Realtime, Edge Functions, cron jobs, and public object storage are out of scope until a named workflow needs them. Live dashboards can use server refreshes first. This keeps authorization in one place and avoids adding another execution path during the migration.

## Planned module ownership

- `supabase/migrations/` owns schema, constraints, indexes, grants, RLS, functions, triggers, storage policy, and safe read views.
- `src/lib/supabase/server.ts` owns request-scoped user clients. It must return typed clients.
- `src/lib/supabase/admin.ts` is reserved for bootstrap, invitation, migration, and repair tasks. Ordinary workflows must not import it.
- `src/lib/auth/` should own caller resolution, capability loading, safe redirects, and route guards. Authority comes from live database rows.
- `src/lib/rush/` should own named server use cases and map database results into page-specific data. Pages and route handlers should not assemble authorization-sensitive joins.
- `scripts/migrate-sqlite-to-supabase.mjs` should own import and reconciliation. It must support dry-run and safe repeat execution.
- `supabase/tests/` should own RLS, function, transaction, concurrency, and storage-policy checks. TypeScript tests should keep pure scoring and form parsing.

Each named write should accept one validated request type, call one Postgres function, and return a small tagged result such as `ok`, `forbidden`, `conflict`, `stale`, or `invalid`. The function derives the actor from `auth.uid()` and writes the audit row in the same transaction. Do not expose generic table-update helpers for sensitive records.

## Architecture decision

Create an additive `rush` Postgres schema in the existing MECG Recruitment Supabase project. Keep existing URLs and place a small server module between each Next.js route and Supabase.

```text
Next page or action
        |
        v
named server use case
        |
        +---- shaped read through the caller's Supabase session
        |
        `---- one transactional Postgres function for sensitive writes
                         |
                         `---- authorization + mutation + audit in one transaction
```

Use three route families with one design system:

- Marketing shell for public pages.
- Portal shell for authentication, application, applicant status, and check-in.
- Workspace shell for member and board operations.

Keep `/apply`, `/applicant`, `/checkin/[token]`, `/member`, and `/admin`. Changing route groups must not break URLs, QR codes, or bookmarks.

## Domain model to preserve

| Current concept | Supabase destination | Required rule |
| --- | --- | --- |
| `User` | `auth.users` + `rush.profiles` | Supabase Auth is the only login identity. |
| `Pnm` | `rush.pnms` | Stable person record, separate from an application. |
| `RushCycle` | `rush.rush_cycles` | Forward-only lifecycle. |
| `Membership` | `rush.memberships` | Role is scoped to a cycle and can be revoked. |
| `Application` | `rush.applications` | One person per cycle; applicant sees only their own record. |
| `Round`, `Rubric`, criteria | matching `rush` tables | Rubric version and weights freeze with evaluations. |
| Assignment and evaluation | `rush.evaluation_assignments`, `rush.evaluations`, `rush.criterion_ratings` | Submitted forms are immutable; `N/O` is not zero. |
| Conflict declaration | `rush.conflict_declarations` | Declaration recuses assignments, voids affected evidence, and removes approvals atomically. |
| Decision and approvals | `rush.decisions`, `rush.decision_approvals` | Two distinct active, conflict-free approvals; release is a separate action. |
| Event and check-in | `rush.events`, `rush.checkins` | Rotating token, time window, idempotent attendance, no score effect. |
| Audit event | `rush.audit_events` | Append-only and written in the same transaction as the action. |
| Retry protection | `rush.mutation_receipts` | Repeated requests cannot duplicate sensitive writes. |

Use Postgres enums or check constraints for every status and role. Add real foreign keys for supersession chains. Preserve current text IDs during import; use UUIDs for new authentication identities.

## Access model

`auth.users.id` answers who the caller is. `rush.memberships` answers what they can do in a cycle. Never store authority in editable user metadata or infer it from a route.

| Role | Capabilities |
| --- | --- |
| `MEMBER` | Open member workspace and evaluate assigned applicants. |
| `BOARD` | Member access plus cycle, round, assignment, event, and export operations. |
| `PANEL` | Member access plus locked Hash data and decision actions. |
| `OWNER` | Current full access, including membership administration, until MECG approves a narrower policy. |

Every table enables and forces row-level security. Anonymous users receive no base-table access. Authenticated users receive narrow reads. Sensitive writes use named Postgres functions that derive the actor from `auth.uid()`, recheck live membership and conflicts, lock affected rows, perform the change, and append audit history.

The service-role key stays server-only. Ordinary application, evaluation, decision, and check-in flows must not use it.

## Delivery phases and blocking gates

### Phase 0: inventory and policy lock

1. Export schema, migration ledger, table counts, Auth user count, bucket list, RLS policies, grants, functions, and redirect settings from the live project.
2. Inventory every source SQLite database and deployed environment. Record counts and stable checksums without logging personal data.
3. Identify active cycles, distributed check-in links, applicant portal links, and external API consumers.
4. Confirm the authoritative source for each record type.
5. Decide applicant identity, phone-only recovery, internal invitation, Owner decision authority, MFA roles, retention, production domain, email sender, and cutover window.
6. Create an encrypted backup and prove it restores into an isolated project.

Gate: signed inventory, restore rehearsal, named source of truth, and no active-cycle move without a maintenance plan.

### Phase 1: repeatable database foundation

1. Add ordered migrations for enums, tables, constraints, indexes, grants, RLS, functions, triggers, storage, and safe views.
2. Generate `database.types.ts` from the linked project. Never hand-edit it.
3. Add a local reset command and SQL test runner.
4. Reject client imports of the service-role module and reject any `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` environment variable.
5. Add seed data that contains no real applicant information.

Gate: a clean database resets from zero twice with identical results; every table has RLS; anonymous access tests pass.

### Phase 2: authentication and account routing

1. Replace password login with Supabase password or approved magic-link login.
2. Add signup, email verification, forgot-password, reset-password, logout, PKCE callback, and safe `next` handling.
3. Resolve the post-login destination from database-backed capabilities: board/panel/owner to `/admin`, member to `/member`, applicant owner to `/applicant`, otherwise `/apply`.
4. Add invitation and membership administration without self-granting.
5. Require MFA for roles approved in Phase 0.
6. Keep the current custom session only behind a temporary rollback flag. Do not let it authorize Supabase data.

Gate: login, refresh, logout, reset, revocation, role routing, wrong-role denial, and open-redirect tests pass.

### Phase 3: applicant vertical slice

1. Move open-cycle reads and application submission to Supabase.
2. Bind each PNM to a verified Auth user without merging records by name.
3. Replace permanent portal bearer URLs with authenticated ownership. Keep old token routes only as rate-limited, expiring claim links with hashed tokens.
4. Add applicant dashboard reads that expose only owned applications and released outcomes.
5. If resumes are approved, use a private bucket, user-scoped upload policy, PDF/type/size validation, deterministic paths, and cleanup when the database transaction fails.
6. Move check-in to a function that validates the event state, cycle state, UTC window, token digest, applicant identity, and unique attendance row.

Gate: two-user isolation, duplicate application, duplicate check-in, expired token, unreleased decision, and storage enumeration tests pass.

### Phase 4: member evaluation slice

1. Move the evaluation hub to purpose-built read functions or views.
2. Implement `submit_evaluation` as one transaction. It checks assignment ownership, cycle permission, conflict, round state, deadline, rubric version, exact criterion set, score range, required notes, observation coverage, and duplicate submission.
3. Implement conflict declaration with all current recusal, voiding, approval removal, decision reopening, and audit effects.
4. Preserve immutable submitted evaluations. Corrections must append a superseding version if MECG enables correction workflow.

Gate: SQL concurrency tests and browser tests prove that duplicate submits, stale forms, conflicts, missing criteria, low coverage, and late submissions fail correctly.

### Phase 5: board, panel, and decision slice

1. Move cycle setup, member assignment, events, token rotation, round transitions, and cycle transitions.
2. Keep `BOARD` operations separate from `PANEL` deliberation.
3. Reveal aggregate scores only after required rounds freeze and the cycle reaches Decision Lock.
4. Implement separate proposal, approval, and release functions. Never expose a generic status-update function.
5. Recompute valid approvers inside the release transaction.
6. Move exports to a logged, role-scoped server response with spreadsheet-formula escaping.

Gate: transition-table tests, two-person approval tests, conflict races, frozen-round secrecy, release authorization, and export audit tests pass.

### Phase 6: migration rehearsal

1. Build an idempotent importer with a source-to-target ID ledger.
2. Preserve IDs, timestamps, statuses, rubric versions, evaluation chains, conflicts, approvals, check-ins, and audit metadata.
3. Quarantine invalid references instead of guessing a repair.
4. Run the import twice against staging and require identical counts and checksums.
5. Recompute evaluation and round aggregates independently and compare them with the migrated records.
6. Test every role through a complete mock cycle from application to released decision.

Gate: zero unexplained count differences, zero broken foreign keys, zero ownership collisions, identical repeated import report, and signed workflow rehearsal.

### Phase 7: production cutover

1. Announce and enforce the approved write freeze.
2. Take the final backup and import the delta.
3. Run automated migration checks before changing traffic.
4. Configure production Auth URLs, redirect allowlist, email templates, SMTP ownership, MFA, and rate limits.
5. Switch the runtime flag to Supabase and run applicant, member, panel, board, and owner smoke tests.
6. Reopen writes only after all smoke tests pass.
7. Monitor Auth errors, RLS denials, function failures, latency, and audit gaps.

Before the first Supabase production write, rollback may switch the application back to SQLite. After Supabase accepts a write, never restore or reactivate stale SQLite. Roll back application code while retaining Supabase data, or enter maintenance and reconcile writes into a restored Supabase snapshot.

### Phase 8: removal and hardening

1. Keep legacy storage encrypted and read-only for the approved rollback and retention window.
2. Remove Prisma, SQLite, scrypt password code, custom session cookies, login throttle tables, and old API handlers only after zero production requests reach them for the agreed period.
3. Rotate credentials that were used during migration.
4. Run dependency, secret, bundle, RLS, accessibility, and disaster-recovery audits.
5. Publish the operating runbook for user invitation, role changes, conflict incidents, releases, exports, backup restore, and Auth outages.

Gate: no runtime Prisma imports, no custom auth cookie, no service-role code in client bundles, and successful restore plus full-cycle rehearsal from the production backup.

## Route acceptance matrix

| Route | Required final behavior |
| --- | --- |
| Marketing routes | Remain public during a Supabase outage. Header shows role-aware Login/Dashboard without leaking identity. |
| `/apply` | Public cycle information; authenticated submission belongs to the caller. |
| `/applicant` | Authenticated owner-only dashboard; released result only. |
| `/applicant/[token]` | Temporary, expiring legacy claim flow; no permanent bearer portal. |
| `/checkin/[token]` | Branded, time-bound, idempotent, identity-verified check-in. |
| `/member` | Active-cycle assignments, own evidence, conflicts, and immutable submissions only. |
| `/admin` | Cycle-scoped tools and data based on live capabilities. |
| `/admin/events/*` | Board-only event creation, QR generation, counts, and audited token rotation. |
| Auth routes | Login, verification, password reset, callback, logout, and safe role routing. |

## Required verification

- SQL tests for every RLS role and table, including cross-user and cross-cycle denial.
- SQL tests for every state transition, transaction rollback, retry receipt, conflict consequence, and approval race.
- TypeScript unit tests for form parsing, safe redirects, result mapping, score calculations, and spreadsheet escaping.
- Browser tests for signup, login, recovery, applicant submission, check-in, evaluation, conflict, decision, release, and logout.
- Accessibility checks for labels, errors, keyboard navigation, focus, contrast, and reduced motion.
- Migration tests for counts, checksums, foreign keys, unique constraints, normalized contacts, timestamps, and aggregate parity.
- Security checks for secrets, client bundles, storage enumeration, signed URL expiry, service-role imports, MFA, rate limits, and Auth redirect allowlists.
- Visual checks at desktop and mobile widths for marketing, portal, and workspace shells.
- Operational checks for backup restore, Auth outage behavior, Postgres outage behavior, rollback, and incident audit trails.

No phase may be called complete when its gate has an unexplained failure or skipped security test.

## Product decisions still required

1. Must every applicant have a verified email, or will verified phone login be supported?
2. How should existing phone-only or changed-email applicants claim their records?
3. Does `OWNER` retain decision and release authority, or become technical-only?
4. Which roles require MFA? The recommendation is Owner, Board, and Panel.
5. Are resumes in scope, and what retention and deletion period applies?
6. What production domain, Auth redirect URLs, SMTP sender, and incident contact should Supabase use?
7. Can cutover happen between cycles? If not, what write-freeze duration is acceptable?
8. How long must legacy portal and API compatibility remain available?

Until MECG answers these questions, implementation can finish the local schema, tests, UI shells, and staging flows, but production cutover stays blocked.

## Recruitment Committee role boundary

`RECRUITMENT_COMMITTEE` is a cycle-scoped operational role and is assigned to no users by the migration. It may manage applicant intake, screening administration, evaluator assignments, round coordination, events and slots, check-in operations, case groups, candidate dossier/resume access, attendance-only exports, audit reads, and decision-preview drafting. It cannot create or change cycles, grant roles, access Hash, read locked evaluation evidence, create or approve decisions, release decisions, or perform broad applicant exports. Blind reviewing remains disabled by default.

Committee application status writes are limited to `DRAFT`, `SUBMITTED`, `NEEDS_INFO`, `ELIGIBLE`, `INVITED`, `IN_PROCESS`, and `FINAL_REVIEW`; outcome and withdrawal statuses are rejected at the database boundary.
