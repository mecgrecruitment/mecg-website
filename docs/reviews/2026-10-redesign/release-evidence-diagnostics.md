# Release evidence diagnostics

The release review can now explain which weighted round prevents an application's evidence from being ready. The new guarded `rush.decision_evidence_diagnostics(text)` RPC returns application eligibility, each required round's state, its canonical valid locked evaluator count, required count of two, known missing required criterion names, and stable blocker codes. It returns no evaluator IDs, notes, scores, contact information or raw SQL errors. This is evidence readiness only: it does not assert that a decision is locked, approvals are sufficient, or release will succeed.

`20261016201000_release_evidence_diagnostics.sql` factors the preceding `is_decision_ready` query into a private round helper. Both the existing readiness predicate and the new diagnostic use that helper. It retains weighted rounds only, active rubric only, latest nonvoid evaluation per assignment, LOCKED status, canonical observation quality, distinct evaluators, excluded declared conflicts, FROZEN/FINALIZED round state, and the existing DRAFT/WITHDRAWN exclusion. It deliberately adds no assignment-status rule or new eligibility policy. Release writers, scoring, thresholds, approvals and RLS policies remain unchanged.

Missing criterion names are the deduplicated union from current-rubric latest nonvoid LOCKED, nonconflicted observations. An absent observation or an old-rubric observation contributes no names. Empty names do not prove quality: weighted coverage, minimum observations and the count of valid locked independent evaluators remain authoritative. Known names may describe an additional invalid observation even where two other valid observations suffice.

The RPC requires mapped caller identity, active current-application-cycle PANEL/OWNER authority, and no caller conflict with the application. Missing applications and inaccessible cycles use the same unavailable error. The private helper and existing readiness predicate are not directly executable by authenticated or anonymous callers. The guarded RPC is executable by authenticated callers and service role, retaining the identity/role/recusal checks inside its security definer boundary. All three inspected functions are postgres-owned with an empty search path.

## Runtime verification

A fresh disposable local PostgreSQL 17 database applied **170 migrations**. All **753 assertions across 14 SQL files passed**, including **34 new diagnostics assertions**. Database lint returned no errors; the parser checked 184 SQL files and 465 function bodies. Runtime ACL inspection verified the guarded surface and inaccessible helper. The generated Supabase function map includes the new RPC's single text argument and JSON return type.

The new suite installs an exact copy of the immediately preceding readiness function under a transaction-local name and compares behavior for initial fixtures, partial evidence, open rounds, evaluator recusal, a newer nonvoid draft, a voided newer draft, a newer active rubric, no weighted rounds and a missing application. Guard assertions cover anonymous execution, unmapped identity, caller recusal, revoked membership, ordinary member, another cycle, and a permitted PANEL caller. The suite also checks missing criterion naming, private fields and independent valid counts. Fixtures roll back.

One initial focused run failed a privacy assertion because its regex matched the ordinary round name `Fixture evidence`. The assertion was corrected to check forbidden JSON field names; no implementation change or exposure was involved. The original failure log is retained alongside successful focused and full runs.

Commands used the existing Supabase CLI 2.116.0 and the task-only project `/tmp/mecg-goal-db-20261016`, database port 55432:

```sh
mecg_cli=/home/rahil/.npm/_npx/ade306d1eb8b9835/node_modules/.bin/supabase
"$mecg_cli" --workdir /tmp/mecg-goal-db-20261016 db start
"$mecg_cli" --workdir /tmp/mecg-goal-db-20261016 test db supabase/tests
"$mecg_cli" --workdir /tmp/mecg-goal-db-20261016 db lint --local --schema rush --level error --fail-on error
/tmp/mecg-sql-check-venv/bin/python scripts/check-sql.py
"$mecg_cli" --workdir /tmp/mecg-goal-db-20261016 stop --project-id mecg-goal-20261016 --no-backup
```

Raw logs, runtime ACL output and exact SQL input hashes are preserved in `.audit/release-evidence-sql/`. The task project was stopped without backup and its container/volumes were checked absent. Unrelated CTRM containers were not changed. No hosted project, deployment, production data or account was used. Hosted identity/PostgREST integration and actual operator acceptance remain outside this local database proof. This receipt does not claim UI/browser verification; the parent task owns the consuming application interface.

## Consuming page and recovery navigation

The release review now links each EVIDENCE_NOT_READY applicant directly to its protected release-evidence page, preserving actual cohort context. That page checks the RLS-scoped application cycle and release permission before calling the guarded RPC. Denial stays unavailable; malformed, partial, inconsistent, wrong-application and failed reads cannot become a ready result. Operators can reload current evidence, inspect the dossier or open the specific round workspace. There is no release, reopen or override control on this page.

Counts state the actual independent valid locked total and the required minimum separately, so an extra evaluator is not presented as an impossible fraction. Missing criterion names appear only when valid locked coverage is insufficient. Shared count definitions are explained once; closed grading directs the operator to seek a Board-approved remediation process rather than prescribing unauthorized reopening. An inspected mobile WebKit capture confirms readable wrapping and visible keyboard focus.

Final verification: **780Node checks pass**, including4parser contract checks and16actual server-page boundary cases. **15/15focused diagnostics browser checks pass** acrossfive configurations, including the originating blocked-release link. The initial broader45-check run had40passes and5fixture-only failures from counting the development tools button outside the app. The assertion now scopes controls to main; the final15-pass run covers the affected cases and entry link. The other35operator/release checks passed in the initial run. Build/TypeScript, lint and diff whitespace checks pass. Logs are copied into evidence/release-evidence-final-*.log; SQL inputs/security/lint/full test logs are also in evidence/release-evidence-sql/. Independent nonvoting source QA is in release-evidence-source-review.md.

This proves a local synthetic interface, actual server-page permission/error handling with mocked providers, and isolated database permissions/canonical parity. It does not prove a hosted operator account, live RPC/JWT wiring or human task completion.
