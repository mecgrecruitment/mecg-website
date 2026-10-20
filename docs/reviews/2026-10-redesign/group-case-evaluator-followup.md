# Group Case evaluator follow-up — findings 071/072

Implemented against the current shared tree on 2026-10-16. This is an implementation receipt, not a panel vote or a change to frozen V1 findings. Precision Instrument remains the visual authority.

## Behavior and contract

- Observation-only notes now save with null criterion scores through the existing full-score RPC payload. Debounced edits and blur both save without requiring a star. Existing saved evidence can also be cleared; a new wholly empty review is not created by typing whitespace.
- Confirmed persistence reads “Evidence saved”; collapsed rows also say whether the review qualifies, remains incomplete, or has unavailable quality. Expanded rows show the canonical minimum observations, missing required criteria, and weighted-coverage blockers. No score-count predicate in the client decides validity.
- The additive migration returns `quality: { valid, coverage, observedCount, criteriaCount, minimumObserved, missingRequired }` from `rush.evaluation_observation_quality` in both the existing save receipt and the evaluator's roster. Roster quality is null for missing evaluations or an evaluation belonging to an inactive rubric. An older database may omit quality; the UI explicitly says it cannot confirm a qualifying review.
- Both RPCs retain their existing authorization, screening-reviewer exclusion, conflicts, applicant eligibility, latest nonvoided own-evaluation selection, and Board-only Speed Dating data. No evaluator-id input, newly callable helper, grading-rule changes, written-review mutation changes, or permission grants were added. Existing round locks and immutable evaluation behavior remain database-owned.
- Receipts are validated at the RPC and browser boundaries, including applicant identity. Malformed/wrong-applicant responses cannot claim persistence. A newer note invalidates an older in-flight receipt immediately; the serialized full-score save mechanism remains in place.
- Failed/unconfirmed changes remain visible in the open page, with an explicit retry and advice to copy the note before leaving. Scores are retained for retry as well. This is not a browser-storage backup, an across-device promise, or guaranteed survival after closing/reloading the page. A lost response may follow a committed save; the wording deliberately says “unconfirmed.”

## Files

- `src/app/member/group-case/group-case-roster.tsx`: note-only saves, serialized receipt handling, honest recovery and quality presentation.
- `src/lib/group-case-roster.ts`: typed quality/read/receipt contract, boundary validators and server-verdict presentation.
- `src/lib/screening-rpc.ts`: shared receipt validator.
- `src/app/api/member/group-case/ratings/route.ts`: shared receipt type; existing request/auth behavior preserved.
- `src/app/api/member/group-case/ratings/route.test.ts`: note-only route regression added.
- `src/lib/group-case-roster.test.ts`: receipt, quality/blocker, malformed-response and legacy-contract regressions.
- `src/app/apply/test-harness/group-case/page.tsx`: explicitly synthetic fixture behind both existing local harness flags.
- `tests/e2e/group-case-evidence.spec.ts`: seven focused scenarios across desktop/mobile Chromium.
- `supabase/migrations/20261016200000_group_case_reviewer_quality.sql`: additive JSON contract through existing guarded RPCs.
- `supabase/tests/group_case_reviewer_quality.sql`: ten rollback-only pgTAP assertions for canonical note-only blockers, read/receipt agreement, reviewer privacy, helper privacy, minimum/required/coverage gates and a qualifying partial review.

The parent-owned evaluation form, auth routing, package files, panel manifests/reports/triage and global receipt were not edited by this work. Pre-existing changes in shared files were retained.

## Verification performed

Commands ran from `/home/rahil/mecg-website`:

```sh
node --experimental-test-module-mocks --import ./scripts/esm-loader.mjs --test src/lib/group-case-roster.test.ts src/lib/screening-rpc.test.ts src/app/api/member/group-case/ratings/route.test.ts
npx tsc --noEmit --incremental false
npx eslint src/app/member/group-case/group-case-roster.tsx src/lib/group-case-roster.ts src/lib/group-case-roster.test.ts src/lib/screening-rpc.ts src/app/api/member/group-case/ratings/route.ts src/app/api/member/group-case/ratings/route.test.ts src/app/apply/test-harness/group-case/page.tsx tests/e2e/group-case-evidence.spec.ts
/tmp/mecg-sql-check-venv/bin/python scripts/check-sql.py
docker run --rm --network host --ipc host -v /home/rahil/mecg-website:/work -w /work -e PLAYWRIGHT_PORT=3000 mcr.microsoft.com/playwright:v1.64.1-noble npx playwright test tests/e2e/group-case-evidence.spec.ts --workers=2 --output=.audit/group-case-evaluator-followup/final-browser
```

Results: **16/16 Node tests**, **14/14 browser checks**, TypeScript and scoped lint pass. SQL parser checked **182 files / 462 function bodies**, plus RPC/table surface checks. Scoped `git diff --check` passes. Final logs are under `.audit/group-case-evaluator-followup/` (`node.log`, `types.log`, `final-lint.log`, `sql.log`, `final-browser.log`); desktop/mobile `note-only-blockers.png` screenshots are inside `final-browser/` and were visually inspected. The mobile test also checks horizontal overflow.

Browser scope: autosave and blur with all scores null; truthful failed-save retention and retry; legacy, malformed and wrong-applicant receipts; authoritative valid partial review; clearing its final star while retaining note-only evidence; older in-flight receipt versus newer note; clearing a previously saved note. All API responses were synthetic, intercepted on the established localhost:3000 harness; no hosted data was written. Initial host execution could not launch because Chromium revision 1248 was absent from its cache; the matching official Docker run passed. An earlier 12-check Docker pass preceded the final status-label/stale-receipt changes; the 14-check run is the final evidence. No full suite rerun was performed.

## Exact remaining verification gap

**The new migration and ten pgTAP assertions have not been executed in PostgreSQL.** The previously isolated DB was stopped/cleaned and was not restarted; no unrelated container was used. Parsing proves syntax, not table/function resolution, trigger compatibility, runtime authorization or data behavior.

The parent should apply the complete current migration chain, including `20261016200000_group_case_reviewer_quality.sql`, to a fresh isolated local DB, then run:

```sh
supabase test db supabase/tests/group_case_reviewer_quality.sql
supabase test db supabase/tests/group_case_rating.sql
supabase test db supabase/tests/grading_contract_consistency.sql
```

Use only the isolated local DB; do not add `--linked`. Existing suites cover round gates and grading invariants retained by the replaced function bodies. Until that proof, reviewer-quality integration remains SQL-parser-verified and browser-fixture-verified only. Deployment must include the additive migration to make live quality authoritative; omission degrades to explicit quality-unavailable copy. No deployment, hosted write, account change or external message was performed. Real reviewer acceptance, physical devices, assistive technology and non-Chromium engines were not exercised in this scoped pass.
