disposition: fix

Independent finish review · October 17, 2026. `finish-review.md` was absent; used `reference/degraded/finish-reviewer.md` and `reference/operate.md` with the explicitly requested read-only review scope. No approved reproduction comp or new-world contract was supplied or required for this extension; current `docs/DESIGN.md` and the authorized first-pass brief govern.

## persistence

Pass for the substantial first implementation pass, not completion of the 52-feature plan. Read `docs/PRODUCT.md`, current design authority, shared design routing/workflow, and the revitalization README, DEPENDENCIES, REVIEW-RESOLUTION and IMPLEMENTED records. Existing identity and deferred policy/contract work are documented. IMPLEMENTED's verification checkpoint is older than the supplied test packet; the parent must reconcile final verification separately. Draft verification is not a failed implementation requirement by itself.

Reviewed the scoped shared CSS/navigation/notice, applicant portal/actions/onboarding/scheduling and application validation/recovery changes; member task construction, focused screening/calibration, Read/Score/recusal and observation source; Board overview/workbench, round/event sections, screening controls, communications/readiness, and notification receipt/retry/API source. Large forms and Board files were sampled at relevant state and presentation paths, not exhaustively audited. Earlier dirty changes outside this pass are not attributed to it.

Evidence: opened all eight supplied screenshot files with `view_image`. The desktop Board, reader and event captures are 1280px wide. The member, applicant, reader and two mobile Board captures are 780px raster images representing the packet's 390px viewport. They contain valid sample UI, not blank/error captures. `mvcl7il2-bc32a44c` (board-final) supersedes `mvcl6gjw-825654ba` for mobile Board totals. Desktop Board predates the final totals disclosure; its final desktop rendering is not independently evidenced here. The sample packet is adequate for this bounded finish review, not every route/state/breakpoint.

Parent-reported evidence: 888 node tests, four final focused Board checks and 16 desktop/mobile E2E checks passed; earlier TypeScript/lint passed, with final TypeScript and broader E2E still in progress at handoff. No tests were rerun, browser controlled, app mutated, or code edited by this reviewer. Source and synthetic captures do not prove deployed migrations, production permissions, inbox delivery, full accessibility conformance or real-user acceptance.

## fidelity

| Element / promise | Judgment | Evidence |
| --- | --- | --- |
| TYPE | Match | Compact system sans headings, readable response text, identifiers reserved for candidate/data context. No marketing display treatment imported. |
| MATERIAL | Match | Plain operating surfaces and hairlines; no invented physical effects or new image obligations. |
| GROUND | Match | Cool-paper canvas, white work surfaces and established blue selection/actions with restrained orange attention. CSS tokens agree with current authority. |
| Geometry and controls | Match in sampled views | Shared 4px rhythm, 8px controls, 12px grouped surfaces and 44px control roles; no material clipping in the supplied captures. This is not a full target/contrast/keyboard audit. |
| Applicant next task | Match | One next-event action precedes expandable application/date records. Source distinguishes schedule lookup failure, applicant-owned onboarding and Board-owned work; tab-scoped recovery language and validation-based completion remain explicit. |
| Member task and blind-review context | Match within scope | Active work, preparation, voting availability and read-only continuity remain distinct. No unsupported My work count badge. Reader shows candidate code and queue/cycle context without adding identity-bearing directory navigation; Read/Score and recusal remain in source. Original resume-content exposure remains the existing policy dependency, not newly established redaction. |
| Board attention → applicant work | Contradicted | The promoted attention rail promises a targeted queue, but query-only navigation does not update the roster's already-mounted filter state; see finding 1. |
| Evidence, readiness and communication truth | Match in reviewed source | Final-review status is not labeled evidence readiness; staffing/submitted forms are distinguished from qualifying evidence. Event context does not imply a round/rotation join. Configuration checks do not claim recruitment or email readiness. Retry acknowledgements bind the notification ID; GET authorizes the cycle and performs no send. Unknown retries use bounded status checks, and a negative read does not reopen retry in that component. Provider acceptance is distinct from inbox delivery. |

## ceiling

Reached for this bounded first-pass visual scope: task-first blue/orange identity, quiet structure, meaningful next actions and compact reader composition. No rebuild or pixel-only polish is requested. Unsampled failure states, full-route adoption and separately scoped capabilities remain outside this verdict.

## material_fixes

1. **P2 — Make attention links actually select their queue.** `src/app/admin/page.tsx:141` links to `/admin?filter=…#applicants`, while `src/app/admin/pipeline-board.tsx:303–322` reads query/filter/view values only in `useState` initializers. `PipelineBoardInner` has no query-change synchronization or query-bound remount. In-place Next navigation preserves this client state: from the mounted overview, choosing “new submissions,” then “in final review” can change the URL/anchor while retaining the earlier roster/filter, search or selected-only view. This undermines the primary blocker-to-repair handoff. Synchronize explicit attention navigation with the relevant filter/view state, clearing conflicting filters and selected-only display while preserving deliberate cohort-selection safeguards; alternatively use a deliberate remount with explicit handling of selection/pending work. Parent should verify successive rail clicks from a mounted Board, including after changing search/view, resolve to the named applicant subset and retain the selected cycle. This is a retained integration gap in the scoped attention/workbench journey, not a claim that all filter infrastructure originated in this pass.

## keep

Keep the final mobile totals collapse, current compact blue/orange system, distinct applicant/member next actions, candidate-only reader orientation, exact-copy recovery, and separation of saved/qualifying/locked/released/provider-accepted facts while correcting the queue handoff.
