# Rush readiness evidence — 2026-09-02

Base commit inspected: `ff4f036793d48e1a39bdd877819e75573454a743`

## Verdict

**Technical production readiness: PASS. Formal release sign-off: NO-GO until the remaining policy approvals and human release checks below are completed.**

The repository builds, its deterministic suites pass, the complete local and linked-production database migration chains are valid, and the public browser smoke matrix passes on desktop and mobile. After the audit, the release owner authorized the production configuration changes, merge, and linked-production migrations recorded below. Release record `57d39c3` is deployed to Vercel Production; no production message has been sent.

## Rush application requirements

The Fall 2026 application schema is ordered and enforced as follows:

1. MECG environment and motivation — 300-word maximum.
2. Local community improvement — 250-word maximum.
3. Unrelated expertise — 50-word maximum.

The 50-word maximum for the third response was confirmed by the release owner on 2026-09-02.

The limits are stored with the question definitions, returned by the intake and Board settings RPCs, displayed and validated in the application UI, enforced again by a database trigger, and snapshotted onto submitted responses. Existing cohorts with a submitted application are not rewritten by the migration.

## Readiness repairs completed

- Added Board/Owner application-window editing with Detroit-time validation, database locking, lifecycle restrictions, and audit events.
- Made application question order, choice options, and word limits editable and fail-closed across the Board UI, intake boundary, submission trigger, and reviewer display.
- Preserved provider-neutral Clerk identity resolution in every function redefined by the new migrations, with migration-order regression assertions.
- Made the protected workflow rehearsal provider-neutral and verified it end to end with temporary Clerk test users against an isolated local Supabase stack; the verifier transaction rolled back and the users were removed.
- Removed two Clerk launch blockers in the applicant path: draft email now comes from the verified caller instead of an absent JWT email claim, and resume Storage policies resolve the provider-neutral actor instead of calling `auth.uid()`.
- Aligned resume visibility with the candidate-access capability and made repeated resume attachment safe to retry.
- Added a public infrastructure preflight that checks all required Clerk custom-domain CNAMEs before release.
- Published all five Clerk custom-domain CNAMEs in Wix DNS. Public DNS resolves every record, the Clerk environment endpoint returns HTTP 200, and the production sign-in form renders in a headless browser.
- Created the production Clerk webhook endpoint at `https://mecgmichigan.com/api/webhooks/clerk`, restricted it to `user.created`, `user.updated`, and `user.deleted`, and added its signing secret as a Vercel Secret in both Preview and Production without recording the value.
- Added generated `CRON_SECRET` and the approved `CONTACT_TO_EMAIL` to both Vercel Preview and Production without recording their values.
- Added `RESEND_FROM_EMAIL` as `MECG Recruitment <noreply@mecgmichigan.com>` to both Vercel Preview and Production.
- Added the release-owner-supplied sending-only `RESEND_API_KEY` to both Vercel Preview and Production; its value is not recorded here. The release owner explicitly accepted continued use after it was pasted in the task conversation.
- Created the `mecgmichigan.com` sending domain in Resend and published its DKIM TXT, `rsend`/`send` CNAME, and DMARC TXT records in Wix. Independent public DNS queries return all four expected values, and Resend reports the domain as `verified`.
- Added the static SQL boundary check to application CI.
- Centralized constant-time cron bearer authentication across all scheduled routes.
- Kept failed reminder deliveries retryable; malformed reminder payloads now fail closed; scheduled workers return degraded status when delivery, recording, or storage cleanup fails.
- Added route coverage for worker degradation and attendance exports. Attendance CSVs are cycle-authorized, non-cacheable, and spreadsheet-formula safe.
- Disabled the proposed two-year retention schedule and revoked its service-role execution permission. Retention remains dormant until an approved policy migration supplies the real periods.
- Added global error/not-found recovery, escaped structured data, sandboxed resume preview content, and closed the accessibility findings found during the changed-scope review.
- Added user/cycle/schema-scoped application draft recovery and exact-assignment/rubric evaluation draft recovery, both fail-closed and covered by focused tests.
- Made applicant status refresh truthful across interval, focus, reconnect, and manual checks.
- Added an applicant-operations-only assisted check-in workflow with exact candidate matching, row locks, idempotency, and actor/reason audit fields. Attendance remains non-scoring.

## Verification evidence

| Command | Exit | Result |
| --- | ---: | --- |
| `npm test` | 0 | 246/246 Node unit and route tests passed. |
| `npx tsc --noEmit` | 0 | TypeScript passed. |
| `npm run lint` | 0 | ESLint passed with no findings. |
| `npm run check:sql` | 0 | Parsed 103 SQL files and 265 function bodies; checked 80 RPCs and 24 tables. It also rejects duplicate migration versions. |
| `supabase db lint --local --schema rush --level error --fail-on error` | 0 | The complete disposable `rush` schema returned no errors. |
| `supabase db lint --linked --schema rush --level error --fail-on error` | 0 | The currently deployed linked `rush` schema returned no errors. |
| `supabase test db … supabase/tests/rush_foundation.sql` | 0 | 251/251 pgTAP assertions passed in a fresh isolated stack after the uniquely ordered full migration chain, including the provider-neutral workflow, Storage fixes, and application draft limits. The exact stack and temporary files were then removed. |
| `supabase test db supabase/tests/staff_assisted_checkin.sql` | 0 | 20/20 authorization, audit, cycle-isolation, and idempotency assertions passed. |
| `node scripts/verify-full-workflow.mjs` against disposable staging | 0 | The full Clerk-backed Owner, Panel, and Applicant workflow passed; its database transaction rolled back and temporary Clerk test users were deleted. |
| Public DNS, Clerk endpoint, and browser login checks | 0 | All five Clerk CNAMEs resolve to the expected targets; `/__clerk/v1/environment` returns HTTP 200 and the production form renders email and password controls. |
| Clerk/Svix endpoint and Vercel environment verification | 0 | A fresh portal session confirmed the exact production endpoint and only the three supported user lifecycle subscriptions; Vercel lists `CLERK_WEBHOOK_SIGNING_SECRET` as a hidden Secret in both Preview and Production. |
| `CI=1 PLAYWRIGHT_PORT=3199 npm run test:e2e` | 0 | 8/8 production-mode Chromium desktop/mobile smoke tests passed in isolation from another session's stale server on port 3100. |
| `npx react-doctor@latest --verbose --scope changed` | 0 | Scanned 52 changed React files and reported no diagnostics. |
| `npx next build --webpack` | 0 | Next.js 16.3.1 production build compiled, type-checked, and generated all 78 pages. |
| GitHub Actions at `ca2dd53` | 0 | Application lint, 246 tests, type-check, SQL validation, production build, and 8 browser tests passed; the isolated database applied the full migration chain, passed schema lint, and passed 251 pgTAP assertions; live production migration parity passed. |
| Production smoke check at `ca2dd53` | 0 | `/api/health`, `/home`, `/login`, `/join`, and `/__clerk/v1/environment` return HTTP 200. The health database probe completed in 180 ms. |
| `npm run supabase:verify-project` with the service credential supplied in memory by the authenticated Supabase CLI | 0 | Verified project `chrxtsohxazngabdcpzb` is the configured, linked, `ACTIVE_HEALTHY` MECG Recruitment project and serves the `rush` schema. No credential was printed or persisted. |
| `npm run verify:backend` with the same in-memory credential | 0 | The live backend denied anonymous base-table and fixture access, safely returned an empty public token lookup, exposed all required RPCs, and retained complete migration parity. |
| Production operational aggregate check | 0 | The application portal allowlist has zero entries, so intake is unrestricted. The notification outbox, pending-reminder list, and stale-pending-resume list are all empty. The query returned counts only and did not modify data. |
| `supabase backups list --project-ref chrxtsohxazngabdcpzb --output-format json` | 0 | Eight consecutive physical backups from August 26 through September 2 report `COMPLETED`; the latest completed at `2026-09-02T06:18:42.764Z`. PITR remains disabled. |
| Current Vercel deployment inspection and health probe | 0 | Deployment `dpl_V3nZbGfkR5qT43BCT9Jy88wqH4nm` for `57d39c3` is Production `Ready` and owns all production aliases. It has no error entries since activation. A fresh `/api/health` request returned HTTP 200 in 393 ms with a 182 ms database probe. |
| Production portal-state check | 0 | `public_recruitment` reports the Fall 2026 cycle `OPEN`, with intake opening September 2 at 8:00 PM EDT and closing September 11 at 11:00 AM EDT. The live `/apply` page displays the same window and its pre-open state. |
| Vercel environment-scope check | 0 | Clerk webhook, Resend, contact, and cron secrets are present as hidden Secrets in both Preview and Production. No value was read. |
| Clerk production deployment status | 0 | Clerk reports DNS, proxy, mail, and OAuth deployment complete. The instance deliberately uses `https://mecgmichigan.com/__clerk`; direct custom-host SSL is not required in proxy mode. |
| Resend domain status | 0 | The authenticated Resend dashboard reports `mecgmichigan.com` as `verified`. |
| `git diff --check` | 0 | No whitespace errors. |

The production build could not reach the linked Supabase hostname from the restricted sandbox while collecting public project data. That path failed closed and the build completed. The normal Turbopack build could not bind its sandbox worker port (`EPERM`), so the documented Next.js webpack fallback was used to validate the production compilation.

## Protected gates still required

- Provision or identify an approved staging Supabase project, then run `npm run supabase:verify-project`, `npm run supabase:lint`, `npm run test:supabase`, `npm run verify:backend`, `npm run verify:auth`, and `npm run verify:workflow` against it. The disposable local staging rehearsal and read-only production project/backend verifiers passed, but neither substitutes for the protected hosted staging environment. The accessible Supabase account currently contains production and two inactive projects; none is identified or approved as staging.
- Record scheduled-job executions after the newly deployed cron schedules have had a chance to run, and send one controlled recruitment email to an explicitly approved recipient. Portal access is already confirmed unrestricted with the configured September 2 8:00 PM EDT opening window; the production database currently reports no stale resume upload for cleanup.
- Complete and approve every unresolved item in `docs/policies/recruitment-policy.md`, including quorum, correction workflows, missed-round handling, applicant feedback, and retention. The code defaults are not Board approval.
- Decide whether Rush requires a sensitive applicant-response export. The implemented export is attendance-only. A broad applicant export is deliberately absent because the plan requires purpose limitation, audit logging, and break-glass governance that have not been approved or built.
- Restore a recent encrypted production backup into an isolated staging project and record the result using `docs/runbooks/backup-and-restore.md`. Eight consecutive physical backups report complete and the latest completed on 2026-09-02, but no isolated restore target is approved for a rehearsal and PITR is disabled.
- Have the release owner review the final diff, identify the release commit, approve rollback/forward repair, and sign the readiness record.

Do not mark the production release complete until every protected gate exits successfully and the release-owner checks are recorded.
