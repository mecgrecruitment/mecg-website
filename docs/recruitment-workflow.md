# MECG recruitment workflow

Status: describes current application behavior
Last reviewed: 2026-09-01

## Prepare a cycle

1. An owner creates the cycle.
2. The system creates the Speed Dating and Group Case rounds and their first rubric versions.
3. The owner assigns cycle roles.
4. Recruitment operations set application dates, questions, events, and slots.
5. The Board reviews the active policy version.
6. The owner opens the cycle.

Only one non-terminal cycle may exist after Workstream 3 lands.

## Accept applications

1. An applicant creates a Supabase Auth account.
2. The applicant verifies the email address.
3. The applicant completes profile fields and written responses.
4. The applicant uploads a PDF through a server-created signed URL.
5. The server validates the stored bytes.
6. The applicant submits the application.
7. The database records the submission and locks the required intake evidence.
8. The notification system sends confirmation.

Draft saves and final submission are rate limited. A retry must not create a second application.

## Run blind screening

1. Recruitment operations create a screening batch.
2. The system copies application responses into review packets.
3. An identity steward redacts identifying content.
4. The database blocks approval when a packet contains the applicant name, uniqname, or email prefix.
5. Recruitment operations select eligible ordinary members.
6. The distribution function assigns independent reviewers.
7. Reviewers see applicant codes and redacted responses.
8. A reviewer may submit or recuse.
9. A recusal receives an eligible replacement when capacity exists.
10. Recruitment operations freeze the completed batch.

Reviewers do not see applicant identity, resumes, or peer reviews.

## Run evaluated rounds

1. Recruitment operations publish the round and assign evaluators.
2. A member declares any conflict before evaluating the applicant.
3. The member scores each criterion with an anchored rating or `N/O`.
4. The application checks required criteria, observed weight, and minimum observed count.
5. The database repeats the evidence checks.
6. Submission locks the evaluation.
7. Two valid independent evaluations produce a round score.
8. A spread of 25 points or more enters review.
9. Recruitment operations freeze the round.

Attendance remains operational. It does not change merit scores.

## Deliberate and decide

1. Every weighted round reaches `FROZEN` or `FINALIZED`.
2. The cycle enters `DECISION_LOCK`.
3. Panel-only users review pseudonymous applicant codes and aggregate evidence.
4. A decision-panel member creates an outcome and reason.
5. Two distinct conflict-free approvers lock the decision under the current default.
6. An authorized releaser releases the outcome.
7. The database creates a notification outbox entry in the release transaction.
8. The notification worker delivers the applicant message.
9. Failed delivery remains visible to the Board and can be retried.

The Board must approve the final quorum and correction policy in `docs/policies/recruitment-policy.md`.

## Close a cycle

1. Recruitment operations finish applicant communications.
2. The owner closes the cycle.
3. Internal records become read-only except for approved recovery actions.
4. The owner archives completed rounds and the cycle.
5. Scheduled cleanup follows the approved retention policy.
6. The Board runs a backup restore and workflow rehearsal before the next cycle.

Retention automation remains blocked until the Board and privacy owner approve [data retention](data-retention.md).

## Recover from ordinary mistakes

Use audited application actions for event edits, evaluator reassignment, membership deactivation, and decision correction. Never update production tables by hand when the application has a recovery action.

If the application lacks the required recovery action, stop the affected workflow. Record the incident and have engineering add a migration, an RPC, tests, and an operating procedure.
