# Private workspace implementation — October 17, 2026

This record covers the current authorized implementation pass, extending the established Open studio private interface. The organizing task remains: make the next action clear, provide a focused place to do it, and show the actual result. Blue/orange, the system font, current permissions, cycle context and recruitment rules remain authoritative.

This is partial progress against the [52-feature plan](README.md), not completion of all applicant, member and Board proposals. The original reports, atlas, [dependencies](DEPENDENCIES.md), [planning review resolution](REVIEW-RESOLUTION.md) and planning-only `VERIFICATION.md` remain historical planning evidence. This file records application changes separately.

## Implemented scope

### Applicant

The applicant portal uses a compact status header and next action. The current application does not repeat its pipeline stepper inside the record; recruitment dates, answers and message history use disclosures. Schedule lookup failure remains distinct from no bookings. Booking cancellation/change confirmation names the event and time; confirmation receives focus and cancellation returns focus to its trigger.

Application writing retains exact-copy recovery, conflicts and uncertain-submission handling. Recovery language now identifies tab-scoped browser storage. Earlier steps receive completion marks only when their current required values validate; visited but invalid steps show “Needs attention.” The page-level introduction and form guide avoid duplicate progress composition. Rejection copy states the released outcome without inventing selection reasons. Accepted onboarding separates applicant-owned steps from “MECG is arranging” Board work; completing a checklist does not grant member access.

Sources: `src/app/applicant/page.tsx`, `schedule-action.tsx`, `onboarding.tsx`; `src/app/apply/page.tsx`, `application-form.tsx`, `application-recovery-review.tsx`.

### Member

My work distinguishes active assignments, calibration prerequisites, published-round preparation and completed/read-only continuity. Tasks use known closing dates; absent deadlines remain absent rather than gaining invented urgency. Speed Dating published state offers preparation and active state offers grading. Group Case state retains its own persistence/editability meaning. Eligible Hash voting appears as an available shortcut without pretending eligibility proves an unfinished ballot or increasing the unfinished-task count. Lookup errors do not silently become zero work.

Blind reading uses explicit private styling and compact candidate/cycle/queue orientation, retaining existing Read/Score and recusal behavior without adding the general directory-bearing sidebar. Event observations distinguish explicit closure, check-in required, denied/unavailable access and general loading failure. Applicant search keeps filtered forms mounted so unsaved notes survive filtering. Successful explicit observation saves show a receipt and saved control state; edits clear that receipt.

Sources: `src/app/member/page.tsx`, `work-tasks.ts`, `group-case/workspace-state.ts`, `screening/[assignmentId]/page.tsx`, `screening-reading-desk.tsx`, `event/observation-state.ts`, `observation-roster.tsx`, `impression-form.tsx`.

### Shared presentation and navigation

`.workspace-private` extends current tokens to focused routes independently of sidebar presence. Shared controls target 44px, with existing 8px control/12px panel geometry, visible focus and mobile input/reflow treatment. Navigation separates My work, Recruitment, Community and Administration while preserving permissions and selected-cycle links. An inaccurate My work count badge is not shown.

Sources: `src/app/workspace.css`; `src/components/workspace-nav.tsx`, `workspace-sidebar.tsx`, `workspace-header.tsx`; `src/lib/workspace-navigation.ts`.

### Board and communications

The current recruitment overview has compact metrics, a targeted attention rail, the next scheduled event and the applicant workbench. Empty attention copy describes the specific checks represented; it does not declare every applicant ready. Interview lists separate assigned staffing and submitted forms from qualifying evidence.

Local event section links reach attendance recording, live attendance, check-in QR, observations, RSVP slots and event settings. Event context explicitly does not establish round staffing, qualifying evaluations or applicant readiness. Round section links organize the existing overview, evidence, staffing/lifecycle, groups, assignments and results where applicable. These are local operating compositions, not an authoritative event-to-round join, physical-post assignment or rotation controller. Configuration/readiness copy distinguishes database/configuration checks from recruitment readiness and email verification.

Notification retry validates that the acknowledgement belongs to the selected notification. POST retry waits up to 15 seconds; an uncertain result switches to a GET status check with a 10-second timeout. GET is authorized for the notification's cycle and does not enqueue or send. A negative read does not prove an earlier uncertain write cannot still commit, so it does not reopen the send action. A confirmed `SENT` record is described as provider acceptance; inbox delivery remains unconfirmed.

Sources: `src/app/admin/page.tsx`, `pipeline-board.tsx`, `rounds/page.tsx`, `round-board.tsx`, `events/[id]/page.tsx`, `operations/readiness-panel.tsx`, `messages/page.tsx`, `notifications/retry-button.tsx`, `notifications/retry-receipt.ts`; `src/app/api/admin/notifications/route.ts`.

## Verification status

Final local checks: **888 automated Node tests passed**. **122 distinct desktop/mobile Chromium checks across 10 relevant browser spec files passed across the initial and isolated correction batches**. This was not one uninterrupted 122-test run. TypeScript, targeted ESLint and `git diff --check` passed on the implemented files. The browser coverage includes application keyboard/recovery, immutable/read-only Group Case continuity, screening CAS/conflicts/unknown outcomes and native pointer-up geometry, reviewed advancement/release, notification target-bound readback, observation search/edit/save, and successive Board attention navigation.

The first full Node run had one Board event-anchor failure during concurrent implementation; it was corrected and the full suite rerun successfully. The larger initial browser batch passed 98/102: one rating target shrank on press, two trace-file errors resulted from overlapping output-directory cleanup, and one recovery screenshot used an unwritable historical artifact path. Removed the rating/tab shrinking, made the screening harness use the current private scope, and moved that screenshot to the test's per-run output. All 50 screening cases and all four affected applicant recovery cases passed in isolated output directories. The final attention/advancement batch passed 12/12, including the newly added two-platform navigation regression. No failed assertion was relaxed to obtain these results.

Parent browser inspection used fictional read-only preview data at 1280×800 and 390×844: applicant portal, member home, blind reading/scoring and Board recruitment; the event operating page was also inspected on desktop. Menu Escape/focus return was exercised on mobile; sampled screens had no page-wide horizontal overflow. Save/recovery/final-write behavior was exercised in intercepted synthetic harnesses rather than writing real recruitment records. The member event search fixture verifies notes survive filtering, confirmed save releases pending state, and editing clears the prior Saved receipt.

The independent [finish review](FINISH-REVIEW.md) accepted the sampled first-pass visuals and requested one material correction: Board attention links could leave mounted roster filters stale. The correction applies explicit URL queue state and same-queue click intent without remounting or clearing selected applicant IDs; it clears conflicting view/search/resume/selected-only display and invalidates the old advancement review. Tests verify successive and repeated same-queue navigation, hidden selection and selected-cycle preservation. The [correction verdict](FINISH-REVIEW-RESOLUTION.md) records the final disposition at that finding's scope.

This documentation summarizes source and parent verification; the documenter did not independently rerun those checks. Earlier homepage results are not private-workspace evidence. No production build, hosted Clerk/Supabase session, real email inbox delivery, screen-reader session or real-user acceptance study was performed for this pass.

## Boundaries and remaining work

No new policy, schema, production deployment, real email delivery or real-user study is established by this pass. Sample previews and local tests do not prove production access, data correctness, full accessibility conformance or usability improvement. They also do not establish all routes, failure states, browsers or the 52 feature areas as verified.

The mixed contract/policy packages in DEPENDENCIES.md remain separate: authoritative task aggregation, material replacement capability/readback, live-evidence concurrency, optional event/rotation joins, accepted-to-member reconciliation, approval provenance and persistent handover. Preserve current scoring weights, quorum, conflict handling, immutable final submissions and explicit outcome release. Original resume identity exposure, mutable inline evidence versus final submission rules, accommodations, corrections, retention and role activation still require their named owners' decisions.

The first implementation pass remains bounded to the changes above. The 52-feature atlas is not a completion checklist; its separately scoped contracts and policy-dependent proposals remain planned.

## Board queue correction and compact totals

Cycle totals are available in a native disclosure, with the applicant/active-round summary visible while collapsed; this brings the attention queue higher on narrow screens. Attention links synchronize mounted roster state on both changed query URLs and repeated clicks to the same queue. Existing selected IDs and their hidden-selection counts remain explicit; changing the visible queue discards a stale advancement review rather than silently applying it to a new subset. The listener is limited to tagged same-origin, same-page, same-cycle queue links and does not perform a mutation.

## Application reader revision — 2026-10-17

Replaced the member reader's near-even application/form split and the Board dossier's profile rail plus exclusive tabs with continuous application reading and a compact role-specific tools rail. Added question anchors, larger expandable resume viewing, collapsed Board background details, on-demand rubric guidance, compact save receipts and mobile reading/review navigation. Preserved screening draft recovery, rating/evidence requirements, conflicts, unknown-action handling, final locking and the existing Board capability boundaries.

Verification: 52 desktop/mobile Chromium browser checks passed, including screening revision/recovery/finalization and Board section input retention; TypeScript and targeted ESLint passed. Live read-only preview inspected at 1440px and 390px. Synthetic fixtures only; attached PDF rendering and production authenticated data were not exercised. No deployment.

## User friction fixes — 2026-10-17

- Fixed conflict and member-chat success handling: capture the form before awaiting the request, so successful writes no longer fall into the error path while trying to reset a detached event reference.
- Replaced the browser conflict confirmation with an inline review naming the chosen applicant, explicit irreversible consequences, a keyboard-focused confirmation and a cancellation path that retains the reason. Editing the applicant or reason invalidates that confirmation.
- Conflict, chat-slot and profile writes now require their actual `{ ok: true }` acknowledgement and have a deadline covering response-body consumption. Unknown conflict/slot outcomes preserve input and block duplicate submissions until the user checks current server state. Profile saves keep input and permit an explicit retry of the reversible update.
- Disabled profile fields during a pending save so the receipt cannot appear to acknowledge edits made after the request began.
- Made same-path cohort/query navigation close the mobile menu, with focus returned to its trigger. Horizontal section navigation scrolls only its own strip, avoiding page jumps.
- Raised mobile menu, account, sign-out and applicant status refresh targets to 44px. Preserved logo proportions and gave account details a stable column beside the avatar, with sign-out below rather than squeezing the name.

Verification: 36 desktop/mobile Chromium cases passed across usability and existing cohort-routing suites; the final query-change focus refinement passed both targeted browser cases. TypeScript and targeted ESLint passed. Live preview inspected at 390px and 1440px. Form writes were exercised only through synthetic request interception; no production records, messages or account actions were changed. These fixes address the concrete problems found in this pass, not a claim that every workspace journey has been audited.
