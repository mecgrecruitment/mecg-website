disposition: ship

Follow-up source review of changes outside the earlier final review. No browser, database execution or deployment was performed by this reviewer. This is a local-change review, not a production-release certification.

## persistence

Reviewed migrations `20261016190000` through `20261016193000`; revision-aware draft load/save/submission routes and client conflict handling; `round-evidence.ts`, Group Case validity/results and their operator consumers; batch decision API/client diagnostics; dynamic project pages, generated Open Graph/Twitter images and publication lookup; and the draft-race/publication proof scripts. Existing product, policy and identity authority remains unchanged.

## fidelity

The draft writer compares opaque revisions, serializes initial saves and submission, preserves exact mutation retries and fails closed on the historical writers. Explicit conflict choice retains both copies. Grading distinguishes saved observations from valid independent evidence, checks current application eligibility and round closure, and uses the rubric minimum/required/coverage conditions. Batch release preserves the reviewed cohort/outcomes/blockers, rechecks server guards and reports per-applicant recovery without returning provider errors. Publication resolves the approved RPC boundary per request; withdrawn details and generated images fail rather than continuing to publish build-time slugs. The publication proof checks the actual metadata image URLs and PNG signatures.

## ceiling

No additional confirmed correctness or security blocker was found in the sampled continuation. Source review does not prove all concurrent interleavings or external identity, storage and delivery behavior. The existing real-user study and operator-acceptance boundaries still apply; there is no evidence of a 100-person consensus.

## material_fixes

Resolved during this review: `src/app/api/admin/decisions/route.ts` retained a 16 KiB request ceiling even though reviewed batch release now sends every decision/outcome/blocker. A sufficiently large cohort could complete preflight but always receive 413 on confirmation. The parent authorized the smallest fix: a bounded 1 MiB request ceiling, preserving the full snapshot and all authorization/server checks. `route.test.ts` now exercises 500 decisions above the old ceiling and verifies exact forwarding, plus rejection of both declared and actually streamed oversized requests. No remaining material fix is identified by this follow-up.

## keep

Keep revision preconditions, explicit recovery choices, independent valid-evidence gates, exact reviewed release snapshots, per-applicant retry guidance, and request-time publication withdrawal checks. Reviewer verification: all 17 decisions-route tests and targeted ESLint pass. Parent-reported wider evidence before this small fix was 637 Node tests, 642 SQL assertions, 60 E2E checks, build, lint and TypeScript; this reviewer did not independently rerun that wider set.
