# Respond to a production incident

Use this runbook for a Supabase, Auth, email, cron, deployment, privacy, or decision-release incident.

## Triage

1. Assign one incident owner.
2. Record the start time, affected environment, and user-visible symptom.
3. Stop the affected workflow when continued writes could make recovery harder.
4. Preserve audit records and deployment logs.
5. Do not paste applicant content, tokens, resumes, or credentials into the incident record.

## Classify severity

- `SEV1`: unauthorized disclosure, credential exposure, or incorrect released outcome
- `SEV2`: applications, evaluation, or Board decisions are unavailable during an active cycle
- `SEV3`: a degraded feature has a documented manual workaround

Notify the Board President and the privacy owner for every `SEV1`. Notify the VP Recruitment for every recruitment incident.

## Contain common failures

### Supabase or Auth outage

- Stop Board mutations.
- Keep the public status message factual.
- Do not redirect production to a stale database.
- Resume writes only after health checks and a controlled test succeed.

### Email outage

- Do not repeat the underlying business action.
- Keep failed notifications in the outbox.
- Use the Board retry action after delivery recovers.

### Failed cleanup cron

- Confirm `CRON_SECRET` and the deployment schedule.
- Run the protected route once after fixing the cause.
- Confirm that the stale-object count returns to zero.

### Bad migration

- Stop new writes when the schema and code disagree.
- Prefer a forward repair migration.
- Never edit or delete an applied migration.
- Restore only when the incident owner approves data loss or reconciliation steps.

### Incorrect decision release

- Restrict further releases.
- Preserve the original decision and approvals.
- Use the superseding-decision workflow.
- Contact the affected applicant through the approved Board process.

## Close the incident

1. Verify the repaired workflow in staging and production.
2. Record the root cause and the failed control.
3. Add a test or operating check that detects the same failure.
4. Assign each follow-up an owner and due date.
5. Have the incident reviewer approve closure.
