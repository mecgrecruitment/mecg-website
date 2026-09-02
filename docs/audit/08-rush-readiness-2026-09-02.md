# Rush readiness evidence — 2026-09-02

Base commit inspected: `ff4f036793d48e1a39bdd877819e75573454a743`

## Verdict

**Code readiness: PASS. Production release: NO-GO until the protected environment gates, policy approvals, and human release checks below are completed.**

The repository builds, its deterministic suites pass, the complete local database migration chain is valid, and the public browser smoke matrix passes on desktop and mobile. After the audit, the release owner authorized the production configuration changes and merge recorded below. Commit `f8b9bf5` is deployed to Vercel Production; no production message or linked-production database mutation has been performed.

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
- Created the `mecgmichigan.com` sending domain in Resend and published its DKIM TXT, `rsend`/`send` CNAME, and DMARC TXT records in Wix. Independent public DNS queries return all four expected values; Resend's provider-side verification remains pending.
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
| GitHub Actions application and isolated-database jobs at `f8b9bf5` | 0 | Application lint, 246 tests, type-check, SQL validation, production build, and 8 browser tests passed; the isolated database applied the full migration chain, passed schema lint, and passed 251 pgTAP assertions. The separate live-migration parity job correctly failed on the protected production drift below. |
| Production smoke check at `f8b9bf5` | mixed | `/home`, `/login`, and `/__clerk/v1/environment` return HTTP 200. `/api/health` returns HTTP 503 while the linked production database is missing the eleven migrations listed below. |
| `git diff --check` | 0 | No whitespace errors. |

The production build could not reach the linked Supabase hostname from the restricted sandbox while collecting public project data. That path failed closed and the build completed. The normal Turbopack build could not bind its sandbox worker port (`EPERM`), so the documented Next.js webpack fallback was used to validate the production compilation.

## Protected gates still required

- Vercel Production successfully deployed commit `f8b9bf5` with the configured environment values. Repeat the smoke matrix after the production database migration gate is completed.
- Resolve and re-test direct TLS access to `clerk.mecgmichigan.com`. Its five DNS records pass the infrastructure preflight and the main-site Clerk proxy renders, but direct OpenSSL, curl, and Supabase CLI validation currently receive a TLS handshake/certificate error. The isolated migration rehearsal therefore disabled only the temporary stack's external Clerk validator; hosted Clerk-token verification remains a protected gate.
- Click **Verify DNS Records** for `mecgmichigan.com` in Resend and wait for provider status `Verified` before relying on `noreply@mecgmichigan.com` for production delivery. All four required/recommended values already resolve correctly in public DNS.
- Provision or identify an approved staging Supabase project, then run `npm run supabase:verify-project`, `npm run supabase:lint`, `npm run test:supabase`, `npm run verify:backend`, `npm run verify:auth`, and `npm run verify:workflow` against it. The disposable local staging rehearsal passed, but it is not a substitute for the protected hosted environment.
- Apply the unique pending migrations `20260902100000`, `20260902110000`, `20260902120000`, `20260902130000`, `20260902135000`, `20260902145000`, `20260902150000`, `20260902160000`, `20260902170000`, `20260902180000`, and `20260902190000` to an approved staging project, complete the hosted checks above, and obtain explicit production-change approval before pushing them to the linked production project. Until then, the live-migration parity job and `/api/health` correctly fail. Migration `20260902120000` is a safety hold: do not re-enable applicant-data retention until policy approval is recorded and encoded in a later migration.
- Confirm the intended portal open/restricted state, scheduled-job history, one controlled recruitment email, and a recent resume-cleanup run.
- Complete and approve every unresolved item in `docs/policies/recruitment-policy.md`, including quorum, correction workflows, missed-round handling, applicant feedback, and retention. The code defaults are not Board approval.
- Decide whether Rush requires a sensitive applicant-response export. The implemented export is attendance-only. A broad applicant export is deliberately absent because the plan requires purpose limitation, audit logging, and break-glass governance that have not been approved or built.
- Restore a recent encrypted production backup into an isolated staging project and record the result using `docs/runbooks/backup-and-restore.md`. The latest listed physical backup completed on 2026-09-02, but no isolated restore target was available for a rehearsal and PITR is disabled.
- Have the release owner review the final diff, identify the release commit, approve rollback/forward repair, and sign the readiness record.

Do not mark the production release complete until every protected gate exits successfully and the release-owner checks are recorded.
