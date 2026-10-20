# Round-close coverage follow-up

Implemented locally on 2026-10-16; no deployment or production data change.

## Result

The round status control now fetches a current authorized aggregate snapshot before asking an operator to close grading. It distinguishes applicants with two valid independent evaluations from those still short, submitted observations from valid work, and real open assignments from inferred work. Cohort means actual round participation or legacy assignment in the same cycle, excluding draft/withdrawn applications. Application screening has a separate contract and is explicitly unsupported by this interview summary.

The new read-only `round_close_summary` RPC returns nine fields and no names, IDs of applicants/evaluators or scores. Board/Owner authority matches `set_round_status`. The GET route derives the actual cycle through the caller's RLS-scoped round, checks current permission and validates the response; all responses use no-store. There is no service-role read or provider-error disclosure.

The UI waits for verified counts, allows retry/refresh, describes genuine empty cohorts and stops confirmation for invalid/wrong-round/changed-status responses. It warns that incomplete work still permits closing. Load time and explicit drift wording make this an advisory snapshot, not an atomic freeze of the reviewed cohort. The existing authorized freeze transition retains its policy and locking. A synchronous ref prevents duplicate close writes, cancel receives initial focus, and Escape/cancel return focus to the opener. Committee-only operators retain assignments without seeing a round-status action that their role cannot perform.

## Evidence

- All migrations including `20261016194000_round_close_summary.sql` applied to the disposable local PostgreSQL 17 project. **673 assertions across 11 SQL files passed**, including **31 round-close assertions**; database lint returned no errors.
- **650 Node tests passed**, including API access/transport/response boundaries and summary invariants. Final focused parser/API rerun: **11 passed**.
- Full desktop/mobile Chromium suite: **76 passed**. Final operator suite after focus/network/role refinements: **18 passed** (16 overlap, 78 distinct checks total). APIs were intercepted with explicit synthetic fixtures; this does not prove hosted identity/RLS/browser integration.
- TypeScript, ESLint, production build and whitespace checks passed. CI-pinned SQL parser: **178 files / 459 bodies**, **94 RPC / 25 table names** checked.
- Host-native browser inspection at 1280×900 and 390×844 used the shipped component in a two-flag local-only harness with synthetic HTTP responses. Captures are ignored `.audit/redesign/round-close-desktop.png` and `round-close-mobile.png`; mobile showed no horizontal overflow and a vertically scrollable native dialog. Final permission/focus/network changes preserve the captured visual composition. No real round was closed.
- Independent [focused review](round-close-review.md): ship for local scope, with explicit limits.

## Remaining evidence

No `.env.local`, `.env.staging` or `.env.test` exists here; no designated staging URL or enabled Clerk test workflow is configured. Hosted session/storage/delivery and actual operator acceptance remain unverified. The genuine 100-person panel is still unstarted; the prepared protocol and blank evidence template do not establish any agreement. Coordinate the five migrations with the application rollout, especially revision-aware legacy-writer failure behavior. No live rubric weights, quorum, approval or retention policy changed.
