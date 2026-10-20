disposition: ship

Independent correction verdict · October 17, 2026. Scope: the single P2 finding in `FINISH-REVIEW.md`, within the authorized substantial first implementation pass. This does not certify completion of the 52-feature plan or reopen the previously accepted sample visuals.

| Original finding | Score | Verdict |
| --- | --- | --- |
| P2 — Make attention links actually select their queue | Resolved | Ship at this scope |

Read the original review, current `src/app/admin/page.tsx` and `pipeline-board.tsx`, their working-tree diff, `tests/e2e/attention-navigation.spec.ts`, its `pipeline-navigation` synthetic harness, and Playwright project configuration. The diff contains broader first-pass work; the correction was assessed against the original finding and current source rather than treating the entire diff as new correction work.

`rosterLocation` parses initial and subsequent URL values into typed filter state. The guarded location-key synchronization applies changed query state to the mounted Board, including defaults that remove conflicting search, resume, view, sort and decided settings. It exits selected-only display and invalidates the previous advancement review. The tagged attention links also trigger a delegated primary-click handler restricted to the same origin, pathname and cycle. This covers clicking the already-current queue URL after changing local filters, when URL synchronization alone would not run.

Neither synchronization path clears selected IDs or resets pending advancement/move state, and no query-bound remount was introduced. Hidden selection counts continue to derive from the current visible IDs. Queue navigation does not invoke advancement or alter permission checks. The source therefore addresses the original requirement to select the named queue while retaining deliberate cohort selection and requiring a fresh advancement review.

The regression exercises search → new submissions → stage view/search → final review → the same final-review link after another search → missing resumes. It asserts the resulting filters, visible examples, cleared search, return to the roster, retained hidden selection and cycle. Its harness renders the real `PipelineBoard` with synthetic applicants and tagged Next links; it does not render the authenticated dashboard rail or query a real recruitment database. Desktop Chromium and mobile Chromium are configured. Selected-only reset, sort/decided reset, advancement-review invalidation and navigation during an in-flight mutation are supported by source inspection, not directly asserted by this regression.

Opened the correction screenshot with `view_image`: `browser-screenshot-localhost-mvclf80t-594639dd.png`. The 1280px sample shows an empty search, “Application in” filter, “Showing 1 of 6” and one submitted applicant, with no visible overflow. The supplied URL identifies `filter=SUBMITTED&cycleId=preview-cycle#applicants`; the parent reports manually clicking the actual sample rail. The still image supports the resulting state, not the click sequence. Prior accepted captures stand, with board-final superseding the older mobile Board capture; they were not reopened in this correction pass.

Parent-reported verification: 12 attention-navigation/operator-review checks passed, 50 screening checks passed after removing rating press shrinking, and four application-recovery artifact reruns passed. These results were not rerun or independently inspected here. The separate screening and artifact-path fixes are context, not additional resolved findings. No browser control, application-code edits, test runs or agents were used. No material issue remains for this finding; this verdict makes no broader production, permission, deployment or full-route readiness claim.
