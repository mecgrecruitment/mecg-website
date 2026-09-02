# Clerk integration completion — 2026-09-02

## Outcome

The repository-side Clerk integration is complete through the pre-release gate. Authentication uses Clerk for login, applicant signup, password and profile management, provider-neutral Rush authorization, and user lifecycle reconciliation. The remaining actions are controlled external rollout steps, not missing application code.

## Completed in this pass

- Removed email-based legacy-profile claiming from synchronous identity provisioning. A migrated Rush UUID is accepted only from Clerk's controlled `externalId` field and is still validated against the prepared migration ledger by the database function.
- Added an atomic, service-role-only Clerk webhook reconciler. It records the signed delivery ID, serializes updates per Clerk subject, makes retries idempotent, gives deletions precedence on timestamp ties, and rejects older lifecycle events.
- Added database coverage proving that a stale `user.updated` delivery cannot reactivate an identity after a newer `user.deleted` delivery.
- Migrated the applicant account form from `@clerk/nextjs/legacy` to Clerk v7's current `SignUpFuture` API, including returned-error handling, email-code verification, transferable-account messaging, session finalization, and pending-session-task navigation.
- Changed `/login` to an optional catch-all route with path routing so Clerk can render `/login/tasks/<task-key>` flows.
- Installed `@clerk/testing` and added a project-based Playwright setup. The authenticated test uses only development keys, bypasses bot protection with a Clerk testing token, creates a disposable `+clerk_test` applicant, verifies it with the development OTP, and deletes the user in cleanup.
- Added an opt-in main-branch CI job for authenticated Clerk testing. It fails closed unless every key is a development/staging credential.

## Verification evidence

| Gate | Result |
| --- | --- |
| Full local migration replay through `20260902220000_clerk_webhook_ordering.sql` | Passed |
| `supabase db lint --local --schema rush --level error --fail-on error` | Passed with no findings |
| `supabase test db supabase/tests/rush_foundation.sql` | 264/264 passed |
| Targeted Clerk identity, webhook, retry, and login tests | 11/11 passed |
| Full `npm test` suite | 259/259 passed |
| Full ESLint and TypeScript checks | Passed |
| Next.js 16 production webpack build | Passed; 77 static pages generated and `/login/[[...login]]` compiled as a dynamic route |
| Public Playwright discovery | Existing 8 tests remain isolated from the authenticated project |
| Production-mode public Playwright run | 8/8 passed in desktop and mobile Chromium |
| Authenticated Clerk Playwright discovery | Setup plus applicant signup test discovered |

The authenticated browser test was not executed on this machine because its local Clerk credentials are production credentials. The test intentionally rejects them; no production test user was created.

## External rollout checklist

1. Create or select a Clerk development instance whose password and email-code settings mirror production.
2. Configure GitHub secrets `CLERK_E2E_PUBLISHABLE_KEY`, `CLERK_E2E_SECRET_KEY`, `STAGING_SUPABASE_URL`, and `STAGING_SUPABASE_ANON_KEY`; configure variables `CLERK_E2E_ENABLED=true` and `CLERK_E2E_ISSUER`.
3. Run `npm run test:e2e:clerk` against staging and make the `authenticated-clerk` job a required branch-protection check.
4. After review, push the migration and application changes, apply pending migrations through the normal release path, and run `verify:infrastructure`, `verify:auth`, and `verify:workflow` against the deployed revision.
5. Keep legacy Supabase Auth recovery paths during the agreed soak period. Remove them only after migration-ledger reconciliation and an explicit recovery-window close decision.

## Operational boundaries

- Never use production Clerk keys with `npm run test:e2e:clerk`.
- Keep the Clerk production proxy path; direct custom-host TLS is not required for the current proxy deployment.
- Treat webhook delivery headers as part of the signed request. The handler accepts the current Svix names and Standard Webhooks aliases, but reconciliation always requires an event ID and timestamp.
