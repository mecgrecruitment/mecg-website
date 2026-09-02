# Clerk cutover runbook

The code migration is complete, but the provider configuration and real-user import are controlled operations. Do not enable public Clerk signup until every gate below passes.

## Current rollout status

As of September 2, 2026:

- Google sign-in is disabled in both Clerk instances. Email and password are the only configured sign-in methods.
- Both Clerk instances contain zero users. No user migration or production canary has run.
- Clerk reports the production domain as `domain_pending`. DNS, SSL, and mail verification are pending.
- The live `POST /api/webhooks/clerk` route returns `404`. Do not create the production webhook until an unsigned request reaches the deployed handler and returns `400`.
- The local Clerk environment lacks `CLERK_WEBHOOK_SIGNING_SECRET`. Create the production webhook only after the handler is live, then store the secret in the deployment environment.
- The Clerk MCP is registered in Codex. Restart Codex or open a new task before trying to use it.

Add these CNAME records in Wix DNS:

| Host | Value |
|---|---|
| `clerk.mecgmichigan.com` | `frontend-api.clerk.services` |
| `accounts.mecgmichigan.com` | `accounts.clerk.services` |
| `clkmail.mecgmichigan.com` | `mail.j9fyrp9lip0l.clerk.services` |
| `clk._domainkey.mecgmichigan.com` | `dkim1.j9fyrp9lip0l.clerk.services` |
| `clk2._domainkey.mecgmichigan.com` | `dkim2.j9fyrp9lip0l.clerk.services` |

## Complete the production cutover

Run these steps in order. Stop when a check fails.

1. Push the verified Clerk commits and deploy them with `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, and `CLERK_ISSUER` from `.env.example`.
2. Add the five Clerk CNAME records in Wix. Run `npx -y clerk@latest deploy status --mode agent` until DNS, SSL, and mail all report ready.
3. Configure Supabase's native Clerk provider with the exact `CLERK_ISSUER`. Test a Clerk token against one read policy and one write policy.
4. Send an unsigned request to `https://mecgmichigan.com/api/webhooks/clerk`. Continue only when the handler returns `400` instead of `404`.
5. Create the Clerk webhook for `user.created`, `user.updated`, and `user.deleted`. Store the generated signing secret as `CLERK_WEBHOOK_SIGNING_SECRET` in the deployment environment.
6. Redeploy. Confirm that `/login` loads the Clerk script without CSP errors and shows no Google button.
7. Rotate the secret key that appeared in chat. Keep the old key active for a short overlap, update the deployment environment, redeploy, then revoke the old key.
8. Create one development user. Test signup, email verification, password recovery, login, logout, UUID provisioning, Supabase RLS, and resume Storage access.
9. Run the same checks with one production canary account. Delete the canary only if recruitment policy requires it and the identity ledger can reconcile the deletion.
10. Run the development-only load test and record `429`, retry, email, webhook, RLS, and Storage results. Contact Clerk before any production-like burst test.
11. Open signup in staggered cohorts. Keep cellular data optional, staff a help path, and avoid synchronized refresh instructions.

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
