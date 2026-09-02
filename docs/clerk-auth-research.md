# Clerk as the authentication layer for Pro

Date checked: 2026-09-01

## Conclusion

Clerk can replace Supabase Auth while the application keeps Supabase Postgres, Storage, Realtime, and the Data API. Supabase and Clerk now have a first-class third-party-auth integration: Supabase verifies Clerk's asymmetrically signed session token, and `@supabase/supabase-js` supplies that token through its `accessToken` callback. This is the supported path; the older Clerk "Supabase JWT template" integration has been deprecated since April 1, 2025. ([Supabase Clerk guide](https://supabase.com/docs/guides/auth/third-party/clerk), [Clerk Supabase guide](https://clerk.com/docs/guides/development/integrations/databases/supabase))

This is feasible, but it is not a drop-in SDK swap for this repository. Clerk user IDs look like `user_123` and appear in the JWT `sub` claim. This database is built around UUID users, `auth.uid()`, and foreign keys to `auth.users`. Supabase's `auth.uid()` returns `uuid` by casting JWT `sub`, so it cannot represent a Clerk string ID. The native integration guides therefore use `auth.jwt()->>'sub'`, not `auth.uid()`. ([Clerk session-token claims](https://clerk.com/docs/guides/sessions/session-tokens), [Supabase Postgres definition of `auth.uid()`](https://github.com/supabase/postgres/blob/develop/migrations/schema-17.sql), [Clerk RLS example](https://clerk.com/docs/guides/development/integrations/databases/supabase))

The safest design for this app is to preserve its UUID application-user keys, add a mapping from Clerk's string ID to the existing UUID, and replace `auth.uid()` calls with one audited database helper that resolves the current Clerk `sub`. Do not convert every domain table to text IDs and do not mint a legacy Supabase JWT template. The mapping lets existing UUID foreign keys and historical records stay stable while the supported Clerk token remains intact.

Clerk directly removes the specific Supabase default-email bottleneck. Verification and reset emails would be sent by Clerk, not Supabase's built-in sender, so Supabase's two-auth-emails-per-hour limit would no longer govern those flows. Clerk also provides password sign-in, reset codes, email verification, bot challenges, endpoint rate limits, and account lockout. It does not remove this application's own IP rate limit unless the old signup/login routes and database limiter are retired, and Clerk does not publicly document a production email-per-hour ceiling. Confirm expected rush-night volume with Clerk before committing to cutover. ([Supabase rate limits](https://supabase.com/docs/guides/auth/rate-limits), [Clerk auth options](https://clerk.com/docs/guides/configure/auth-strategies/sign-up-sign-in-options), [Clerk email delivery](https://clerk.com/docs/guides/development/troubleshooting/email-deliverability), [Clerk system limits](https://clerk.com/docs/guides/how-clerk-works/system-limits))

## What Clerk would own

Clerk can own registration, email verification, password sign-in, password reset, sessions, sign-out, and user-facing account management. Its prebuilt `<SignUp />`, `<SignIn />`, and `<UserProfile />` flows follow settings configured in the Clerk Dashboard; password reset sends a code to an enabled email or phone identifier, verifies it, updates the password, and signs the user in. ([Clerk Next.js quickstart](https://clerk.com/docs/getting-started/quickstart), [authentication options](https://clerk.com/docs/guides/configure/auth-strategies/sign-up-sign-in-options), [forgot-password flow](https://clerk.com/docs/guides/development/custom-flows/authentication/forgot-password))

For production email, Clerk asks the operator to configure DNS records so messages are verified from the application's domain. Clerk documents SPF and DKIM setup as part of production configuration, recommends DMARC, and says it sends through a pool of dedicated IP addresses. A team can instead disable Clerk delivery per template, receive `email.created` webhooks, and send through its own provider. ([production deployment](https://clerk.com/docs/guides/development/deployment/production), [email deliverability](https://clerk.com/docs/guides/development/troubleshooting/email-deliverability))

The normal choice here should be Clerk-hosted components first. They already handle resend cooldowns, session tasks, errors, bot challenges, and future auth strategy changes. A custom flow is possible, but custom sign-up UI must include Clerk's CAPTCHA mount point when bot protection is enabled. ([authentication options](https://clerk.com/docs/guides/configure/auth-strategies/sign-up-sign-in-options), [bot protection](https://clerk.com/docs/guides/secure/bot-protection))

Supabase would continue to own Postgres, RLS enforcement, Storage, Realtime, and other database services. Supabase says third-party tokens can authorize its REST and GraphQL Data APIs, Storage, Realtime, and Functions. Supabase Auth cannot currently be disabled, but the application can stop using it. ([Supabase third-party-auth overview](https://supabase.com/docs/guides/auth/third-party/overview))

## The two-emails-per-hour question

What Clerk solves:

- New-account verification and password-reset messages can be delivered by Clerk instead of the Supabase default sender. The Supabase default sender's quota is therefore no longer on the request path. ([Supabase rate limits](https://supabase.com/docs/guides/auth/rate-limits), [Clerk email delivery](https://clerk.com/docs/guides/development/troubleshooting/email-deliverability))
- Password login itself does not require an email. Clerk's password strategy authenticates against the stored password, subject to its anti-abuse controls. ([authentication options](https://clerk.com/docs/guides/configure/auth-strategies/sign-up-sign-in-options))
- Production delivery uses a verified application domain. The team can keep Clerk delivery or take over individual templates through `email.created` webhooks. ([email deliverability](https://clerk.com/docs/guides/development/troubleshooting/email-deliverability))

What Clerk does not solve automatically:

- Clerk rate-limits browser-facing requests by IP. The published limits include 5 signup creations per 10 seconds, 5 sign-in creations per 10 seconds, and 3 verification attempts per 10 seconds. These are short burst controls, not a two-per-hour cap, but a very large group behind one campus NAT could still see `429` responses during a synchronized rush. Responses include `Retry-After`. ([Clerk system limits](https://clerk.com/docs/guides/how-clerk-works/system-limits))
- This repository has its own signup and login limiters. Replacing the auth flows must remove those old routes from the active path; otherwise Clerk sits behind the same application bottleneck. ([application rate-limit migration](../supabase/migrations/20260825000000_rate_limits.sql), [login route](../src/app/api/auth/login/route.ts))
- Development instances are capped at 100 users. Clerk-delivered development traffic is limited to 100 emails and 20 SMS messages per calendar month unless it is exempt, including test addresses, self-delivery, US SMS, a support increase, or a paid subscription. Development instances cannot be promoted or copied into production. ([Clerk environments](https://clerk.com/docs/guides/development/managing-environments), [test email limits](https://clerk.com/docs/guides/development/testing/test-emails-and-phones))
- **Unknown:** Clerk's public documentation does not state a general production verification-email throughput limit. Get a written answer from Clerk for the forecast maximum concurrent signups, the expected shared-IP/NAT pattern, and delivery burst before the go/no-go decision.

## Abuse and account protection

Clerk's published browser limits are per user as identified by IP. Its production Backend API limit is 1,000 requests per 10 seconds per secret key; development is 100 per 10 seconds. Invitation endpoints have separate hourly limits, so do not model normal applicant signup as bulk Clerk invitations without checking those quotas. ([Clerk system limits](https://clerk.com/docs/guides/how-clerk-works/system-limits))

Clerk bot protection uses CDN signals and shows a challenge only when it suspects automation. Newer applications use its Smart mode. The browser path can bypass CAPTCHA only through Clerk's Native API setting, so leave Native API disabled for this web-only application unless a native client later requires it. ([Clerk bot protection](https://clerk.com/docs/guides/secure/bot-protection))

Clerk can lock an account after repeated failed checks. New instances default to 10 failed attempts and a one-hour cooldown; tracked actions include password attempts, reset attempts, backup codes, email or phone codes, and TOTP. An administrator can unlock the user, but Clerk currently has no self-service unlock request. ([Clerk user lockout](https://clerk.com/docs/guides/secure/user-lockout))

Clerk also documents leaked-password checks, strength rules, user-enumeration protection, disposable-email restrictions, and access allowlists/blocklists. Decide these settings explicitly in the production instance rather than relying on dashboard defaults. ([Clerk security overview](https://clerk.com/docs/guides/secure/overview), [password protection](https://clerk.com/docs/guides/secure/password-protection-and-rules))

## Next.js 16.3 integration

This repository pins Next.js `16.3.1`. In Next.js 16, `middleware.ts` was deprecated and renamed to `proxy.ts`; Proxy defaults to the Node.js runtime. A project using `src/app` places the file at `src/proxy.ts`. Next.js warns that Server Functions inherit the matcher coverage of the route containing them and recommends authorization inside each Server Function rather than relying on Proxy alone. ([package manifest](../package.json), [Next.js Proxy reference](https://nextjs.org/docs/app/api-reference/file-conventions/proxy))

The current Clerk quickstart supports `proxy.ts`. The initial integration is:

1. Install the current compatible `@clerk/nextjs` release and add the production/development publishable and secret keys.
2. Export `clerkMiddleware()` from `src/proxy.ts` with Clerk's documented matcher. By default Clerk's middleware protects no route, so opt in to protected routes or check auth at each server boundary.
3. Put `<ClerkProvider>` inside `<body>` at the root layout. Use hosted `<SignIn />` and `<SignUp />` pages or the Account Portal.
4. In Server Components, Route Handlers, and Server Actions, call the async `await auth()` and enforce authentication or authorization beside the operation. ([Clerk Next.js quickstart](https://clerk.com/docs/getting-started/quickstart), [`auth()` reference](https://clerk.com/docs/reference/nextjs/app-router/auth))

The app's Supabase client factories must pass the current Clerk session token through `accessToken`. Server code gets it from `(await auth()).getToken()`; browser code gets it from Clerk's session. This uses the ordinary Clerk session token, not a named JWT template. ([Clerk Supabase guide](https://clerk.com/docs/guides/development/integrations/databases/supabase), [Supabase Clerk guide](https://supabase.com/docs/guides/auth/third-party/clerk))

## Native Clerk to Supabase integration

Enable "Supabase integration" in Clerk, copy the Clerk instance domain, then add Clerk under Supabase Authentication > Sign In / Providers > Third-Party Auth. For local Supabase, configure `[auth.third_party.clerk]` with `enabled = true` and the development Clerk domain. The integration adds the required `"role": "authenticated"` claim to Clerk session tokens. ([Clerk Supabase guide](https://clerk.com/docs/guides/development/integrations/databases/supabase), [Supabase Clerk guide](https://supabase.com/docs/guides/auth/third-party/clerk))

Do not use the legacy "Supabase JWT template." Supabase deprecated that route because it shares the project's JWT secret, makes secret rotation likely to cause downtime, and adds token-generation latency. The native integration accepts Clerk's existing asymmetrically signed token and needs no shared signing secret. ([Supabase Clerk guide](https://supabase.com/docs/guides/auth/third-party/clerk), [Supabase announcement](https://supabase.com/blog/clerk-tpa-pricing))

Supabase caches third-party signing-key configuration and checks for changes periodically. Its documentation says key rotation can take up to 30 minutes to be picked up. Plan rotations and incident procedures around that delay. ([Supabase third-party-auth overview](https://supabase.com/docs/guides/auth/third-party/overview))

## RLS and identity design for this repository

Clerk's `sub` is the Clerk user ID, for example `user_123`, and cannot be overridden as a default session-token claim. Supabase exposes it unchanged through `auth.jwt()->>'sub'`. Clerk's reference RLS policies compare that text value to a text `user_id` column. ([Clerk session tokens](https://clerk.com/docs/guides/sessions/session-tokens), [Clerk Supabase guide](https://clerk.com/docs/guides/development/integrations/databases/supabase))

This repository cannot follow that example literally without a large schema rewrite:

- 48 migration files call `auth.uid()`. ([foundation migration example](../supabase/migrations/20260821090000_rush_foundation.sql))
- Core SQL functions declare the actor as `uuid := auth.uid()`. ([application-intake migration example](../supabase/migrations/20260822130000_application_intake.sql))
- `rush.profiles.id`, `rush.pnms.auth_user_id`, audit actor fields, project membership, reminders, and other records use UUID identities. ([foundation schema](../supabase/migrations/20260821090000_rush_foundation.sql), [projects schema](../supabase/migrations/20260901080000_projects_and_staffing.sql), [reminders schema](../supabase/migrations/20260901090000_reminders.sql))
- At least nine migrations define or depend on joins or foreign keys to `auth.users`. ([foundation schema](../supabase/migrations/20260821090000_rush_foundation.sql), [legacy core tables](../supabase/migrations/20260712184439_20260610000002_core_tables.sql))

Recommended model:

1. Keep the UUID that the application already uses as the canonical domain identity.
2. Add a table such as `rush.auth_identities(provider text, provider_user_id text, app_user_id uuid, ...)`, unique on `(provider, provider_user_id)`, and backfill every imported user's Clerk ID to the existing UUID.
3. Add one stable, `security definer` helper, for example `rush.actor_id() returns uuid`, that reads `auth.jwt()->>'sub'` and looks up the mapping. Lock its `search_path`, revoke public execution where appropriate, grant only the required roles, and test that an unmapped `sub` fails closed.
4. Replace `auth.uid()` in policies and functions with the helper. This is a security migration, not a blind text replacement: inspect every function's volatility, ownership, role grants, and `security definer` behavior.
5. Remove domain-table foreign keys to `auth.users`; repoint them to a canonical application-owned user/profile table. Supabase's Clerk integration verifies identity but does not create or synchronize `auth.users` rows. ([Clerk Supabase guide](https://clerk.com/docs/guides/development/integrations/databases/supabase))
6. For new users, create the application identity synchronously on the first authenticated application request with an idempotent upsert. Do not require a webhook to finish before the first page load. Webhooks remain useful for profile updates and deletion state.

An alternative is to import the old UUID into Clerk public metadata, add it as a small custom session claim, and have RLS cast that claim to UUID. Clerk supports custom claims from public metadata, but token changes can be stale for about 60 seconds and custom claims share a recommended 1.2 KB budget. This is workable, but the database mapping is a better source of truth for an authorization-critical identity. ([Clerk custom session claims](https://clerk.com/docs/guides/sessions/customize-session-tokens), [Clerk metadata](https://clerk.com/docs/guides/users/extending))

**Unknown:** A complete database object inventory still needs to enumerate policies, views, functions, triggers, Storage policies, Realtime authorization, generated types, tests, and seed data that assume `auth.uid()` or `auth.users`. The migration should not be sized from the 48-file grep count alone.

## User synchronization and webhooks

The native Supabase integration does not synchronize Clerk users into application tables. Clerk recommends avoiding a duplicate user table when session claims are enough, but this app needs a local UUID identity and cross-user recruitment data. A local identity/profile record is therefore justified. ([Clerk Supabase guide](https://clerk.com/docs/guides/development/integrations/databases/supabase), [Clerk webhook sync guide](https://clerk.com/docs/guides/development/webhooks/syncing))

Create an unprotected `POST` Route Handler for Clerk webhooks and verify it with `verifyWebhook()`. Subscribe only to required events, probably `user.created`, `user.updated`, and `user.deleted`. Use the Clerk event ID as an idempotency key, upsert by Clerk user ID, store only needed profile fields, and mark deletion rather than cascading historical recruitment records unless the retention policy requires deletion. Clerk retries non-2xx deliveries, supports replay, and describes synchronization as eventually consistent and not guaranteed to arrive immediately. ([`verifyWebhook()` reference](https://clerk.com/docs/reference/backend/verify-webhook), [sync guide](https://clerk.com/docs/guides/development/webhooks/syncing), [webhook overview](https://clerk.com/docs/guides/development/webhooks/overview))

Use the first authenticated request as the critical-path bootstrap. The webhook then reconciles state. This avoids a signup race where Clerk has issued a valid session but the `user.created` delivery has not yet produced a row in Postgres.

## Existing-user migration and password portability

Supabase Auth stores bcrypt password hashes in `auth.users.encrypted_password`; Supabase's docs say the name is historical and the value is a hash, not reversible encryption. Supabase also documents querying `auth.users` and `auth.identities` through SQL to export users. ([Supabase password security](https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/auth/password-security.mdx), [Supabase user export](https://supabase.com/docs/guides/auth/managing-user-data))

Clerk's `createUser()` accepts an existing `passwordDigest` with `passwordHasher: "bcrypt"`, as well as an `externalId` for the previous system's identifier. That means a basic export/import can preserve passwords without asking every password user to reset, subject to a successful pilot against actual hashes. Clerk's production Backend API limit is 1,000 requests per 10 seconds, and its migration tool respects rate limits. ([Clerk `createUser()`](https://clerk.com/docs/reference/backend/user/create-user), [Clerk migration overview](https://clerk.com/docs/guides/development/migrating/overview))

Recommended import fields:

- primary email and its verification state;
- bcrypt digest for password users;
- old Supabase UUID in `externalId` and in the database identity mapping;
- first/last/display-name data only where the source is authoritative;
- account creation time where Clerk's import API accepts it.

Social identities and active sessions need separate treatment. A migrated user may be able to sign in through an enabled OAuth provider and matching verified email, but provider-account linking behavior must be tested. Existing Supabase refresh/access tokens are not Clerk sessions, so the cutover should expect everyone to authenticate again. **Unknown:** no first-party Supabase-to-Clerk guide documents automatic transfer of Supabase OAuth identity bindings or live sessions.

Run a dry import into a disposable Clerk development instance with synthetic or approved test records, then recreate the production import from the source export. Clerk states that development users cannot be transferred to production, so do not import real production users into development expecting promotion. ([Clerk environments](https://clerk.com/docs/guides/development/managing-environments))

Handle conflicts before import: duplicate normalized emails, users without email, unconfirmed addresses, banned/deleted users, phone-only identities, and rows with an empty password hash. **Unknown:** the current production counts and conflict distribution have not been measured in this research pass.

## Pricing and capacity

As checked on 2026-09-01, Clerk's Hobby plan is free for up to 50,000 Monthly Retained Users per app. Pro includes 50,000 MRU and lists $0.02 per additional MRU; it is $20 per month when billed annually on the pricing page. Clerk says exceeding 50,000 MRU requires Pro. Hobby has feature limits, so compare the needed MFA, session, support, and log-retention features before treating it as the production plan. ([Clerk pricing](https://clerk.com/pricing))

Supabase separately meters distinct users who authenticate with a third-party provider. Free includes 50,000 third-party MAU. Pro and Team include 100,000, then charge $0.00325 for each additional third-party MAU. A user counts once per billing cycle even after repeated logins. ([Supabase third-party MAU billing](https://supabase.com/docs/guides/platform/manage-your-usage/monthly-active-users-third-party), [Supabase pricing](https://supabase.com/pricing))

For a university recruitment application that remains below 50,000 retained Clerk users and below Supabase's included third-party MAU quota, user-count overages should be zero. The actual plan decision still depends on required Clerk features and support, not only user count. **Unknown:** forecast applicant/member counts, retention, MFA requirements, and support/SLA needs were not supplied.

## Test plan

Use a separate Clerk development instance and local Supabase third-party configuration. Clerk supplies reserved `+clerk_test` emails and fixed test-code behavior so automated tests do not send real mail. Its `@clerk/testing` Playwright helpers obtain testing tokens, bypass bot detection for the test, and support programmatic sign-in. Keep secret keys in the test runner's secret store. ([test emails](https://clerk.com/docs/guides/development/testing/test-emails-and-phones), [Playwright setup](https://clerk.com/docs/guides/development/testing/playwright/overview), [Playwright helpers](https://clerk.com/docs/guides/development/testing/playwright/test-helpers))

Required automated coverage:

- Proxy matcher unit tests with Next.js `unstable_doesProxyMatch`, plus redirect/response tests for protected pages. Next.js exposes these experimental helpers specifically for Proxy. ([Next.js Proxy testing](https://nextjs.org/docs/app/api-reference/file-conventions/proxy))
- Browser tests for signup, verification, password login, wrong password, reset, sign-out, expired session, and return-to URL.
- Authorization tests for every role and portal boundary using real Clerk-signed test sessions against Supabase, including negative cross-user tests.
- Database tests for mapped, unmapped, deleted, duplicate, and forged `sub` values; every unmapped or malformed identity must fail closed.
- Storage upload/download/delete tests under Clerk sessions because Storage policies also consume JWT claims. Supabase supports third-party JWTs for Storage, but the existing UUID folder policies must be migrated. ([Supabase third-party auth](https://supabase.com/docs/guides/auth/third-party/overview))
- Webhook signature, duplicate event, out-of-order update/delete, retry, and delayed-delivery tests.
- Import rehearsal that verifies a sample of bcrypt users can log in with their unchanged password and that UUID-linked history remains attached.
- Load tests from both varied IPs and a simulated shared campus NAT. Measure Clerk `429` responses, `Retry-After`, successful signup throughput, email arrival latency, first-page bootstrap races, and login throughput.

## Operational cutover

### Phase 0: decision gates

1. Get Clerk confirmation for the expected production signup/email burst and shared-NAT behavior.
2. Inventory current users, auth methods, duplicate emails, password-hash formats, schema dependencies, and production volume.
3. Select the Clerk plan and confirm Supabase third-party MAU cost.
4. Approve the identity-mapping/RLS design after a database security review.

### Phase 1: build without traffic

1. Create Clerk development and production instances. Configure email/password, verification, reset, bot protection, lockout, enumeration protection, redirect URLs, and production domain DNS. Production integration, paths, webhooks, and SSO settings do not copy automatically from development. ([Clerk production deployment](https://clerk.com/docs/guides/development/deployment/production))
2. Enable the native Supabase integration in each environment.
3. Add Clerk to Next.js, authenticated Supabase client factories, the identity mapping, synchronous user bootstrap, webhook reconciliation, and converted RLS/database functions.
4. Keep existing Supabase Auth live during development, but do not let a request ambiguously choose between Clerk and Supabase identity.

### Phase 2: prove migration

1. Export users and build a deterministic, restartable import with a manifest recording source UUID, Clerk ID, outcome, and error without logging password digests.
2. Run synthetic and approved sample imports. Verify unchanged-password login, email verification state, profile/history linkage, webhook behavior, and rollback artifacts.
3. Run the full automated suite and rush-volume load test.
4. Freeze schema changes that touch identity until cutover finishes.

### Phase 3: production cutover

1. Take a final user export during a short signup/auth write freeze.
2. Import or upsert users into the Clerk production instance and backfill the identity map.
3. Deploy Clerk keys, Clerk `proxy.ts`, native Supabase integration, RLS conversion, webhook signing secret, and Clerk UI as one coordinated release.
4. Force a new login. Old Supabase sessions are not Clerk sessions.
5. Keep the old auth records read-only for a defined recovery window. Do not delete `auth.users` during the initial cutover.

### Phase 4: observe and retire

Monitor signup completion, verification delivery time, password reset success, login failures, Clerk `429`/5xx rates, webhook lag/retries, unmapped identities, Supabase RLS denials, support tickets, and third-party MAU. Establish explicit rollback thresholds before release.

Rollback means routing authentication back to the unchanged Supabase Auth implementation while retaining the Clerk import and mapping for analysis. Database migrations must be designed so the old UUID data remains intact. After the recovery window and a clean audit, remove old Supabase auth routes, client session helpers, auth triggers, application rate-limit functions used only by those routes, and obsolete secrets. Supabase Auth itself remains present on the hosted project because Supabase currently cannot disable it. ([Supabase third-party-auth limitations](https://supabase.com/docs/guides/auth/third-party/overview))

## Go/no-go recommendation

Proceed to a time-boxed Clerk migration spike, not directly to production implementation. The product fit is good and it removes dependence on Supabase's built-in email sender. The hard part is the database identity boundary, not the login screen.

The spike passes only if it proves all four conditions:

1. an imported Supabase bcrypt user signs into Clerk with the same password;
2. a Clerk session accesses Supabase through the native integration with RLS enforced;
3. the UUID identity mapping preserves an existing user's records and creates a new user without an `auth.users` row;
4. the expected shared-IP signup burst stays within Clerk's limits and mail arrives within the agreed operational target.

If any condition fails, stop and revise the migration design before touching production auth.
