# Complete the remaining Rush work on September 2, 2026

Status: active

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
| Staff-assisted check-in | `assisted_checkin` | Forward-only migration, API, event UI, and tests | Authorized staff can record an audited non-QR check-in. Cross-cycle and unauthorized requests fail. Attendance remains non-scoring. |
| Release integration | Primary session | Shared diff, documentation, and full verification | Parallel work is reconciled and every deterministic repository check passes. |

## Repository checks

After the workflows finish, run:

```bash
npm test
npx tsc --noEmit
npm run lint
npm run check:sql
npx next build --webpack
npm run test:e2e
git diff --check
```

Run the local database checks when the local Supabase stack is available:

```bash
npm run supabase:lint:local
npm run test:supabase:local
```

Record the command, exit status, and meaningful result. A skipped database check
remains open. Do not replace it with a claim based on an older run.

## Protected operator workflow

Repository work cannot complete these steps. An authorized operator must finish
them in the approved hosted environments today.

1. Add `CLERK_WEBHOOK_SIGNING_SECRET`, `RESEND_API_KEY`,
   `RESEND_FROM_EMAIL`, `CONTACT_TO_EMAIL`, and `CRON_SECRET` to the intended
   Vercel scopes.
2. Provision or select the approved hosted staging Supabase project.
3. Apply every pending migration to staging. Include the newest unique migration
   after re-reading `supabase/migrations`.
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

