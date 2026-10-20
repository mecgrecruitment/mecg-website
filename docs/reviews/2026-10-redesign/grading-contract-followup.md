# Grading contract consistency follow-up

Date: 2026-10-16. Working-tree changes; no production migration, deployment or applicant data operations.

## Confirmed defects and implementation

The September inline RPCs saved partial observations under `SUBMITTED`, while `group_case_results` rescaled every observed subset to a full 8–40 score. Note-only saves contributed to evaluation counts. `is_decision_ready` counted locked rows without checking their observation prerequisites. The legacy and inline paths also differed on deadline and application eligibility guards.

`20261016191000_grading_contract_consistency.sql` adds an internal `evaluation_observation_quality` helper matching the existing enforced rules: every required criterion observed, the saved rubric's `minimum_observed_criteria`, and at least 75% observed rubric weight. The helper is not executable by authenticated clients; the guarded result and readiness RPCs call it. No saved observations are deleted or rewritten.

Group Case results now distinguish saved observations from valid evaluations. Per-evaluator evidence includes actual weighted coverage, the minimum observation count and the names of missing required criteria. An invalid observation has no weighted grade. The applicant mean requires two valid independent evaluators, and a spread of at least 25 on the equivalent 0–100 scale enters review. The existing 8–40 Group Case display scale, raw 1–5 ratings and N/O semantics remain. Criterion means explicitly remain raw observation summaries, including partial observations.

Decision evidence readiness now counts distinct evaluators with valid latest nonvoid locked evaluations against the current rubric, excluding declared evaluator conflicts. Weighted rounds still must be frozen/finalized. Draft and withdrawn applicants are not ready. Two rows or two versions from one evaluator cannot manufacture independence.

Both inline rating RPCs reject saves after `closes_at` or outside `ACTIVE`. Speed Dating now rejects withdrawn and draft applicants as its roster already did. The legacy `submit_evaluation` path uses the same application eligibility check. Eligible application rows are held with a share lock during the write so a concurrent withdrawal cannot silently race past the check.

The board table presents “Valid mean /40,” valid/saved counts, missing observation prerequisites and weighted coverage. Raw criterion summaries have an explicit caption. The Hash board, deliberation page and applicant dossier use a shared `roundEvidence` helper: latest nonvoid evidence per independent evaluator, exact rubric minimum, matching rubric version and valid locked counts. This closes the previous UI path that counted every submitted/locked historical version and silently fell back to a default criterion minimum.

## Verification evidence

- `npx tsc --noEmit --pretty false`: passed after the TypeScript/UI changes.
- Targeted ESLint covering the result table, boundary/helpers/tests, Hash board and deliberation page: passed.
- `node --import ./scripts/esm-loader.mjs --test src/lib/round-evidence.test.ts src/lib/group-case-results.test.ts`: 15/15 passed. Covers note-only and partial evidence, malformed completion payloads, explicit rubric minimum, latest/voided/version handling, independent evaluators and valid locked versus submitted counts.
- Existing `src/lib/evaluation.test.js`: 8/8 passed, preserving the original 0–100 scorer and 25-point review threshold.
- `supabase/tests/grading_contract_consistency.sql`: 37/37 real database regression assertions passed in the parent's isolated Supabase instance. Initial execution exposed a fixture identity mismatch; the test explicitly maps synthetic issuer/subject identities rather than weakening production authentication. The final isolated run passed all 10 SQL test files (642 checks, including 371 foundation checks); database lint reported no errors.
- Existing `supabase/tests/group_case_rating.sql`: intentionally updated two obsolete partial-grade/ranking expectations and explicitly maps its synthetic identity issuer. Its first-tap/save/clear/conflict behavior passed in that final isolated run.
- `python3 scripts/check-sql.py`: unavailable because this environment lacks `pglast`; no SQL syntax success is claimed from that command.

## Limits and policy boundaries

No rubric weights, round weights, quorum, Board decision authority, score anchors, applicant outcomes or released decisions were changed. The current defaults remain distinct from Board approval in `docs/policies/recruitment-policy.md`.

Inline rating edits before freeze are an existing September workflow; this change does not invent a new correction policy or make those saves immutable. A saved partial observation stays evidence, not a completed evaluation. The unresolved Board correction/late handling policies and actual staging acceptance remain open. The blind-resume policy conflict is outside this change and remains unresolved.

The table follows `docs/DESIGN.md`, design-system-workflow and Tufte's requirement to state each number's basis. TypeScript and boundary/type-system skills were applied. No new palette or quantitative chart was introduced. Browser rendering of the authenticated Group Case screen, real evaluator usability, Clerk/RLS integration on staging and real participant agreement have not been verified in this specialist task.
