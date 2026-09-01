# MECG execution plan

Status: repository implementation complete; external release gates pending
Created: 2026-09-01
Scope: recruitment platform, production operations, public website, and project documentation

## Implementation status — 2026-09-01

Implemented in the repository:

- One non-terminal cycle invariant and status-aware cycle selection.
- Explicit minimum observed evidence per evaluated rubric.
- Board event correction and cancellation, evaluator recovery, and membership deactivation/restoration.
- Transactional decision and event notification outbox with retry, idempotency, audit, cron processing, and Board visibility.
- Owner-only production dependency readiness checks and bounded operational logging.
- PDF cancellation cleanup, offline font fallbacks, browser smoke tests, isolated-database CI, and live migration-ledger enforcement on `main`.
- Architecture, workflow, policy, retention, release, configuration, backup, and incident-response documentation.

Repository verification is recorded in the implementation handoff. The remaining gates require external authority or production access: Board policy approval, retention approval, production secrets and provider checks, leaked-password protection, backup restoration, staging rehearsal, and client approval for public case studies. These are deliberately not inferred or performed from a development checkout.

## Purpose

This plan moves MECG from a working recruitment application to a system that the Board can operate, recover, test, and explain without raw SQL or undocumented production access.

The work follows four release gates:

1. Make the next recruitment cycle safe.
2. Complete routine Board operations.
3. Make failures visible and recoverable.
4. Publish evidence of MECG's client work.

Do not open a live cycle until Gate A passes. Do not call the platform production-mature until Gate C passes.

## Current baseline

At commit `c8da18d`, the repository contains 67 application pages and routes, 37 API routes, 71 Supabase migrations, and 38 test files. The deterministic checks pass:

```text
npm test                 136 tests passed
npm run lint             passed
npx tsc --noEmit         passed
npx next build --webpack passed
```

Regenerate the counts with:

```bash
rg --files src/app | rg '/(route|page)\.(ts|tsx)$' | wc -l
rg --files src/app/api | rg '/route\.ts$' | wc -l
rg --files | rg '(\.test\.(ts|tsx|js|mjs)|supabase/tests/.*\.sql)$' | wc -l
rg --files supabase/migrations | wc -l
```

The checkout has no `.env.local`. The live Supabase project, Vercel settings, Auth settings, Resend delivery, cron history, and backup state remain unverified from this repository.

## Ownership

| Role | Responsibility |
| --- | --- |
| Board President | Approve releases and resolve policy disputes |
| VP Recruitment | Own the product backlog and accept recruitment workflows |
| Engineering owner | Implement migrations, application changes, tests, CI, and releases |
| Recruitment operations lead | Define operating procedures and run acceptance tests |
| VP External | Obtain client approval for public case studies |
| Privacy owner | Approve retention, deletion, access review, and incident procedures |
| Two Board testers | Test applicant, member, committee, panel, and owner workflows |

The VP Recruitment maintains one ordered backlog. The Board records new requests in that backlog before engineering starts them.

## Working rules

- Ship every database change as a new migration. Never edit an applied migration.
- Implement authorization in PostgreSQL and repeat high-value checks in the API.
- Add an audit event for every privileged state change.
- Make mutations safe to retry.
- Test each change at the lowest useful layer and through its user journey.
- Deploy to staging before production.
- Record the command, exit status, and result for every release gate.
- Keep applicant answers, resumes, tokens, passwords, and credentials out of logs and test artifacts.
- Stop when a missing Board decision would change applicant treatment.

## Workstream 1: approve recruitment policy

### Outcome

The Board approves one versioned policy before engineering encodes the remaining rules.

### Owner and effort

- Owner: VP Recruitment
- Approvers: Board President and privacy owner
- Board effort: two 60-minute sessions
- Engineering effort: 2 to 4 days after approval

### Decisions

The Board must decide:

1. What Hash means and whether it carries a score.
2. Which roles may join the final decision panel.
3. How many conflict-free approvals lock a decision.
4. Whether members may see anonymized aggregate results after release.
5. How long MECG retains applications, resumes, ratings, and audit records.
6. Whether applicants receive written feedback.
7. What alternate assessment applies to an excused missed round.
8. How many criteria an evaluator must observe in each round.
9. How MECG handles late evaluations and corrections.
10. How the Board withdraws or supersedes a decision.

### Implementation

- Create `docs/policies/recruitment-policy.md`.
- Assign the policy a version and effective date.
- Store cycle-specific policy values in the database.
- Copy the approved values into a cycle before it opens.
- Lock evaluation rules after the first live evaluation.
- Require a recorded exception for a locked policy change.
- Show the active policy version on the Board dashboard.

### Acceptance criteria

- The policy contains no unresolved placeholders.
- Every rule maps to a database check, an application check, or a named manual control.
- Each cycle records its policy version.
- The Board cannot change rubric weights after live evaluation starts.
- Board meeting minutes record approval.

### Verification

- Unit tests cover each calculation and transition.
- SQL tests prove that locked policy values cannot change.
- `npm run verify:workflow` uses the approved policy.

## Workstream 2: verify production configuration

### Outcome

Vercel, Supabase, Resend, cron, and backup settings match the repository and have current evidence.

### Owner and effort

- Owner: engineering owner
- Approver: Board President
- Engineering effort: 2 to 3 days

### Tasks

1. Inventory every Vercel environment variable.
2. Confirm that every public variable points to the MECG Supabase project.
3. Confirm that the service-role key exists only in server environments.
4. Confirm that `CRON_SECRET` is set.
5. Confirm the Resend key, sending domain, and sender address.
6. Enable Supabase leaked-password protection.
7. Confirm signup and password-recovery redirect URLs.
8. Confirm that the application allowlist has the intended state.
9. Compare the live migration ledger with `supabase/migrations`.
10. Inspect the last seven resume-cleanup cron executions.
11. Create an encrypted backup.
12. Restore the backup into an isolated Supabase project.
13. Run the complete recruitment rehearsal against staging.

### Deliverables

- `docs/runbooks/production-configuration.md`
- `docs/runbooks/backup-and-restore.md`
- A dated readiness report with each command, exit status, and result

### Acceptance criteria

- No required environment variable is missing.
- The cron route succeeds with the expected authorization.
- A test email reaches a controlled inbox.
- The restored project contains the expected schema and test records.
- `npm run supabase:verify-project` passes.
- `npm run verify:backend` passes.
- `npm run verify:auth` passes.
- `npm run verify:workflow` passes.
- The application portal is intentionally open or intentionally restricted.

## Workstream 3: allow only one active cycle

### Outcome

A new draft cannot hide a live recruitment cycle from internal users.

### Owner and effort

- Owner: engineering owner
- Engineering effort: 1 to 2 days

### Implementation

- Treat `DRAFT`, `OPEN`, `IN_PROCESS`, and `DECISION_LOCK` as non-terminal statuses.
- Add a partial unique index that allows only one non-terminal cycle.
- Update `rush.create_cycle` to return a clear conflict error.
- Map that database error to HTTP 409.
- Prefer an explicit cycle ID in internal routes.
- Add an authorized cycle selector for closed and archived cycles.
- Display the selected cycle on every internal page.
- Require confirmation before creating a cycle.

### Acceptance criteria

- PostgreSQL rejects a second non-terminal cycle.
- Concurrent creation requests produce one cycle.
- Archived cycles remain available in read-only mode.
- Internal pages never switch cycles because a newer draft exists.
- Every mutation includes or derives the intended cycle.

### Verification

- Add a SQL concurrency test for two cycle creations.
- Add unit tests for explicit, active, closed, archived, and unauthorized selection.
- Add a browser test for viewing an archived cycle without changing the active cycle.

## Workstream 4: complete Board operations

### Outcome

The Board handles ordinary corrections through the application. Standard recruitment work requires no raw SQL.

### Owner and effort

- Product owner: VP Recruitment
- Implementation owner: engineering owner
- Engineering effort: 12 to 18 days

Build each operation as a database RPC, API route, UI control, audit event, and test set.

### Event management

Add these actions:

- Edit the event name, type, location, and times.
- Cancel an event.
- Edit or cancel a slot.
- Notify affected applicants.
- Preserve old values in the audit record.

Acceptance criteria:

- An active event cannot move into the past.
- Cancellation closes future RSVP availability without deleting history.
- The confirmation shows how many applicants the change affects.
- Repeating a request does not send duplicate notifications.

### Evaluator management

Add these actions:

- Unassign an evaluator before submission.
- Reassign open work.
- Balance evaluator workloads in bulk.
- Show applicants below the required coverage.
- Explain why an evaluator is ineligible.

Acceptance criteria:

- Submitted evaluations remain immutable.
- A conflicted or ineligible evaluator cannot receive a replacement assignment.
- A change that reduces coverage shows a warning and requires confirmation.
- Concurrent reassignment does not create duplicate assignments.

### Membership management

Add these actions:

- Deactivate a membership.
- Restore a membership.
- Set an access expiration date.
- Display every role by cycle.

Acceptance criteria:

- Deactivated users lose access on the next request.
- The final active owner cannot lose owner access.
- Each change records the actor, old state, new state, reason, and time.

### Round and rubric management

Add these actions:

- Create a round from an approved template.
- Create a new rubric version.
- Preview a scoring change.
- Publish and lock a rubric.
- Archive a completed round.

Acceptance criteria:

- A published rubric never changes in place.
- Existing evaluations retain their rubric version.
- Weights total 100.
- Each rubric defines its required criteria and minimum observed count.

### Bulk applicant operations

Add these actions:

- Filter and select applicants.
- Preview a bulk transition.
- Require a reason.
- Export the result.

Acceptance criteria:

- The preview identifies every illegal transition.
- The operation reports partial failures by applicant.
- A retry does not duplicate audit events or notifications.

### Decision corrections

Add these actions:

- Withdraw an unreleased decision.
- Supersede a released decision.
- Require a reason and a new approval quorum.
- Keep the original decision in the audit history.
- Notify the applicant after the replacement locks and releases.

Acceptance criteria:

- Released decisions remain immutable.
- A replacement points to the original decision.
- Conflicted users cannot create, approve, preview, or release the replacement.
- The applicant sees only the current released outcome.

## Workstream 5: make email delivery durable

### Outcome

A temporary Resend failure cannot lose an applicant notification.

### Owner and effort

- Implementation owner: engineering owner
- Operations owner: VP Recruitment
- Engineering effort: 4 to 6 days

### Data model

Create a notification outbox with:

- Recipient
- Template and template version
- Related cycle and resource
- Status
- Attempt count
- Last error category
- Next attempt time
- Provider message ID
- Created, sent, and acknowledged times
- An idempotency key

Do not store credentials or unnecessary message content.

### Workflow

1. Commit the business action and the outbox record in one transaction.
2. Send the email after the transaction commits.
3. Record the provider message ID after success.
4. Retry temporary failures with bounded backoff.
5. Stop after a fixed number of attempts.
6. Show failed notifications to the Board.
7. Support an audited manual retry.

### Acceptance criteria

- A provider outage does not lose a notification.
- The Board can find every released outcome with a failed notification.
- A retry never repeats the underlying business action.
- Two workers cannot send the same outbox entry at the same time.
- Notification state never changes decision state.

### Verification

- Test timeout, rate limit, provider rejection, duplicate execution, and recovery.
- Disable Resend in staging, release a test outcome, restore Resend, and prove delivery.

## Workstream 6: add monitoring and incident response

### Outcome

MECG detects production failures before applicants or members report them.

### Owner and effort

- Implementation owner: engineering owner
- Incident owner: Board President
- Engineering effort: 4 to 5 days

### Monitor

- Request error rate
- Supabase latency and failures
- Auth failures
- Email delivery failures
- Cron execution and stale resume count
- Slow or failed PDF validation
- Released decisions without a sent notification
- Migration parity
- Unhandled client and server errors
- Build and deployment status

### Alert definition

Each alert must name:

- Severity
- Threshold
- Recipient
- Response time
- Escalation path
- Runbook

Do not alert on individual validation errors.

### Runbooks

Create runbooks for:

- Supabase outage
- Auth outage
- Resend outage
- Failed resume cleanup
- Bad migration
- Incorrect decision release
- Exposed credential
- Unauthorized-access report
- Application-deadline incident

### Acceptance criteria

- Each simulated failure creates one actionable alert.
- The alert includes the environment, route, cycle, and request ID.
- Logs exclude resumes, passwords, tokens, and full application answers.
- The Board assigns an incident owner during recruitment events.

## Workstream 7: test complete user journeys

### Outcome

CI tests the system through the browser and against an isolated database.

### Owner and effort

- Implementation owner: engineering owner
- Test partners: two Board members
- Engineering effort: 7 to 10 days

### Browser coverage

Add Playwright tests for:

- Applicant signup and email confirmation
- Draft save and recovery
- Resume upload and replacement
- Application submission
- RSVP changes
- Offer acceptance and decline
- Member evaluation on a mobile viewport
- Conflict declaration
- Blind screening
- Reviewer recusal and replacement
- Event check-in
- Hash pseudonymity
- Two-person decision approval
- Decision release and notification state
- Session expiry and password recovery
- Keyboard navigation and important live-region announcements

### CI changes

- Start an isolated Supabase stack.
- Apply all migrations to an empty database.
- Run pgTAP against that database.
- Generate database types and fail on an unexpected diff.
- Run browser tests against the isolated stack.
- Keep live migration parity as a protected release check.
- Require database checks on `main`.
- Fail when a required check lacks its configuration.
- Pin the Supabase CLI version instead of using `latest`.

### Acceptance criteria

- A pull request cannot merge when a required check is skipped.
- The test suite catches authorization failures at the API and database layers.
- Tests start from an empty database without manual setup.
- Each quarantined flaky test has an owner and removal date.

## Workstream 8: harden technical boundaries

### Outcome

The system rejects malformed database results, weak evaluation evidence, hostile PDFs, and offline build failures.

### Explicit evaluation evidence

- Add `minimumOtherObserved` to each rubric version.
- Enforce the value in SQL and `scoreEvaluation`.
- Keep the 75 percent weight rule as a separate check.
- Reject duplicate, missing, and unknown criterion IDs.

Acceptance criteria:

- Weight changes cannot weaken the minimum evidence rule.
- JavaScript and SQL return the same result for shared fixtures.

### Runtime RPC validation

- Define a runtime schema for every custom RPC response.
- Parse each response at the database boundary.
- Return a controlled 503 when the response has the wrong shape.
- Log the RPC name and request ID without applicant content.

Acceptance criteria:

- An invalid RPC result cannot reach a component as trusted data.
- Tests cover missing fields, invalid enums, nulls, and unexpected fields.

### PDF parser cancellation

- Retain the PDF loading task.
- Call `destroy()` when the timeout fires.
- Move parsing into an isolated worker if cancellation does not stop CPU work.
- Record parse duration without recording document contents.

Acceptance criteria:

- A timed-out parse stops using CPU.
- Concurrent hostile files do not block ordinary requests.
- Rejected files and pending database records are cleaned up.

### Offline production build

- Self-host Montserrat and Geist Mono.
- Remove the build-time request to Google Fonts.
- Test both the default Next.js build and the webpack build in a controlled environment.

Acceptance criteria:

- A production build succeeds without internet access after dependency installation.

### Owner and effort

- Owner: engineering owner
- Engineering effort: 5 to 7 days

## Workstream 9: publish evidence of client work

### Outcome

The public site publishes three approved case studies and MECG collects usable project evidence each semester.

### Owner and effort

- Content owner: VP External
- Engineering support: 2 to 4 days
- Calendar time: 3 to 8 weeks, based on client approval

### Collect for each case

- Approved client name and logo
- The client's question
- MECG's scope
- Methods
- One measurable or verifiable result
- Limitations
- Two redacted artifacts
- A client quote when approved
- Written client approval
- Written MECG approval

Start with three clients that are likely to approve publication.

### Publication process

- Keep unpublished material outside the public bundle.
- Run the existing fail-closed exporter.
- Require both approvals for every public field.
- Add useful alt text and captions.
- Record a review date.
- Recheck links and claims each semester.

### Acceptance criteria

- Three complete case studies are public.
- Each claim has a named internal source or written client approval.
- No applicant data, resume, or confidential client data enters the public repository.
- The `/work` page remains useful when a case is removed.

### Semester closeout

For each project:

1. Ask whether the client permits publication.
2. Capture redacted deliverables.
3. Record results and limitations.
4. Take one working-session photograph.
5. Assign a case-study owner.
6. Archive the approval decision.

## Workstream 10: replace stale documentation

### Outcome

The repository describes the current system and gives the Board one procedure for each production task.

### Owner and effort

- Owner: engineering owner
- Reviewer: VP Recruitment
- Engineering effort: 2 to 3 days

### Document set

Create or refresh:

- `README.md`
- `docs/architecture.md`
- `docs/recruitment-workflow.md`
- `docs/policies/recruitment-policy.md`
- `docs/runbooks/`
- `docs/release-checklist.md`
- `docs/data-retention.md`
- `docs/history/audits/`

### Rules

- Mark old audit reports as historical.
- Remove fixed findings from the current backlog.
- Record the commit and date for generated counts.
- Document only commands that exist in repository configuration.
- Keep applied migrations immutable.
- Review the documents after each cycle and major release.

### Acceptance criteria

- A new engineer can start the app and run deterministic checks from `README.md`.
- The current audit summary matches the current code and test count.
- Each production task has one documented command or UI procedure.
- No current document contradicts another current document.

## Release gates

### Gate A: safe for the next recruitment cycle

Complete:

- Workstream 1, recruitment policy
- Workstream 2, production configuration
- Workstream 3, one active cycle
- A successful backup restore
- A successful full workflow rehearsal

Estimated engineering effort: 6 to 10 days, plus Board decisions.

### Gate B: safe for Board operations

Complete:

- Event recovery
- Evaluator reassignment
- Membership deactivation
- Decision correction
- Notification outbox
- Operations runbooks

Estimated engineering effort: 15 to 22 days.

### Gate C: safe to maintain

Complete:

- Browser tests
- Isolated Supabase CI
- Monitoring and alerts
- Runtime RPC validation
- PDF cancellation
- Current documentation

Estimated engineering effort: 15 to 21 days.

### Gate D: public evidence

Complete:

- Three approved case studies
- A semester artifact process
- A claim review schedule
- Basic contact and application funnel measurement

Estimated engineering effort: 2 to 4 days. Client approval controls calendar time.

## Proposed schedule

The schedule assumes one engineer. Client approval work runs in parallel.

| Week | Work |
| --- | --- |
| 1 | Policy, production audit, and active-cycle constraint |
| 2 | Backup rehearsal, notification outbox, and monitoring base |
| 3 | Event and evaluator operations |
| 4 | Membership, rubric, and bulk operations |
| 5 | Decision correction and late-evaluation workflows |
| 6 | Browser tests and isolated Supabase CI |
| 7 | RPC validation, PDF cancellation, and offline build |
| 8 | Runbooks, documentation, and final rehearsal |
| Parallel | Client approvals and case-study preparation |

Add two weeks if the live schema differs from the repository or the policy decisions require new domain models.

## Status tracking

Track each workstream with these states:

- `NOT_STARTED`
- `POLICY_BLOCKED`
- `READY`
- `IN_PROGRESS`
- `IN_REVIEW`
- `VERIFIED`
- `RELEASED`

Each work item records:

- Owner
- Reviewer
- Dependency
- Target release gate
- Files and migrations changed
- Verification commands
- Exit status
- Evidence link
- Rollback or recovery procedure

Mark a workstream `VERIFIED` only after its acceptance criteria pass. Mark a release gate complete only after every required workstream reaches `VERIFIED`.

## Definition of done

MECG reaches the planned state when:

- One approved policy controls every live cycle.
- Only one cycle can be active.
- Standard Board work requires no raw SQL.
- Failed notifications remain visible and retryable.
- Production failures create actionable alerts.
- CI tests the database and complete browser journeys.
- A backup has restored successfully.
- Every role completes a staged recruitment cycle.
- Three approved case studies are public.
- Current documentation matches the current release.
