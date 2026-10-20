# October application and database rollout map

2026-10-17. Reviewable handoff only; no hosted migration or deployment was performed. This corrects the earlier six-migration README checkpoint to the current eleven files.

| Ordered migration | Consuming behavior |
| --- | --- |
| `20261016190000_application_draft_revisions.sql` | Application draft CAS, exact mutation acknowledgement and revision-aware final submission. |
| `20261016191000_grading_contract_consistency.sql` | Canonical grading validity, eligibility and required completion agree across writers/readiness. |
| `20261016192000_batch_release_diagnostics.sql` | Per-applicant release blockers and outcomes for reviewed cohort release. |
| `20261016193000_operator_contract_fixes.sql` | Operator write contracts and canonical guards. |
| `20261016194000_round_close_summary.sql` | Authorized advisory aggregate for explicit round-close confirmation. |
| `20261016195000_restricted_provisioning_incidents.sql` | Owner-restricted partial-provisioning recovery metadata. |
| `20261016200000_group_case_reviewer_quality.sql` | Group Case independent evidence/quality separate from partial saved observations. |
| `20261016201000_release_evidence_diagnostics.sql` | Round-specific missing/invalid evidence diagnostics and release recovery routes. |
| `20261016202000_group_case_write_revisions.sql` | Group Case revision preconditions, exact current-mutation replay and conflicts. |
| `20261016203000_evaluation_draft_write_revisions.sql` | Written-evaluation draft/final revision serialization and cleanup. |
| `20261016210000_screening_draft_write_revisions.sql` | Screening draft/submit/recuse v2 contracts with shared assignment locks and bound receipts. |

## Contract transition

The application bundle and database migration set form one release. The new Group Case, written-evaluation and screening consumers call v2 contracts; the application intake uses its revision-aware contract. Legacy unconditional authenticated writers are intentionally denied once the corresponding migrations apply. This prevents an older tab from bypassing concurrent-write protection, but also means an old bundle cannot keep writing during a database-first rollout.

Use an explicitly designated isolated environment first. Verify its identity and compatible provider configuration before any mutating verification command; the existing project-precedence gate is pinned to its configured MECG project and is not evidence that an arbitrary target is staging. Apply the ordered migration set and deploy the matching bundle in a coordinated change window. Reload old client tabs before resuming writes. Do not advertise uninterrupted compatibility with old writers or restore their unconditional grants to hide a mismatch.

Verify the new application/screening/written/Group Case read, exact retry, conflict and final-action paths together against that environment. A successful write receipt proves its recorded operation, not that the value cannot later be changed by another authorized operator. Offer-deadline receipts use the existing boolean-returning canonical SQL function; that later interface repair adds no migration.

## Recorded local evidence and remaining scope

The full isolated database proof applied173 migrations and passed872 assertions across17 files, with real two-connection races and runtime ACL/RLS checks. [Screening SQL receipt](screening-draft-write-revisions.md), [written-evaluation SQL receipt](evaluation-draft-write-revisions.md) and [Group Case SQL receipt](group-case-write-revisions.md) give exact inputs and scopes. The task-only database was cleaned after proof. [The current recovery checkpoint](grading-write-recovery-checkpoint.md) links the861-pass Node suite, successful production build/lint, and separate component/API browser matrices.

The `verify:auth` and `verify:workflow` scripts create real external identities/records and are not local-only gates. Their successful isolated SQL counterpart or browser mocks must not be relabeled hosted Clerk/storage/email acceptance. The user reports no staging environment, so the hosted rollout and real integrated operator/applicant tasks remain unexecuted. No production project, provider account, real application or email was used as a substitute.

The current owner decisions about unavailable approved project artifacts and excluded membership-time publication remain in [current-owner-decisions.md](current-owner-decisions.md). Frozen panel votes remain unchanged by this handoff document.
