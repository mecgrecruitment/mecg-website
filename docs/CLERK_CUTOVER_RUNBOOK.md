# Clerk cutover runbook

The code migration is complete, but the provider configuration and real-user import are controlled operations. Do not enable public Clerk signup until every gate below passes.

## Capacity

Clerk documents signup creation at 5 requests per 10 seconds per IP and signup verification attempts at 3 requests per 10 seconds per IP. Even spacing gives mathematical ceilings of 1,800 signup starts and 1,080 verification attempts per hour from one IP, but those are not contractual hourly throughput guarantees and sharp bursts will be throttled. Clerk does not publish a general production verification-email-per-hour ceiling.

The custom applicant flow honors Clerk's `Retry-After`, adds 0–1 second of jitter, and retries at most twice. It does not replay a typed verification code. At a rush event, spread QR scans over several minutes, encourage cellular data when practical, and ask Clerk to confirm expected NAT/email volume in advance.

## Provider setup

1. Create separate Clerk development and production instances. Require primary email verification and configure the password policy.
2. Add the Clerk domain as Supabase's native third-party Clerk provider. Do not create a legacy JWT template.
3. Set all Clerk variables shown in `.env.example`. `CLERK_ISSUER` must exactly equal the issuer Supabase trusts.
4. Register `POST /api/webhooks/clerk` for `user.created`, `user.updated`, and `user.deleted`, then set its signing secret.
5. When rotating Clerk signing keys, account for Supabase's roughly 30-minute JWKS cache. Keep the prior key valid through the overlap and prove a new-token RLS request before retiring it.

## Rehearsal

1. Apply migrations to a disposable database and run `npm run test:supabase:local`.
2. Export users into a protected JSON file with `id`, `email`, `emailVerified`, `displayName`, and optional bcrypt `passwordDigest`.
3. Validate without making changes:

   `npm run clerk:migrate-users -- --input /secure/users.json`

4. Disable or queue Clerk webhook ingress during the import, then run the importer with `--apply`. This prevents a `user.created` event from allocating a fresh UUID before the migration ledger is linked.
5. Re-enable webhook delivery and replay queued events. Confirm every imported Clerk subject maps to its original profile UUID.
6. Run `npm run verify:workflow` and `npm run verify:auth` against the Clerk development instance.
7. Exercise the exact same-network signup flow only against non-production:

   `CLERK_LOAD_TEST_BASE_URL=http://127.0.0.1:3100 CLERK_LOAD_TEST_EMAIL_TEMPLATE='load+{n}@your-test-domain' CLERK_LOAD_TEST_PASSWORD='test-only-password' CLERK_LOAD_TEST_USERS=50 npm run clerk:load-signup -- --confirm-create-users`

## Go/no-go gates

- Full migration reset, pgTAP, lint, TypeScript, unit tests, and production build pass.
- A real imported bcrypt account signs in without a reset; unsupported auth methods have an explicit reset/support path.
- New signup, verification, recovery, logout, resume upload/read, admin creation, and every role destination pass with Clerk tokens.
- Clerk confirms the event's expected same-network burst and verification-email volume, or the tested flow completes at the target load with acceptable latency.
- Live database catalog assertions match the migration's expected 88 functions and 22 policies.
- A snapshot exists for profiles, identities, memberships, applicants, audits, and provider-user reconciliation.

## Rollback

Keep the provider-neutral database migration in place. Before public Clerk signup, rollback can restore the old Supabase-auth application while retaining dormant Supabase users and secrets. After Clerk-only users exist, rollback is degraded: set a numeric trigger (failed-login rate, error rate, or latency threshold), stop new signup, preserve Clerk sessions, and reconcile those users rather than deleting or re-keying them. Do not remove Supabase users or recovery secrets until the recovery window closes.
