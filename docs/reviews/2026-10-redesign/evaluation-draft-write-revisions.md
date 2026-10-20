# Revision-safe evaluation drafts and final submission

Generic written evaluations now have a database revision boundary for both draft edits and final submission. `20261016203000_evaluation_draft_write_revisions.sql` adds revision and current-mutation metadata to the existing private `evaluation_drafts` row. Existing drafts receive an initial UUID revision. There is no second content store or historical mutation ledger.

`get_evaluation_draft_v2` returns `{assignmentId, revision, draft}`. Draft is null or the existing `{ratings, evidence, updatedAt}` projection. Revision is null only when no stored row exists. An old-rubric draft can have a nonnull revision while its current-rubric content is null; the revision still protects deliberate replacement of that row. Submitted assignment cleanup removes both draft content and revision metadata.

`save_evaluation_draft_v2` accepts assignment ID, the existing string-score draft ratings, evidence, nullable expected revision and required mutation UUID. A matching revision returns `{kind: saved, assignmentId, revision, mutationId, draft}`. A mismatch returns `{kind: conflict, snapshot: {assignmentId, revision, draft}}`. Repeating the current exact request returns the same confirmed receipt without another update. The same current mutation with different input fails. An older exact request after a newer edit conflicts and cannot restore old content. A changed active rubric prevents obsolete receipt replay.

`submit_evaluation_v2` accepts the existing numeric/null final ratings, evidence and nullable expected draft revision. While holding the same assignment lock, it checks the current draft revision before invoking the canonical submission writer. A mismatch returns the same conflict snapshot. Success returns `{kind: submitted, assignmentId, evaluationId, score}`. All existing final validation, calibration, required observations, weights, scoring, status transitions and audit writes stay in `submit_evaluation`. Repeated submitted requests remain denied as closed; this work does not infer idempotent final success from a duplicate request.

## Authorization and atomicity

All v2 operations check mapped identity, assignment ownership, current cycle role, declared conflicts and application eligibility. Own-draft loading remains possible after a round closes for recovery, but submitted assignments expose no editable draft. Saves and final submissions additionally enforce the active round, actual deadline, mutable assignment state and absence of an already submitted/locked evaluation. Writes lock the application against concurrent withdrawal while checking eligibility.

Both draft save and final submit acquire `FOR UPDATE` on the same assignment row. That row already exists before a first draft, so the first-save race needs no separate advisory key. A save that wins before submission changes the revision and makes an older submit conflict. A submission that wins clears the draft through the existing trigger while retaining the assignment lock; a waiting late save then observes the submitted state and is refused. It cannot recreate the draft. Deadline checks use the current clock after acquiring the serialization lock.

The draft table keeps forced RLS and no authenticated direct privileges. Internal snapshot/access helpers are inaccessible to anonymous/authenticated callers. All new functions are postgres-owned security definers with an empty search path. Trusted service-role execute remains available under the existing identity requirements.

## Integration and rollout

The consuming API/UI must migrate together to v2 get, save and final submit. Authenticated execute on legacy `get_evaluation_draft`, `save_evaluation_draft`, `discard_evaluation_draft` and `submit_evaluation` is revoked. The old read otherwise bypasses current role/recusal checks; the old write/submit otherwise bypass revision protection. Existing final-form source has no DELETE request, and submission cleanup is automatic, but the exposed legacy DELETE API must be explicitly retired (405) or replaced by a revision-aware action before it is offered to a consumer. No v2 destructive discard action is introduced here.

The generated Supabase function map includes all three v2 entry points. Two existing SQL grading suites now use an invoker-only transaction-local adapter for the few legacy submit fixture calls: the adapter obtains the current own revision and invokes v2, retaining actual authenticated guards and canonical score assertions. No production guard is weakened and no scoring expectation changed.

## Verification

A final fresh isolated PostgreSQL 17 database applied **172 migrations**. The complete **16-file SQL suite passed 821 assertions**, including **38 new assertions** for draft CAS, replay, authorization, current-rubric behavior, final-submit conflict, canonical score preservation and atomic cleanup. Database lint returned no errors. SQL parser checks passed for **188 files and 478 function bodies**.

Three separate real two-connection experiments passed. Each observed the second connection waiting on the shared assignment lock before releasing the first transaction:

- Concurrent first saves: the first saves and the second receives a conflict with the first revision.
- A new draft save followed by stale final submit: submission receives a conflict and creates no evaluation.
- Final submit followed by a late save: submission succeeds; the waiting save receives `assignment closed`; exactly one evaluation exists and no draft is resurrected.

Runtime ACL output confirms anonymous execute is false for all v2 functions; authenticated execute is true only for v2 get/save/submit and false for legacy get/save/discard/submit and internal helpers. Forced RLS remains enabled and authenticated direct SELECT/UPDATE privileges are false.

Raw final migration/test/lint/parser/ACL logs, exact input hashes and the concurrent experiment script/output are in `.audit/evaluation-draft-write-revisions/`. The earlier 36-assertion focused pass is retained; the final fresh full run includes the added assignment-bound submission receipt and old-rubric revision assertions.

Verification used the existing Supabase CLI 2.116.0 with task-only project `/tmp/mecg-goal-db-20261016`, database port 55432: `db start`, `test db supabase/tests`, `db lint --local --schema rush --level error --fail-on error`, and `stop --project-id mecg-goal-20261016 --no-backup`. Parser checks used `/tmp/mecg-sql-check-venv/bin/python scripts/check-sql.py`. Cleanup checked the task container and volumes absent. No unrelated container, hosted project, production data, deployment or external message was used. Browser/API integration verification belongs to its separate consuming-interface work and is not established by this SQL receipt.
