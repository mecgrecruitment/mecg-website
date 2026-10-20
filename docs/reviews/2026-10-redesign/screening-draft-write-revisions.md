# Revision-safe screening drafts and final actions

`20261016210000_screening_draft_write_revisions.sql` adds revision, current mutation, exact payload and confirmed receipt metadata to the existing private `screening_review_drafts` row. Existing rows receive an initial UUID revision. There is no duplicate content store or historical request ledger. Existing submission and inactive-assignment cleanup triggers delete content and replay state atomically.

`get_screening_review_draft_v2(target_assignment_id)` returns `{assignmentId, revision, draft}`. Draft is null or `{ratings, evidence, recommendation, updatedAt}`. An obsolete-rubric stored row has null visible content and a nonnull revision, so replacing it still requires the current revision. Submitted assignments return no stored draft after cleanup. A consumer must parse nonnull content strictly and fail closed on malformed data.

`save_screening_review_draft_v2(target_assignment_id, draft_ratings, draft_evidence, draft_recommendation, expected_revision, mutation_id)` returns either `{kind: saved, assignmentId, revision, mutationId, draft}` or `{kind: conflict, snapshot: {assignmentId, revision, draft}}`. The mutation UUID is required. An exact request matching the current mutation and current draft returns the same confirmed receipt without writing again. Reusing that current mutation with different input fails. An old request after a newer edit conflicts and cannot restore old content. Changing the active rubric prevents obsolete receipt confirmation.

`submit_screening_review_v2(target_assignment_id, ratings, review_evidence, review_recommendation, expected_draft_revision)` returns that same conflict snapshot for a stale draft revision. Success returns `{kind: submitted, assignmentId, reviewId, score}` bound to the actual inserted review. The wrapper calls the canonical numeric-returning `submit_screening_review` under the assignment lock and resolves its review ID before returning. Canonical final ratings, evidence, recommendation, weights, scoring, immutable reviews, audit writes and blind-result policy remain unchanged. Screening has no generic evaluation calibration trigger; this change neither adds one nor bypasses the existing evaluation calibration rules.

`recuse_screening_assignment_v2(target_assignment_id, recusal_reason)` calls the canonical void-returning recusal writer and returns `{kind: recused, assignmentId}` only on success. The canonical function already holds the same assignment lock, validates the reason and current reviewer, requires an eligible replacement, creates the conflict declaration and replacement assignment, changes the original status, clears the draft through its trigger and records the audit event in one transaction. Failure to find a replacement rolls everything back and returns no successful receipt. No new blind retry contract for recusal or final submission is introduced.

## Authorization and concurrency

Draft load, save and final submit check mapped identity, own assignment, current eligible profile and cycle role, active batch reviewer membership, declared conflicts and application eligibility. Writes lock the application while checking eligibility to serialize with withdrawal. Draft recovery remains possible after batch closure. Saves and final submission acquire `FOR UPDATE` on the existing assignment row before checking the draft revision. New edits and final submit additionally require a published batch and a deadline that has not elapsed according to the current clock after acquiring the lock. Exact current draft receipt confirmation is read-only and allowed after batch/deadline closure while all current access checks remain satisfied; submitted or recused assignments reject it.

The assignment row serializes simultaneous first saves even when no draft exists. A save that wins before a stale final submit causes a conflict. Submission and recusal that win first clear the draft while retaining that lock; a waiting save then observes the closed assignment or declared conflict and cannot recreate the draft.

The private table retains forced RLS and no authenticated direct privileges. All v2 entry points and internal helpers are postgres-owned security definers with an empty search path. Internal helpers deny anonymous and authenticated execute. Authenticated execute on legacy get/save/submit/recuse functions is revoked when consumers migrate to v2. Existing service-role execute semantics remain available.

## Verification receipt

A fresh isolated PostgreSQL database applied **173 migrations**. The full **17-file suite passed 872 assertions**, including **51 screening revision assertions** for access checks, CAS, replay, current rubric behavior, deadline/closure handling, canonical score preservation, bound action receipts, cleanup and replacement coverage. Schema lint returned no errors. SQL parser checks passed **190 files and 485 function bodies**.

Four actual two-connection experiments passed. Every experiment observed the second connection waiting on the shared assignment lock before releasing the first transaction:

- Concurrent first saves: one saved and one conflicted with the winning revision.
- Newer save followed by stale final submit: submit conflicted and no review was created.
- Final submit followed by late save: submit succeeded; late save failed as closed; one review and no draft remained.
- Recusal followed by late save: recusal succeeded with replacement coverage; late save failed for the declared conflict; no draft remained.

Raw migration, focused/full test, lint, parser, runtime ACL and concurrency logs, the repeatable concurrency script and input SHA-256 hashes are in [evidence/screening-draft-write-revisions](./evidence/screening-draft-write-revisions/). An initial full-suite attempt collided with intentionally committed concurrency fixture users; that raw attempt is retained as `tests-fixture-collision.log`. The final full suite ran on a fresh database before the concurrency fixtures were committed.

Verification used Supabase CLI 2.121.0, task-only project `/tmp/mecg-goal-db-20261016`, database port 55432, `db start`, `test db supabase/tests`, and `db lint --local --schema rush --level error --fail-on error`. Parser checks used `/tmp/mecg-sql-check-venv/bin/python scripts/check-sql.py`. Cleanup used `stop --project-id mecg-goal-20261016 --no-backup` and checked task container/volumes absent. Unrelated CTRM containers, hosted projects, production data, deployment and external messages were not used. API/browser integration evidence belongs to the separate consuming-interface work.
