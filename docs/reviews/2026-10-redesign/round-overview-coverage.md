# Rounds overview staffing accuracy — finding 084

Implemented on 2026-10-16 against the current shared tree. The Interviews overview now counts usable staffing within each round's own active-stage cohort. Recused/missed assignments and unrelated application stages no longer inflate coverage or create false gaps. This records a scoped correction, not a panel vote, production deployment or observed operator acceptance.

## Behavior and contract

- Extracted the round workspace's exact existing cohort predicate into `src/lib/round-cohort.ts` and reused it in the overview and `round-board.tsx`. Speed Dating includes `INVITED`, `GROUP_CASE`, `IN_PROCESS` and `FINAL_REVIEW`; Group Case includes `GROUP_CASE`, `IN_PROCESS` and `FINAL_REVIEW`. Other rounds retain the existing exclusion of draft, withdrawn and terminal application statuses. These are the current workspace's stage-based cohort rules, not a new enrollment or grading policy.
- Overview staffing uses the existing `countsTowardCoverage` / `groupCaseCoverageState` rules. `ASSIGNED`, `IN_PROGRESS`, `SUBMITTED` and `LOCKED` assignments count; recused, missed and unknown statuses do not. Assignments outside the selected round's cohort are excluded from both staffing and submitted-form denominators.
- Each interview row now says “Staffing — N/M with 2+ assigned” and “Submitted forms — N/M.” The explanation directly says that submitted forms may contain partial observations and that qualifying evidence must be checked within the round. Neither these counts nor two submitted records establish valid/independent evaluations, qualifying evidence or decision readiness.
- Application screening routes to its dedicated screening workspace without rendering interview-assignment counts, because screening uses a separate assignment workflow.
- Existing overview query failure behavior is preserved: unavailable assignment data throws rather than rendering false zero counts. No scoring data, evaluation evidence query, results RPC, capability or permission was added. The parent-owned round board evidence/staffing changes were preserved; its only scoped change is importing the shared cohort predicate and replacing the identical inline filter.

## Verification

Commands from `/home/rahil/mecg-website`:

```sh
node --experimental-test-module-mocks --import ./scripts/esm-loader.mjs --test src/app/admin/rounds/coverage.test.ts src/app/admin/rounds/page.test.ts src/app/admin/group-case-coverage.test.ts
npx tsc --noEmit --incremental false
npx eslint src/lib/round-cohort.ts src/app/admin/rounds/page.tsx src/app/admin/rounds/coverage.ts src/app/admin/rounds/coverage-fixture.ts src/app/admin/rounds/coverage.test.ts src/app/admin/rounds/page.test.ts src/app/admin/round-board.tsx
```

**16/16 focused Node tests passed**, including eight new helper/actual-page SSR regressions; TypeScript, scoped lint and scoped whitespace checks passed. Logs are `.audit/round-overview-coverage/node.log`, `types.log` and `lint.log`.

The mixed-stage fixture has earlier submitted applicants, invited applicants, Group Case applicants, progressed applicants and terminal/withdrawn applicants, with open/submitted/locked/recused/missed assignments. It proves Group Case displays `2/3` staffed and `3/4` submitted forms, while Speed Dating displays `2/4` staffed and `2/5` submitted forms. Historical out-of-cohort submissions and recused/missed records cannot inflate those values. Additional tests cover unknown assignment states, empty cohorts, the shared terminal filter, the distinct screening workflow and an assignment-service failure. Actual `RoundsPage` server-rendered output is exercised with synthetic auth/database boundaries; the test also checks that no score/evaluation-evidence selection is introduced.

The established Precision Instrument layout, typography and semantic colors remain in place. Direct labels and denominators make the numeric comparison explicit; no chart, scale, additional color encoding or decorative metric was added.

## Limits

This pass did not rerun the full database or browser suites: no SQL changed, and the correction is isolated staffing computation, shared filtering and server-rendered copy. The page tests use mocked database/auth boundaries and do not establish hosted Clerk/PostgREST/RLS integration, visual accessibility conformance, live operator success or production readiness. Canonical grading/results and release gates remain the authority for valid evidence. No hosted write, deployment, commit or external message occurred.
