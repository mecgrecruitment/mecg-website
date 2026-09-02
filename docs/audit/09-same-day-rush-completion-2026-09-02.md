# Complete the remaining Rush work on September 2, 2026

Status: repository-local workflows complete; protected release gates remain open

Release base: `ff4f036793d48e1a39bdd877819e75573454a743` plus the current uncommitted working tree

## Do not duplicate active work

Other sessions have already changed the shared checkout. Preserve those edits.
Before changing a file, run `git status --short` and inspect its current diff.
If another session changes the same file during an edit, stop and reconcile the
new version before applying a patch.

The current working tree already contains work for:

- Clerk custom-domain DNS and infrastructure checks;
- provider-neutral Clerk identity resolution and workflow verification;
- application dates, question order, and word limits;
- a shared signed resume-upload helper;
- resume access and Storage-policy corrections;
- retry-safe resume attachment;
- cron authorization and degraded worker responses;
- application rate limits for both the caller and the shared IP;
- public desktop and mobile browser smoke tests;
- a retention safety hold;
- global error and not-found recovery.

Do not rewrite these areas unless a failing check identifies a defect.

## Same-day workflows

| Workflow | Owner | Files or system | Done when |
| --- | --- | --- | --- |
| Current-state audit | `active_work_audit` | Read-only repository review | Every launch item is marked complete, open, or externally blocked with evidence. |
| Applicant status reliability | `status_reliability` | Applicant status refresh code and focused tests | Status refresh works on an interval, tab focus, reconnect, and manual request without claiming a refresh completed before evidence. |
| Application draft recovery | `draft_recovery` | Session-scoped draft recovery code and tests | A refresh restores safe unsaved fields for the same user and cycle. Wrong-scope, stale, and malformed snapshots fail closed. |
| Evaluation draft recovery | `evaluation_recovery` | Session-scoped evaluation recovery code and tests | Scores and evidence restore only for the exact assignment and rubric. Wrong-scope, stale, malformed, and oversized snapshots fail closed. |
| Staff-assisted check-in | `assisted_checkin` | Forward-only migration, API, event UI, and tests | Authorized staff can record an audited non-QR check-in. Cross-cycle and unauthorized requests fail. Attendance remains non-scoring. |
| Release integration | Primary session | Shared diff, documentation, and full verification | Parallel work is reconciled and every deterministic repository check passes. |

## Completed today

- The current-state audit classified the remaining launch work and separated
  repository work from protected operator and Board gates.
- Applicant status now refreshes on the 60-second interval, focus, visibility,
  reconnect, and manual request while reporting offline, checking, and
  last-confirmed-check states truthfully.
- Application drafts now recover safe text and selection fields from
  `sessionStorage`, scoped to the exact authenticated user, cycle, and question
  schema. Resume paths, files, and consent are never persisted there.
- Evaluation drafts now recover scores, criterion notes, and overall evidence
  for the exact assignment and rubric, and clear after a locked submission.
- Applicant-operations staff now have an audited assisted check-in path using an
  exact candidate code, uniqname, or email. The database function is
  idempotent, row-locked, cycle-bound, and does not affect evaluation scores.
- The existing work from other sessions was preserved, including Clerk DNS and
  identity verification, provider-neutral workflows, question and cycle
  configuration, resume repairs, cron hardening, shared-IP rate limiting,
  retention hold, and public recovery boundaries.

## Repository checks

The combined shared tree was verified after all workflows finished:

```bash
npm test
npx tsc --noEmit
npm run lint
npm run check:sql
npx next build --webpack
npm run test:e2e
git diff --check
```

Results:

| Check | Exit | Result |
| --- | ---: | --- |
| `npm test` | 0 | 243/243 tests passed. |
| `npx tsc --noEmit` | 0 | Type-check passed. |
| `npm run lint` | 0 | Lint passed. |
| `npm run check:sql` | 0 | Parsed 102 SQL files and 263 function bodies; checked 80 RPCs and 24 tables. |
| `npx next build --webpack` | 0 | Production build completed and generated 78 routes. Expected sandbox DNS failures for the unavailable public Supabase endpoint failed closed. |
| `CI=1 PLAYWRIGHT_PORT=3199 npm run test:e2e` | 0 | 8/8 production-mode desktop and mobile smoke tests passed. Port 3199 isolated the run from another session's stale server on port 3100. |
| `git diff --check` | 0 | No whitespace errors. |

The local Supabase stack was available. Because the checkout does not define
`SUPABASE_AUTH_THIRD_PARTY_CLERK_DOMAIN`, the checks supplied the non-secret
local value `local.clerk.accounts.dev` without changing the shared environment:

```bash
SUPABASE_AUTH_THIRD_PARTY_CLERK_DOMAIN=local.clerk.accounts.dev npm run supabase:lint:local
SUPABASE_AUTH_THIRD_PARTY_CLERK_DOMAIN=local.clerk.accounts.dev supabase test db supabase/tests/rush_foundation.sql
SUPABASE_AUTH_THIRD_PARTY_CLERK_DOMAIN=local.clerk.accounts.dev supabase test db supabase/tests/staff_assisted_checkin.sql
```

All three exited 0: schema lint returned zero errors, the rush foundation suite
passed 250/250 tests, and the assisted check-in suite passed 20/20 tests.

## Protected operator workflow

Repository work cannot complete these steps. An authorized operator must finish
them in the approved hosted environments today.

1. Add the two values that remain missing from the intended Vercel scopes:
   `CLERK_WEBHOOK_SIGNING_SECRET` and `RESEND_API_KEY`. Another session already
   added `RESEND_FROM_EMAIL`, `CONTACT_TO_EMAIL`, and `CRON_SECRET` to Preview
   and Production; verify their presence without copying their values.
2. Provision or select the approved hosted staging Supabase project.
3. Apply every pending migration to staging. The current local sequence ends at
   `20260902180000_staff_assisted_checkin.sql`; re-read the directory immediately
   before applying in case another session adds a later migration.
4. Run `supabase:verify-project`, `verify:infrastructure`, `supabase:lint`,
   `test:supabase`, `verify:backend`, `verify:auth`, and `verify:workflow`
   against staging.
5. Upload, validate, attach, replace, and download a real PDF in a staging
   browser. Test every allowed and denied resume role.
6. Run the shared-IP Clerk signup rehearsal or obtain Clerk's written capacity
   confirmation. Record signup completion, `429` rate, verification delay,
   webhook lag, and Storage failures.
7. Restore the latest encrypted production backup into an isolated project.
8. Confirm the portal state, the last seven scheduled-job runs, one controlled
   recruitment email, and one recent resume-cleanup run.
9. Review the final diff, identify the release commit, approve rollback or
   forward repair, and sign the readiness record.

Do not apply migrations to production, deploy the release, send applicant
messages, or change production data without explicit production authorization.

## Board decisions

The Board and the privacy owner must complete
`docs/policies/recruitment-policy.md`. Engineering must not invent these values:

- the meaning of Hash;
- decision-panel roles;
- approval quorum;
- aggregate visibility;
- applicant feedback;
- excused missed-round handling;
- late evaluation handling;
- evaluation correction;
- decision correction;
- applicant and resume retention;
- evaluation and decision retention.

If the Board cannot approve an item today, keep the affected workflow closed.
Do not treat the code's current default as approval.

## Release decision

Mark the release ready only when:

- the shared working tree has one reviewed release commit;
- all repository checks pass on that commit;
- all pending migrations pass in hosted staging;
- the real resume test passes;
- the authenticated full-cycle rehearsal passes;
- the shared-IP capacity result meets the approved thresholds;
- the backup restore passes;
- required secrets and scheduled jobs are confirmed;
- the Board policy has an effective version;
- the release owner signs the record.
