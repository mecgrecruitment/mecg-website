# Board/admin workflow audit — 2026-10-16

Scope: applicants, decisions, grading operations, bulk actions and confirmations.
Method: independent AI specialist source review; not a real user study. No live browser,
database execution or account writes. Findings describe the inspected working tree;
concurrent implementation may change it. Only this report was written.
Authority: `docs/DESIGN.md` §§1–2 (task clarity, plain labels, workspace legibility).
Design-system workflow and Impeccable guidance informed review; Impeccable context
launcher failed with permission denied. No automated detector or delegated critique ran.

## Confirmed defects — top 3 actionable fixes

### 1. P1 — Make closing grading an explicit, consequential action

- Evidence: `src/app/admin/rush-controls.tsx:326–346` submits `SET_ROUND_STATUS`
  directly from a status select and generic **Save**, without confirmation or affected counts.
- Consequence: freezing is consequential: the RPC locks submitted evaluations and
  assignments; allowed transitions provide no return to active grading.
  Source: `supabase/migrations/20260914120000_group_case_self_service.sql:86–93`;
  `src/lib/workflow.ts:10–16`.
- Fix: replace generic Save for this transition with **Close grading…**. Review round
  name, submitted/open/missing counts and the lock consequence before final confirmation.
  Surface outstanding work as warnings; preserve the board's ability to proceed deliberately.
- Verify: with unfinished assignments, closing shows their counts and requires explicit
  confirmation; cancel makes no request; confirmation explains the lack of a reopen path.

### 2. P1 — Give batch decision release an actionable exception report

- Evidence: `src/app/admin/hash/page.tsx:256,299` passes every locked decision as
  `readyCount`; line 267 calls locked outcomes ready even alongside readiness issues.
  Individual release is additionally gated on `readiness.ready` at line 422.
- The batch RPC catches **all** per-decision exceptions and returns only aggregate
  released/skipped counts, losing applicant identity and failure reason.
  Source: `supabase/migrations/20260901060000_message_log_and_batch_release.sql:98–116`.
- UI attributes skips to readiness/conflicts and offers no per-item recovery in its result:
  `src/app/admin/decision-form.tsx:109–150`. Other errors can also reach that catch-all.
- Fix: preflight eligible versus blocked outcomes; confirm applicant/outcome totals;
  return per-decision safe reason codes and link each skipped item to its dossier.
  Keep queued delivery distinct from released state and expose the delivery log.
- Verify: a batch with one conflict and one unrelated failure releases eligible items,
  identifies both skipped applicants with correct next steps, and supports retrying them.

### 3. P2 — Make the selected applicant cohort visible and controllable

- Evidence: selection persists independently of search/status/resume filters and view;
  those controls update their own state without clearing or reviewing selections.
  Source: `src/app/admin/pipeline-board.tsx:419–427,515–531,571–586`.
- **Review advancement** reveals a count and staffing warning, then sends all selected
  IDs, including hidden rows; it shows no applicant list or clear-all action.
  Source: `src/app/admin/pipeline-board.tsx:545–560`.
- Fix: retain cross-filter selection but show “N selected, M hidden,” **Show selected**,
  **Clear selection**, and **Select eligible shown**; review names and destination before
  confirming a fixed cohort. Preserve the existing atomic staffing warning.
- Verify: select A, filter to B, select B; review lists both and identifies hidden A;
  clear removes both; changing filters during review cannot silently change its cohort.

## Hypotheses requiring operator validation

- Repeated individual selection may slow large cohorts; validate expected batch sizes
  before adding more bulk actions (`pipeline-board.tsx:243–250`).
- Group Case operators may need a dedicated “not graded” queue: results currently
  support name search and sorting, while ungraded rows are marked within the table
  (`src/app/admin/group-case-results.tsx:88–93,136–142`). Validate against the existing
  coverage board before introducing another queue (`src/app/admin/round-board.tsx:143–170`).

Preserve: existing two-step advancement, atomic staffing, pending/error notices,
decision release confirmation, coverage ordering and Speed Dating thin/split filters
(`pipeline-board.tsx:549–556`; `decision-form.tsx:85–102`;
`round-board.tsx:161–170`; `speed-dating-results.tsx:138–159`).
