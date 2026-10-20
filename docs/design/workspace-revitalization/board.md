# Board workspace revitalization — planning brief

Date: 2026-10-17. Scope: board, committee, panel and owner operations in the current working tree. Planning only; no application changes, browser inspection, external writes or delegated work. Applicant/member specialists own their respective daily journeys; this brief covers the operational handoffs to them.

## Evidence, authority and proposed direction

**Observed** below means visible in source, not exercised in a running application or confirmed by operators. **Hypothesis** means a plausible friction to validate, never a user-research finding. **Existing** means a source-observed capability to retain or recompose; **new** means a proposed interaction, data contract or workflow. Effort is relative implementation scope, not a delivery promise: S = local composition/copy; M = several components or a query/API extension; L = persistent workflow, authorization or policy work. P0 = preserve/resolve before relevant live operation; P1 = next useful iteration; P2 = defer until validated. P0 does not mean implement speculative functionality immediately.

Authority: [PRODUCT](../../PRODUCT.md), the **top current rules** and shared geometry in [DESIGN](../../DESIGN.md), [recruitment policy](../../policies/recruitment-policy.md), repository AGENTS.md, `/home/rahil/.agents/design-routing.md`, and `design-system-workflow/SKILL.md`. TypeScript source reading followed its skill and type-discipline companion; quantitative recommendations follow Tufte's integrity guidance. No new chart or categorical palette is proposed, so dataviz validation is an implementation dependency if that scope changes.

Recommendation: make the workspace an **Operate** experience: “What needs a decision or repair, what evidence supports it, what changes next?” Keep current destination names unless operator testing supports a rename. Express MECG's bold blue/orange personality in the blue logo band, selected navigation, decisive blue primary actions and restrained orange attention counts. Do not import homepage heroes, photography or persuasive copy into operational forms.

Retain white sidebar, 240px desktop width, cool paper, existing system sans, 4px spacing rhythm, 8px controls, 12px panels, and 44px action targets requested for this work. Use semantic roles in `src/app/workspace.css`; do not patch each page with fresh radii. Plain 28px page titles, compact rows, hairlines and section-level breathing room can replace legacy navy metric tiles and nested tinted boxes. Mono belongs to codes, times and figures. Blue-field focus is white; light-surface focus is ink. Motion only explains state, respects reduced motion and never delays work.

### Contracts every recommendation must preserve

- Authorization remains server/RPC/RLS enforced. Navigation visibility is not authorization. Maintain selected-cycle URLs and entity-owned cycle resolution; Projects remain organization-wide.
- Preserve blind screening, reader/panel separation and conflict checks, including fail-closed evidence reads. Names, photos, contact, reviewer identity and prior-cycle history must never be newly exposed through summaries, search, exports, client props or error messages. An unresolved privacy concern is not permission to show more.
- Preserve 40/60 round weights, 1–5 or N/O rules, required criteria, 75% observed rubric weight, two independent valid evaluations, the 25-point spread-review default and current quorum. Preserve source-specific Speed Dating treatment while reconciling its interpretation with the draft policy. Attendance and event observations do not become merit scores. Hash adds no numeric score.
- Submitted evaluations remain immutable. Corrections, late grading, excused alternatives, retention, quorum changes and decision supersession require policy resolution before implementation; no “quick edit” or “reopen grading” shortcut.
- Saved draft, submitted evaluation, released internal ranking, locked decision, applicant-visible outcome, queued notification and confirmed delivery are different facts. Use labeled facts with timestamps/provenance; do not compress them to a green “Done.”
- Board approval remains unresolved in the policy file. Source behavior is not policy approval or proof of production readiness.

## Shared interaction contract

All feature entries inherit this baseline, with feature-specific requirements below: at 320–390px stack task/evidence/actions in reading order, wrap long names and errors, keep 44px targets and prevent sticky controls from covering focus or final rows. Native labels and keyboard controls remain available; dialogs support Escape where safe and return focus; tab widgets retain arrow/Home/End semantics. Empty, filtered-empty, unauthorized/withheld, loading, stale and failed states must be distinct. Recoverable errors retain entered values. Ambiguous mutations say “Could not confirm” and reconcile authoritative state before offering another write. Announce results without reading entire tables repeatedly. Success acknowledges the exact action, not a downstream action that has not happened.

Counts must name a denominator, scope and freshness. Prefer a compact labeled table or sentence over decorative progress rings. Unknown is not zero. Ranking movement is an observed algorithm result, not an improvement in fairness or predictive validity. Each acceptance criterion below also requires this baseline and role/cycle regression coverage.

## Feature-by-feature recommendations

### 1. Navigation and cycle context — P1 / M

**Sources:** `src/components/workspace-nav.tsx`, `workspace-sidebar.tsx`, `src/lib/workspace-navigation.ts`, `workspace-cycle-url.ts`.

**Observed / existing:** One shared capability-gated sidebar has Workspace, My tools and Administration; cycle switching is permission-filtered. Mobile Menu closes on Escape and returns focus. Decisions, Communications and Interviews are already grouped destinations. Referrals, provisioning and delivery are contextual destinations rather than primary sidebar links.

**Hypothesis:** Board members with member tasks can lose the distinction between their own work and cycle-wide work; adding every feature to the sidebar would compound it.

**Before → after:** Select destination → inspect its purpose; instead, retain groups and add concise page-level task context (“Your assignments” versus “This cycle”), parent breadcrumbs and contextual links to subsidiary queues. Keep existing names; make only real authorized attention counts visible.

**New:** Cross-page contextual queue links, not a global command center. **States:** Mobile preserves cycle picker before links; no authorized destination explains access rather than showing empty work. Navigation failure keeps safe role defaults. Keyboard focus must remain visible when Menu opens/closes.

**Dependency / acceptance:** Existing cycle URL contract. Following a dossier, round, delivery or incident link and returning preserves the intended cycle and parent context; forbidden links never become shortcuts around route checks.

### 2. Recruitment overview — P1 / M

**Source:** `src/app/admin/page.tsx`.

**Observed / existing:** Submitted applicant roster, five metrics, missing-resume/new-submission/final-review attention links, event attendance/next-event RSVPs, evaluation progress and manual intake disclosure.

**Hypothesis:** “Ready for final review” derives from pipeline status, so it can be mistaken for verified decision readiness; all past/future events in the rail may dilute the next live task.

**Before → after:** Read totals and scroll → choose an attention row with its reason and destination. Label status-derived counts “In final review”; show upcoming event first and past events on disclosure. Keep one compact summary and the roster as main work. Add evidence/delivery issues only from authorized authoritative queries, not inferred metrics.

**New:** Actionable blocker aggregation (M), optional after existing queues are clarified (S). **States:** Mobile puts immediate issues before secondary metrics; zero applicants offers permitted setup/intake links, not zero-state optimism. Partial failed queries must say unavailable. Queue links and refresh work by keyboard.

**Dependency / acceptance:** Decisions/evidence and delivery query contracts. A FINAL_REVIEW application with missing evidence is never labeled release-ready; every count opens the same scoped cohort it describes.

### 3. Owner operations readiness — P1 / S

**Sources:** `src/app/admin/operations/page.tsx`, `operations/readiness-panel.tsx`, `src/app/api/admin/operations/route.ts`.

**Observed / existing:** Owner-only database/configuration checks, checked timestamp, retry and red/green result. Configuration covers Supabase, server key, recruitment email, contact recipient and scheduled-job secret.

**Hypothesis:** “Production dependencies are ready” can read as end-to-end email or recruitment readiness, though these checks establish narrower facts.

**Before → after:** Run check → broad ready banner; instead, show “Required configuration checks passed,” database result, checked time and next diagnostic per failed dependency. Preserve no-secret output. No graphs of latency or uptime.

**New:** Diagnostic guidance copy; no monitoring system. **States:** Single-column mobile list; initial check, stale previous result, 503 dependency failure and request failure differ. Retry has pending state and one announced result; all actions keyboard accessible.

**Dependency / acceptance:** Engineering validates each diagnostic's scope. A configured email key never claims a delivered test email; checks reveal no secret values and remain owner-only.

### 4. Applicant list, stage board and cohort advancement — P0 preservation; P1 refinement / M

**Sources:** `src/app/admin/pipeline-board.tsx`, `pipeline-selection.ts`, `pipeline-status-form.tsx`, `pipeline-kanban.ts`, `src/app/api/admin/rush/route.ts`.

**Observed / existing:** Search, status/resume filters, sorting, list/stage views, drag/drop and non-drag stage control, decided disclosure, exact advancement review, hidden selected count, select eligible shown and partial-result handling. Operations may move stages; cohort advancement separately needs cycle management.

**Hypothesis:** Parallel list, board and selection mental models can obscure whether a filter changes the operation's scope.

**Before → after:** Filter → select → review → advance remains; make scope persistent (“Selected X, including Y hidden”), keep one Open file action per row, and put manual movement beside stage context. Give stage moves a concise “Stage changed; no applicant outcome released” receipt where accurate. Do not introduce bulk irreversible outcome actions here.

**New:** Scope/receipt presentation; no new pipeline engine. **States:** Mobile defaults to roster with labeled stage controls; no drag dependency. Distinguish no submissions from no filter matches. Failure/unknown move restores or reconciles authoritative status; keyboard drag and explicit select remain supported.

**Dependency / acceptance:** Existing selection tests and mutation contracts. Changing filters never silently changes reviewed IDs; stale/ineligible applicants are reported individually; focus returns to the affected row/review result.

### 5. Applicant dossier — P1 / M; P0 privacy audit before expansion

**Sources:** `src/app/admin/applications/[id]/page.tsx`, `tabs.tsx`, `dossier-navigation.ts`, authorized resume/headshot API routes.

**Observed / existing:** Evidence, Interviews, Decision, Messages, History tabs; PDF metadata/fallback; prior/next with validated return context; offer response; operational contact/accessibility context. PANEL-only views hide specified identity/materials; conflict lookup fails closed. Tabs already support arrows/Home/End.

**Hypothesis:** A tall identity/resume rail and tab-local state hide the next operational action; local tabs reset to Evidence. Also the accessibility-notes block is outside the visible `!panelOnly` guards: needs a focused privacy review against underlying data policies, not an assumption that it leaks in production.

**Before → after:** Open file → find relevant tab → act; instead show compact status/next permitted task, then evidence tabs. Make active section deep-linkable while preserving return cohort. Operational access needs remain available only to authorized scheduling staff, separate from merit evidence.

**New:** URL section state and explicit operational-context permission review. **States:** Mobile starts with status/task, makes resume a disclosure plus new-tab link. Empty responses, withheld evidence, missing PDF record and failed load remain distinct. Preserve tab keyboard model and navigation context.

**Dependency / acceptance:** Confirm field-level authorization before recomposition. PANEL-only and conflicted fixtures reveal no protected fields in HTML/client payloads; next/previous keeps filter and section without mixing applicants' unsaved forms.

### 6. Screening batch and packet approval — P1 / M

**Sources:** `src/app/admin/screening/page.tsx`, `screening-controls.tsx`, `packet-action.tsx`, `src/app/api/admin/screening/route.ts`.

**Observed / existing:** Four-step reader selection → packet approval/redaction → distribution → tracking/close flow; three readers/application, workload cap, conflicts excluded, PANEL readers excluded, reassignment of open work, batch reset only in permitted states, approved packet disclosure and late-submission notice. Enrolled readers' packet view is withheld.

**Hypothesis:** All four phases plus expanded unapproved packets create a long control page; “Send out” may imply email rather than assignment availability.

**Before → after:** Scroll stepper → discover blocker; instead open current phase first, collapse completed phases with evidence counts, call distribution “Assign readers and open review,” and collect rejected/manual-edit packets into a focused queue. Keep approved counts separate from distributed reads and email.

**New:** Phase-focused presentation and packet filters; no auto-redaction or additional screening policy. **States:** Mobile packet review is one column with clear save/approve boundary; no readers links to permitted People setup. Hidden-to-reader is a withheld state, not no packets. Failed bulk approval retains per-packet failures; keyboard reaches each response edit and result.

**Dependency / acceptance:** Screening RPC safeguards. Three readers, caps, conflict exclusions, late-applicant handling and immutable submitted reviews remain identical; bulk approval never hides manual failures or expands visibility.

### 7. Screening progress, close and internal release — P0 state clarity / S–M

**Sources:** `screening/screening-controls.tsx`, `screening/page.tsx`, screening API/RPC contract.

**Observed / existing:** Per-reader submitted/assigned totals, open-packet reassignment, close blocked until all reads complete, frozen results and separate owner-triggered ranking release to Board/committee.

**Hypothesis:** “Released” is ambiguous across this route and applicant decisions.

**Before → after:** Close review → release ranking; keep both actions, with a compact receipt: “Review closed,” then “Ranking visible to Board and Recruitment Committee.” Use “internal ranking” consistently and explicitly state applicant outcomes are unchanged. Link overdue workload to reassign rather than another reminder system.

**New:** State-specific copy and result context. **States:** Mobile progress uses labeled submitted/assigned figures rather than wide tables alone. No assignments and all submitted differ. Unknown close/release acknowledgement requires authoritative reconciliation; keyboard focus moves to the phase result without losing reader position.

**Dependency / acceptance:** Confirm mutation acknowledgements and internal-release visibility. Internal release never sends an applicant outcome; a pending read cannot be hidden by a zero-denominator percentage.

### 8. Reader-adjusted ranking and calibration — P1 / M

**Sources:** `screening/calibrated/page.tsx`, `screening/reader-calibration.ts`, `screening/screening-result-groups.ts`.

**Observed / existing:** Frozen-only adjusted ranking; reader lean/spread/read counts; raw and adjusted ranks/scores, tied ranks, individual evidence, class/major and recommendation counts. Ranking table has an 80rem minimum width.

**Hypothesis:** Large table and strong causal copy (“not helped or hurt”) imply certainty beyond a co-reader adjustment; compact recommendation initials require decoding.

**Before → after:** Scroll raw/adjusted columns → infer adjustment; instead lead “Reader adjustment is a comparison aid,” expose method/limitations, default to applicant/raw/adjusted/read count and expand source reviews. Spell recommendations. Preserve both raw and adjusted values and shared tied ranks; never auto-advance from this ranking.

**New:** Compact comparison and caveat copy; no new calibration math. **States:** Mobile uses applicant summary plus expandable reviews, with full table optional. Distinguish not frozen, frozen/no results, unavailable and insufficient comparison data where the algorithm reports it. Keyboard disclosures expose every value without hover.

**Dependency / acceptance:** Owner confirms authorized result visibility; numeric output matches current helper exactly, ties remain ties, unknown remains unknown and method copy makes no fairness guarantee.

### 9. Interview round index — P1 / S

**Sources:** `src/app/admin/rounds/page.tsx`, `rounds/coverage.ts`, `rounds/legacy-round-redirect.ts`; legacy `/admin/speed-dating`, `/admin/group-case`, `/admin/groups` pages redirect here/into rounds.

**Observed / existing:** Round rows show weight/status, staffing twice and submitted/assigned forms; screening links to its own workflow. Interview event list, scheduling and attendance export already live here.

**Hypothesis:** Submitted forms can be read as qualifying evidence despite existing explanatory copy.

**Before → after:** Open Interviews → choose a round; retain this structure, make “Assigned coverage,” “Submitted forms” and any authorized “Valid evidence” separate columns/labels. Place the next event above past events. Do not resurrect three legacy destination dashboards.

**New:** Clearer summary hierarchy; valid-evidence summary needs additional canonical query (M). **States:** Mobile rows retain denominator and weight; no rounds explains setup dependency, no events offers permitted scheduling. Failed evidence reads show unavailable. Entire row has one clear keyboard link.

**Dependency / acceptance:** Coverage/cohort helpers and permissions. Two partial submissions never appear as “two valid”; legacy bookmarks still resolve to the correct authorized cycle.

### 10. Round workspace and staffing — P1 / M

**Sources:** `src/app/admin/round-board.tsx`, `round-assignment-form.tsx`, `rush-controls.tsx`, `group-case-coverage.ts`, `rounds/coverage.ts`.

**Observed / existing:** Cohort-aware workload, evaluator load, undercoverage, assignment actions/removal of untouched assignments, Group Case evidence queue, results, groups and rubric. Speed Dating deliberately bypasses assignment-driven grading.

**Hypothesis:** Setup and live repair controls mixed with results force repeated scrolling; evaluator load is visible but difficult to act on in context.

**Before → after:** Scan all sections → find shortage → scroll to assign; instead anchor sections “Readiness / Staffing / Results / Setup,” default attention rows first, open assignment editor with the selected applicant prefilled, and show eligible evaluator load beside it. Never claim recommendations account for conflicts unless server-validated.

**New:** Contextual editor and anchors; optional assignment preview requires authoritative conflict filtering. **States:** Mobile labeled rows rather than dense grids; empty cohort and unstaffed cohort differ. Unavailable evidence stays unknown for operations-only roles. Keyboard can assign/remove untouched work without drag and returns to the row.

**Dependency / acceptance:** Existing cohort and conflict contracts. Recused/missed assignments do not fill coverage; no evaluator acquires evidence or edit rights from a staffing shortcut.

### 11. Rubric/scoring-guide editor — P0 preservation; P1 clarity / S

**Sources:** `rounds/rubric-editor.tsx`, `round-board.tsx`, recruitment policy.

**Observed / existing:** Criterion wording/key/weight/required controls, reorder buttons, validation, version context, pre-live DRAFT/PUBLISHED edit restrictions, private download and reload recovery when save is uncertain.

**Hypothesis:** Operator may confuse a criterion weight with the round's contribution to final score, or believe reload is safe without preserving wording.

**Before → after:** Edit technical fields → save; instead explain round weight separately, emphasize criterion name/description first, disclose stable key controls, and show version plus locked reason before disabled fields. Keep local recovery adjacent to uncertain save.

**New:** Information hierarchy/copy only; no scoring changes. **States:** Mobile criterion blocks wrap; empty rubric offers permitted add action. Invalid criteria retain all wording. Ambiguous save keeps repeat-save locked and offers private download/reload warning. Keyboard reorder retains focus on moved criterion; removal names the target.

**Dependency / acceptance:** Policy change control and current RPC lock. A live round cannot change weights/rubrics; required/N/O and weighted coverage semantics are unchanged; private backups are clearly labeled sensitive.

### 12. Close grading and round lifecycle — P0 preservation / S

**Sources:** `round-status-control.tsx`, `round-close-request.ts`, `src/lib/round-close-summary.ts`, `src/app/api/admin/round-close/route.ts`.

**Observed / existing:** Native modal reviews current valid/partial/open counts and timestamp, warns no transition back to open grading, allows closing with incomplete work, locks submitted work, distinguishes rejected/unknown writes and rechecks server state. This is already substantial safety functionality.

**Hypothesis:** Generic status select hides the meaning of freezing; a polished replacement could accidentally remove the important imperfect-coverage warning.

**Before → after:** Choose Frozen → modal; retain preflight and reconciliation, expose “Close grading…” as the phase action and place other transitions in secondary controls. Use same terms as coverage rows.

**New:** Action naming/composition only. **States:** Small-screen modal scrolls with reachable cancel/confirm; zero enrolled applicants is explicit. Unavailable preflight prevents confirmation. Unknown close offers “Check round status,” never a fresh close. Keyboard initially focuses safe cancel, supports safe dismissal and returns focus.

**Dependency / acceptance:** Existing close contract. Incomplete work remains visibly disclosed without inventing a new hard gate; a dropped response cannot cause duplicate close or reopen work.

### 13. Event scheduling, edits, cancellation and RSVP capacity — P1 / M

**Sources:** `events/new/page.tsx`, `events/new/event-form.tsx`, `events/[id]/event-controls.tsx`, `slot-form.tsx`, `events/[id]/page.tsx`.

**Observed / existing:** Event type/visibility/location, Detroit-time event and check-in windows, editable metadata/status, cancellation reason/confirmation, slot creation and capacity list. Creation surfaces a check-in token once. Event index is within Interviews.

**Hypothesis:** Four time fields plus event dates make a valid schedule hard to verify; capacity totals and slot detail require separate views.

**Before → after:** Fill dates → save → inspect; instead show a plain-language schedule summary (“Event…, Check-in… Eastern”) beside inputs, distinguish public/invite/internal consequences, then show slots with booked/capacity where authorized data exists. Separate event cancellation from ordinary save and explain RSVP history retention.

**New:** Derived time summary (S), per-slot RSVP counts (query extension, M). No automatic rescheduling or messaging. **States:** Mobile chronological fields; empty slots offers add action. Date errors target the field and retain all values; unknown creation must reconcile before recreate. Keyboard native date/select controls remain.

**Dependency / acceptance:** Detroit date conversion/DST validation and event APIs. Invalid intervals cannot save; public visibility never implies an invite was sent; cancellation does not silently delete RSVP history.

### 14. Check-in desk, QR rotation and attendance — P1 / M

**Sources:** `events/[id]/page.tsx`, `assisted-checkin-form.tsx`, `attendance-refresh.tsx`, `rotate-button.tsx`, assisted-checkin API.

**Observed / existing:** Assisted check-in, applicant/member counts, manual refresh, closed/cancelled lock and one-time raw token display on create/rotation. Partial attendance failures already warn counts may be stale.

**Hypothesis:** Staff arriving at the door need assisted lookup/receipt before configuration; rotation can be mistaken for harmless “show QR.”

**Before → after:** Open long event page → locate attendance; add a local “Check-in desk” view with window/status, lookup, result and refresh first. Put event configuration behind a separate section. Rotation explicitly explains replacement of the active code; retain one-time secret behavior and manual fallback.

**New:** Task view, not a second check-in backend or offline mode. **States:** Mobile prioritizes lookup and large actions; empty list says no check-ins only after a successful read. Duplicate/already checked-in is a receipt, not a generic failure. Network uncertainty says refresh/check record before another attempt. Keyboard search and result focus work without scanner.

**Dependency / acceptance:** Check-in/rotation contracts. A stale roster cannot masquerade as zero; attendance remains operational and never changes merit scores; rotation never exposes old tokens.

### 15. Event observations — P1 / S–M

**Sources:** `events/[id]/page.tsx`, `observation-summary.ts`, `grading-toggle.tsx`, `hash/page.tsx`.

**Observed / existing:** Member observation toggle, anonymous notes/top tags/counts for checked-in applicants; copy states observations do not affect score, readiness or rank. Hash also shows observation context.

**Hypothesis:** “Member grading” naming and proximity to quantitative results invite a scoring interpretation; count favors applicants who were more observed without proving quality.

**Before → after:** Enable grading → see observation count; instead consistently say “Event observations,” label count as coverage/context only and keep notes in a separate non-scoring evidence disclosure. Show data-unavailable independently of no observations.

**New:** Terminology/empty-error distinction; no new sentiment analysis or ranking. **States:** Mobile wraps notes/tags; empty and failed observations differ, including when attendance loaded. Toggle failure retains server-known state. Native disclosure, button labels and keyboard focus expose notes without hover.

**Dependency / acceptance:** Role/blind-review review of all observation paths. Observations never feed score/order/readiness; no new identity-bearing notes appear for blind viewers; counts cannot be mistaken for ratings.

### 16. Speed Dating results — P1 / M

**Sources:** `round-board.tsx`, `speed-dating-results.tsx`, `screening-rpc.ts`; `/admin/speed-dating` legacy redirect.

**Observed / existing:** Present members grade applicants they meet; raw stars and grader-adjusted results, grader counts/notes and export. Round assignment controls are intentionally non-assignable for this kind.

**Hypothesis:** Adjusted and raw stars can be mistaken for two independent rounds; “graded” may hide uneven observation counts.

**Before → after:** Read ranking → expand notes; make raw mean, adjusted comparison and number of graders adjacent with short method text. Offer low-observation filtering if canonical data supports it, explicitly descriptive rather than a new threshold/gate. Keep scoring eligibility separate from a row having any grade.

**New:** Display/filtering only; no mandatory evaluator assignment or new score. **States:** Mobile summary plus drilldown; no graders versus no eligible applicants differ. Failed results are unavailable, not zero stars. Keyboard sorting announces criterion/direction and notes are expandable.

**Dependency / acceptance:** Canonical result semantics and policy-approved interpretation. Export and UI agree on values/counts; adjustment is not described as a fairness guarantee or a change to 40% round contribution.

### 17. Group formation and prompts — P1 / M

**Sources:** `groups/group-forms.tsx`, `round-board.tsx`; legacy `/admin/groups` redirects to the Group Case round.

**Observed / existing:** Random formation of unplaced applicants in chosen team size, existing teams preserved, manual team/prompt creation, assign/remove and delete empty team; grading-count badges derive from observed evaluations when available.

**Hypothesis:** Repeated assignment selects and small Remove links make correction laborious; “N grading” can look like assigned staffing although it is derived from evaluations.

**Before → after:** Form teams → inspect each → adjust; add a pre-action summary of unplaced cohort/team size and an explicit receipt of created teams, then compact group rows with members, prompt disclosure and “Evaluators with recorded work.” Make move-between-groups an explicit reviewed action only if existing semantics support it; no drag-only roster.

**New:** Formation review (UI); deterministic preview of exact random teams would require a new server transaction, so defer. **States:** Mobile one group at a time; empty team and no unplaced applicants distinct. Failed formation retains team size and refreshes authoritative rosters. Keyboard assign/remove/delete targets are 44px and named.

**Dependency / acceptance:** Group mutation rules. Existing teams remain unchanged by formation; no person is silently dropped/duplicated; recorded-evaluator counts never imply two valid independent evaluations.

### 18. Group Case evidence, results and backups — P0 evidence distinction; P1 refinement / M

**Sources:** `group-case-coverage.ts`, `group-case-results.tsx`, `round-board.tsx`, `src/lib/group-case-results.ts`, export API.

**Observed / existing:** Attention-first staffing/evidence rows, valid independent evaluation semantics, results mean out of 40 with criterion evidence/notes and XLSX/CSV backup in permitted states. Source explicitly preserves partial observations as evidence.

**Hypothesis:** One page repeats coverage/results/assignments; unknown evidence for operations roles can look like missing work; backups can be mistaken for editable source of truth.

**Before → after:** Inspect coverage → find result/assignment elsewhere; link the attention row to the relevant assignment or authorized evidence detail. Present staffing, submitted work and qualifying evidence as three labeled facts. Label Excel as private backup/export, with generation scope/time, not a writeback tool.

**New:** Row-level navigation and export context; no spreadsheet import/correction workflow. **States:** Mobile summaries retain group and evidence reason; no cohort/no work/no permission/error differ. Export error leaves live data intact; keyboard can reach each source evaluation and download.

**Dependency / acceptance:** Canonical rubric/version/conflict validation. Two partial submissions stay incomplete; unknown access stays unknown; downloaded data and visible aggregates match for the authorized cohort, and submitted evidence cannot be edited through backup.

### 19. Referrals — P1 / S–M

**Sources:** `referrals/page.tsx`, `referral-status-form.tsx`, `pipeline-board.tsx`, referral API.

**Observed / existing:** NEW/REVIEWED/INVITED/PASSED queue ordered by attention, referrer identity/reason/contact, status updates and pipeline contextual entry.

**Hypothesis:** “Ready for outreach” and “Invited” statuses can be mistaken for evidence a message was delivered or an application exists.

**Before → after:** Read referral → change status; retain manual workflow, rename visible action around its actual record effect (“Mark outreach recorded” if accurate), show referral state separately from any verified message/application link. Add status filters before additional metrics.

**New:** Filter UI; application/message matching would need a new authorized lookup and must not guess identity by name. **States:** Mobile reason/contact expand within one row. No referrals and no filter matches differ. Save failure retains intended status; unknown update checks current record. Keyboard selects and mail links have specific labels.

**Dependency / acceptance:** Recruitment permission and identity-match rules. No referral gives merit advantage, changes an applicant outcome or claims delivery; referrer data never crosses blind evidence boundaries.

### 20. Hash stage votes — P0 policy reconciliation; P1 scope review / M

**Sources:** `hash/stage-hash-panel.tsx`, `hash/page.tsx`, `src/lib/hash-tally.ts`, rush/hash-result APIs; recruitment policy.

**Observed / existing:** Stage opening with quorum, eligible voter and ballot counts, 60% YES rule in copy, per-row/all-decided apply, close vote and server-recomputed tally. Applying stage votes changes pipeline state. Final vote application is a separate path. The draft policy leaves Hash meaning/panel roles/quorum unresolved.

**Hypothesis:** A generic confirm dialog insufficiently communicates which applicants are about to advance/reject; operational behavior may be mistaken for an approved governance rule.

**Before → after:** Apply all decided → generic confirm; add a reviewed cohort showing code/name as permitted, current stage, tally basis and exact resulting stage. Distinguish vote recording, application of stage result and applicant outcome release. Preserve present rules pending Board decision.

**New:** Reviewed cohort/snapshot safety requires server freshness validation if not already supported. **States:** Mobile lists each change; no ballot and votes-below-quorum differ. Stale stage/tally rejects and refreshes review; unknown apply reconciles rows. Keyboard review/cancel/focus return available.

**Dependency / acceptance:** Board reconciles policy with stage/final-vote implementation before any rule redesign. No UI edits alter 60%/quorum or add Hash points; applying a stage result cannot silently release an applicant outcome.

### 21. Hash deliberation presentation — P1 / M

**Sources:** `hash/deliberate/page.tsx`, `hash/deliberate/deliberation-deck.tsx`, live Hash API routes.

**Observed / existing:** Stage-aware deck, raw round results for stage discussion and weighted final score only at final vote, synced presenting applicant, blind PANEL-only props, reduced-motion/presentation controls, notes and decision context.

**Hypothesis:** Presenters can confuse local browsing with changing what everyone sees; sorted-by-score order can anchor a discussion without showing evidence incompleteness.

**Before → after:** Open deck → navigate/present; make “Viewing locally” versus “Presenting to room” explicit, keep applicant position/stage and evidence-completeness labels in the frame, provide a return-to-queue link. Preserve existing ordering until Board approves any alternative; no theatrical animations or podium treatment.

**New:** Sync-state/readiness explanation; no additional live collaboration system. **States:** Mobile readable single-applicant layout and explicit previous/next; no open stage points to permitted stage controls. Sync loss retains local reading and labels presentation unconfirmed. Keyboard shortcuts must ignore typing controls, support documented navigation, Escape/fullscreen exit and visible buttons.

**Dependency / acceptance:** Existing live endpoints and privacy filtering. Local movement does not secretly broadcast; blind server/client props stay protected, conflicts remain withheld and reduced motion exposes final content immediately.

### 22. Decision recommendation, approvals and offer response — P0 preservation; P1 composition / M

**Sources:** `decision-form.tsx`, `hash/page.tsx`, `applications/[id]/page.tsx`, `src/app/api/admin/decisions/route.ts`.

**Observed / existing:** Outcome/reason creation, approvals, communication preview, explicit release; offer deadline editor and applicant response timestamps. Hash also has member-vote outcome application whose copy says it records/locks. This must be reconciled with policy's two-distinct-approval default; do not infer equivalence from UI copy.

**Hypothesis:** Dossier and Hash present similar controls differently; “preview saved” may sound like communication sent, and lock routes need a single documented operator explanation.

**Before → after:** Find controls in expanded evidence → act; show a compact decision record: recommendation/reason, approval state, lock basis, saved communication preview, release state and offer response, each separately labeled. Put only next permitted action first; maintain two conflict-free distinct approvals and server checks.

**New:** Shared presentation role and documented lock provenance, possibly new read payload. **States:** Mobile chronological facts; absent decision differs from unauthorized access. Error retains reason/preview/deadline; unknown mutation reconciles before repeat. Keyboard confirmation and result focus name applicant/outcome.

**Dependency / acceptance:** Policy/engineering reconcile vote-driven locking before changing it. Self/duplicate/conflicted approvals cannot satisfy required quorum; preview save never sends; offer expiry/response is distinct from outcome release.

### 23. Single and batch outcome release — P0 preservation; P1 delivery handoff / S–M

**Sources:** `decision-form.tsx` (`ReleaseButton`, `ReleaseAllButton`), `src/lib/decision-release.ts`, decisions API.

**Observed / existing:** Single irreversible confirmation, unknown-result lock; batch preflight/snapshot, eligible/blocked cohort, filters explicitly view-only, partial result report and per-applicant evidence recovery links. Release receipt distinguishes queued notifications from applicant-visible release.

**Hypothesis:** Existing batch report's “Open delivery log” links to default Communications (compose) instead of delivery view; an operator can lose the repair context.

**Before → after:** Release → queued report → compose screen; link directly to `/admin/messages?view=delivery` with cycle, preserve released/skipped report and provide authorized reason-based repair links. Keep full reviewed cohort and visible/hidden scope explanation; never let filtering silently narrow the write.

**New:** Contextual handoff; notification correlation/filtering requires API extension. **States:** Mobile retains exact eligible count beside confirm. No locked outcomes is different from all blocked. Unknown write remains locked until authoritative new review. Keyboard focuses review/report; filtered empty never removes full-scope warning.

**Dependency / acceptance:** Snapshot and partial-release safeguards. Stale reviews are rejected; skipped decisions stay blocked; queued or failed email never changes released outcome to unreleased or reports delivered.

### 24. Release evidence diagnostics — P0 preservation; P1 discoverability / S

**Sources:** `applications/[id]/release-evidence/page.tsx`, `release-evidence/evidence-view.tsx`, `src/lib/release-evidence.ts`.

**Observed / existing:** RELEASE-only, noindex, application-matched diagnostics RPC, round/evidence report, reload and dossier navigation. Unavailable/malformed report confirms no readiness and keeps outcome blocked.

**Hypothesis:** Operators reach diagnostics only after a batch skip and may not understand whether a blocker is missing evidence, obsolete rubric, conflict or inaccessible detail.

**Before → after:** Failed release → generic blocker → inspect report; expose the existing diagnostic link at eligible authorized blocker points, group reasons by required round and identify a permissible repair destination. “Correction requires owner/policy process” is a valid next step; never offer direct evidence editing.

**New:** Discoverability and reason-to-route mapping. **States:** Mobile round-by-round lists, explicit no required round versus unavailable diagnostics. Errors remain fail-closed; keyboard heading/link order supports repair without scanning all evidence. No export of diagnostic identifiers by default.

**Dependency / acceptance:** Diagnostic reason contract and role/conflict tests. Report/applicant mismatch never renders readiness; conflict/private evidence cannot be exposed by reason links; reload alone never releases.

### 25. People directory and membership access — P1 / M

**Sources:** `people/page.tsx`, `people/people-workspace.tsx`, `people/directory.tsx`, `rush-controls.tsx`, `account-provisioning.tsx`, `member-accounts.ts`.

**Observed / existing:** Members may read directory; membership managers get access controls and incident link. Directory, onboarding and access views have different audiences, with duplicate account warnings and role grouping.

**Hypothesis:** Directory browsing and privileged access changes need different emphasis; role labels alone do not explain resulting capabilities or cycle scope.

**Before → after:** Find member → choose role action; retain single People destination, separate visible Directory / Onboarding / Access views by permission, and show current cycle + current roles + exact intended access change before mutation. Explain capability effects using existing authorization definitions; avoid a second custom permission editor.

**New:** Access-change review/copy. **States:** Mobile directory rows with expanded details; no directory entries differs from failed RPC. Preserve account values on failure; uncertain account creation routes to inspection before another create. Keyboard role controls and search must not depend on photo tiles.

**Dependency / acceptance:** Membership authorization/duplicate-account contracts. Ordinary members never receive access-control payloads; cross-cycle access is preserved; duplicate role rows cannot be mistaken for distinct evaluators or voters.

### 26. New-member onboarding — P1 / S–M

**Sources:** `people/onboarding.tsx`, `people/onboarding/route.ts`, `people/page.tsx`.

**Observed / existing:** Board/owner onboarding items include owner, completion time and completing person, grouped into People workspace. Needs owner / In progress / Complete filters, applicant summaries, progress and checklist expansion already exist. A failed onboarding read is already passed as a load error.

**Hypothesis:** Directory counts can hide operational handoff work; an offered/accepted applicant must not be assumed to have provisioned access or completed onboarding.

**Before → after:** Open People → onboarding tab → expand an applicant checklist; retain the existing filters and summaries, surface that applicant’s next unfinished item with its owner, and keep completion history accessible. Add a contextual handoff from verified offer response where authorized.

**New:** Next-item summary and handoff link; filters/checklist are existing. No autonomous account grant or celebratory completion gate. **States:** Mobile person-first checklist, empty no eligible onboarding versus all complete versus failed load. Failed completion keeps prior verified value and pending intent. Keyboard owner select/completion control announces exact item.

**Dependency / acceptance:** Actual onboarding eligibility rules, not pipeline label guesses. Accepted offer, created account and completed checklist remain separate; completion attribution persists and members cannot read board-only data.

### 27. Account setup incidents and provisioning recovery — P0 preservation; P1 navigation / S

**Sources:** `provisioning/page.tsx`, `provisioning/resolve-button.tsx`, provisioning API, `account-provisioning.tsx`.

**Observed / existing:** Membership-manager-only unresolved incidents, oldest-first pagination, phase-specific account/identity/membership guidance, uncertain provider IDs and cleanup flags. Resolution records completion; it does not repair accounts or email.

**Hypothesis:** Generic “Resolved” can imply an automatic repair or invite, and navigating between incident and People loses the account under inspection.

**Before → after:** Copy identifiers → find People → return → resolve; add safe contextual People search/link where supported, retain incident reference, and label “Record resolution after checking access.” Keep manual provider inspection instructions.

**New:** Context links; no one-click retry/cleanup or Clerk write integration. **States:** Mobile wraps IDs/email; no unresolved incidents differs from empty later page and load failure. Resolution pending/unknown cannot imply repair. Keyboard copy/reference and pagination controls are labeled and keep cycle.

**Dependency / acceptance:** Incident resolution permissions and authoritative account lookup. Retry cannot create duplicate identity based on absent provider ID; resolving incident never grants access, deletes other-cycle memberships or claims delivery.

### 28. Communications composition and history — P1 / M

**Sources:** `messages/page.tsx`, `messages/compose-form.tsx`, messages API.

**Observed / existing:** Compose/history/delivery subnavigation, status-based audience counts, subject/body editor and reviewed send flow; recent 50 message metadata records without stored message bodies. Failed log lookup currently logs the error and can render an empty history.

**Hypothesis:** Empty history after read failure can be mistaken for no sends; reviewed status counts may become stale before send.

**Before → after:** Choose status cohorts → review → send; retain review, show audience basis/cycle/exclusions and make send-time cohort behavior explicit. Add a visible history-unavailable state; label “Latest 50” and search/paginate only if operational need is validated. Do not imply archived bodies exist.

**New:** Error state (S); authoritative reviewed recipient snapshot needs contract confirmation or API work (M/L). **States:** Mobile audience checklist and preview in sequence; zero eligible recipients prevents send. Errors preserve subject/body; ambiguous send checks log rather than immediate repeat. Keyboard focus moves to preview/errors and returns to edit.

**Dependency / acceptance:** Recipient authorization and actual send semantics. Unreleased outcomes cannot leak via status audience/template; no failed log read says “Nothing sent”; send result reports verified delivered/failed/unknown scope accurately.

### 29. Automated notifications and delivery repair — P1 / M

**Sources:** `messages/page.tsx?view=delivery`, `notifications/page.tsx` (redirect), `notifications/retry-button.tsx`, notification API.

**Observed / existing:** MANAGE_CYCLE-only delivery view, terminal-failure queue, attempts/error category and retry, temporary automatic retries, recent 100 outbox rows. `/admin/notifications` redirects here with cycle.

**Hypothesis:** Legacy message “Delivered” and outbox “Sent” are different evidence levels; retry disappearance at attempt cap needs explanation.

**Before → after:** See failed row → retry; show failure category, attempt cap, last/next attempt and exactly what retry does. Put terminal attention first, then pending/sent history. Define provider acknowledgement versus actual delivery using the real backend contract; do not rename SENT to Delivered without evidence.

**New:** Status glossary and contextual filtering/correlation, if identifiers exist; no new notification provider. **States:** Mobile long recipients wrap; no failures differs from no outbox/error. Retry cap explains permitted escalation; unknown retry reconciles status before another request. Keyboard row result announcement avoids resetting the whole list.

**Dependency / acceptance:** Outbox state/idempotency contract. Retrying email never re-releases outcome or resubmits application; notification queued/sent/delivered stay distinct, with no secret transport errors exposed.

### 30. Cycle lifecycle, cloning and initial setup — P0 policy; P1 presentation / M

**Sources:** `settings/page.tsx`, `rush-controls.tsx` (`CycleControls`, `CloneCycleForm`), `setup-form.tsx`, `admin/page.tsx`, `src/lib/workflow.ts`; `/admin/login` redirects to `/login`.

**Observed / existing:** Zero-cycle setup screen, cycle status controls, permission-gated clone, workflow state governs access. Initial setup and ordinary recurring administration are separate source paths.

**Hypothesis:** Status terminology hides cross-workspace effects; cloning can be mistaken for copying people, submissions or historical approval.

**Before → after:** Choose state → save; show current state, next permitted transition and a concise impact list for applicants/reviewers/board, drawn from actual workflow rules. Clone review names exactly what copies and stays historical, derived from its RPC. Keep auth redirects, not a separate board sign-in system.

**New:** Transition/clone review; net-new persisted policy sign-off record is L and blocked on Board approval. **States:** Mobile ordered impact review; no cycles offers authorized setup only. Failed transition keeps prior known state; unknown write requires reload/check. Keyboard safe cancel and focus return.

**Dependency / acceptance:** Workflow transitions and policy approval. Live weights/rubrics/quorum cannot be changed through cycle controls; clone never presents prior policy approval as approval for the new cycle.

### 31. Cycle dates and intake question editor — P1 / M

**Sources:** `settings/cycle-window-form.tsx`, `settings/question-editor.tsx`, `settings/page.tsx`.

**Observed / existing:** Cycle opening/closing fields; typed intake questions, options/required/word limits; questions locked once submissions exist. Malformed question payload disables editing rather than replacing good data with empty questions.

**Hypothesis:** Date-window editing and intake schema editing are different-risk tasks buried among lifecycle and analytics; a disabled editor needs a clear reason.

**Before → after:** Scroll Settings → edit → save; separate “Application window” and “Application questions,” show Eastern-time summary/current effective state and applicant-facing preview of question text/types. State the submission lock before fields; do not add a workaround.

**New:** Read-only applicant preview and impact review; no per-applicant question variants. **States:** Mobile controls retain readable long prompts/options; empty configured set differs from invalid/unavailable payload. Errors retain edits; uncertain save offers private copy/current-version reconciliation where existing contracts support it. Keyboard reorder has named controls and preserves field focus.

**Dependency / acceptance:** Date validation, immutable submission snapshots and question RPC lock. New questions cannot overwrite submitted answers; failure never saves an empty schema; date copy agrees with Detroit timezone/DST behavior.

### 32. Recruitment analytics — P2 / S

**Sources:** `settings/recruitment-analytics-panel.tsx`, `settings/recruitment-analytics.ts`, `settings/page.tsx`.

**Observed / existing:** An already-collapsed post-cycle Settings panel shows funnel, round completion, reviewer workload buckets/median, criterion means/spreads and aggregate reviewer consistency/drift. It unlocks after cycle close; minimum-cohort suppression and unavailable/malformed states protect data. This is an existing feature, not a proposed analytics platform.

**Hypothesis:** Operators may overinterpret “high variance” or first/second-half drift without knowing sample size, thresholds or changing case mix; these signals cannot establish individual reviewer quality.

**Before → after:** Settings → expand existing post-cycle analytics → interpret aggregates; retain that disclosure and its advisory wording, add concise metric definitions, comparison basis and threshold explanations for workload/consistency/drift. Keep small numbers in labeled rows, distinguish observed cohort description from causal explanation. Do not add live rankings, funnel optimization claims, demographic merit ranking or invented comparisons.

**New:** Presentation/caption edits only. **States:** Mobile labeled rows; no measured data versus unavailable distinct. Retry refreshes source without changing settings. Keyboard disclosure/table access and text alternatives retain all figures.

**Dependency / acceptance:** Verify actual RPC denominators, suppression thresholds and authorized aggregation before altering labels. Totals reconcile with defined cohort; absent fields never become zero; small-cohort suppression survives every drilldown; no signal identifies individual reviewers or uses attendance to score merit.

### 33. Client project records and staffing — P1 / M

**Sources:** `projects/page.tsx`, `projects/project-editor.tsx`, `src/app/api/admin/projects/route.ts`.

**Observed / existing:** Organization-wide BOARD/OWNER project editing: title/client/semester, question/decision/context/handoff, methods/deliverables/constraints/member work, ordering and separate staffing save. Staff candidates come from selected cycle while projects are not cycle-scoped. Project selector uses many pill buttons; switching remounts editor.

**Hypothesis:** Switching projects can discard unsaved fields, and selected-cycle staffing options may obscure existing contributors from other cycles.

**Before → after:** Choose pill → edit long form → save project/staffing separately; show searchable project list, explicit organization-wide context and distinct “Save project details” / “Save staffing” receipts. Warn on dirty project switch and retain working copy. Show existing staff even if absent from current-cycle candidates, subject to authorization.

**New:** Dirty-state handling and broader verified staffing display; no project management suite. **States:** Mobile project select then labeled sections; no projects offers private draft creation. Error preserves all fields/staff choices; unknown write rechecks before duplicate create. Keyboard switch/save works without dragging.

**Dependency / acceptance:** Organization authorization and staffing RPC rules. Cycle switch never hides/removes historical staff on save; saving staffing never publishes content; project details remain source-backed with no fabricated client outcomes.

### 34. Project publication and approval evidence — P0 before publication redesign / M–L

**Sources:** `projects/project-editor.tsx` public checkbox and copy, `src/lib/projects/public-projects.ts`, `src/content/projects.public.ts`, `supabase/migrations/20260901080000_projects_and_staffing.sql`, PRODUCT publication boundary.

**Observed / existing:** Public checkbox is saved with project; public RPC returns public rows. Public loader also uses reviewed `PUBLIC_PROJECTS` fallback on failed **or empty** results. Editor says nothing reaches public site otherwise; that copy does not explain fallback. Existing editor has no visible client-approval evidence record.

**Hypothesis:** Checking visibility is mistaken for proving client consent, or unchecking all records is mistaken for removing fallback content.

**Before → after:** Tick “Show on public Work page” → Save; require a separate reviewed publication action showing the exact public fields, approval source/status and fallback/public-route behavior. First correct explanatory copy; persistent approval provenance/revision binding is **new**, not an existing gate. Plan approval artifact/version model with owner before implementing.

**New:** Read-only public projection preview (M); durable approval provenance and reapproval for changed content (L). **States:** Mobile full preview before confirmation. No approved evidence keeps publication blocked in the proposed flow; failed approval lookup is unknown, not approval. Keyboard review/cancel focus return; ambiguous publish reconciles all public surfaces.

**Dependency / acceptance:** Real client approval, reviewed public release boundary, fallback ownership and publication tests. Private fields never enter public projection; publication copy matches actual fallback behavior; preview/save cannot fabricate approval, and unpublish behavior is verified for pages and metadata before promising removal.

### 35. Activity and audit — P1 / M

**Sources:** `audit/page.tsx`, dossier History, audit RLS documented in that page.

**Observed / existing:** Cycle-scoped immutable event list, 100-row pagination, actor name lookup, resource filters built from resources present on the current page, metadata disclosure and policy-limited visibility. Dossier history separately warns on unavailable audit reads.

**Hypothesis:** Current-page-derived filters disappear when paging or filtering, making absence look like no activity of a type; raw metadata is difficult to use for a repair.

**Before → after:** Pick resource → inspect raw entries; retain immutable log, use a stable authorized resource vocabulary or authorized facet query, preserve filter/cycle/page, and make safe entity links from known resource types. Show plain action, actor, time and before/after metadata only when recorded; never synthesize audit evidence from UI state.

**New:** Stable filters and typed entity links; no editable timeline or broad audit export. **States:** Mobile labeled timeline rows; zero events, no matches, restricted visibility and load failure differ. Actor lookup failure keeps record with unknown actor. Keyboard metadata disclosures and paging preserve context.

**Dependency / acceptance:** Resource-specific RLS/conflicts and safe route mapping. Filters remain available across pages; unauthorized resources/actors never leak through facet counts, links or metadata; records remain immutable.

## Priority and dependency sequence

1. **P0 preservation and policy reconciliation:** carry permissions/conflicts/blind evidence, immutable work, reviewed advancement/release scopes, ambiguous-write recovery and authoritative counts into every design. Reconcile draft policy with stage/final Hash locking and review operational accessibility-note exposure. Resolve real publication approval/fallback behavior before any new publishing action. These are discovery/acceptance gates, not authorization to change governance.
2. **P1 first implementation slice:** overview labels/queues, contextual navigation, dossier next action, delivery handoff/error states and consistent state receipts. Mostly existing capability, S–M; validate task clarity before adding persistent workflows.
3. **P1 second slice:** round phase anchors, contextual staffing, check-in desk, screening phase focus and compact raw/adjusted comparisons. Depends on canonical evidence/cohort queries and role-specific fixtures. Do not combine staffing and evidence into one completion percentage.
4. **P1 third slice:** People/onboarding handoffs, incident context, schedule/question previews, project dirty-state and audit filtering. New backend work stays limited to demonstrated missing read contracts.
5. **P2 / defer:** persistent work ownership for every blocker, exact random-group preview transactions, new analytics/charts, global search, notification automation, full project-management boards, AI applicant scoring/summaries, spreadsheet writeback and cosmetic achievement systems. None is necessary to make today's core tasks legible. Net-new retention/correction/exception workflows wait for approved policy, not just UI design.

## Review and implementation acceptance packet

Use explicitly synthetic difficult fixtures: zero cycle; closed historical cycle; current and cross-cycle roles; PANEL-only viewer; committee enrolled as screening reader; declared conflict and failed conflict read; partial evaluations; outdated rubric; two qualifying independent evaluations; wide spread; empty versus unavailable rankings; no event slots; full slot; stale attendance; duplicated check-in; dropped create/close/release acknowledgement; partial batch release; released outcome with failed email; accepted offer without account access; uncertain provisioning provider outcome; project with unlisted historic staff; private/public/fallback publication states; audit lookup failure. Fixtures are test cases, not claimed observations of real users.

For each proposed slice, parent/implementation owner should verify 320/390px and desktop, long content/zoom, keyboard-only operation, focus visibility/return, screen-reader names/results, reduced motion, and server payload privacy. Reuse relevant existing tests such as `tests/e2e/operator-close.spec.ts`, `operator-review.spec.ts`, `operator-write-receipts.spec.ts`, `release-reliability.spec.ts`, `release-evidence.spec.ts`, `screening-cas.spec.ts`, `provisioning-recovery.spec.ts`, `deck-accessibility.spec.ts` and `deck-touch-targets.spec.ts`; their presence is not a claim they passed in this review.

Ask actual operators to complete representative tasks: find and repair one coverage gap; explain why one applicant is blocked; close grading while acknowledging unfinished work; review the exact release cohort; distinguish a released outcome from failed email; locate an uncertain account incident; demonstrate what a project publication would expose. Record observed errors/hesitations and unresolved policy questions. Do not promise measurable improvement before that evidence exists.

**Review receipt:** Source-only planning audit against the current, already-modified working tree. Read all admin page entry points, navigation, major operational child components, product/design/policy documents and referenced contracts. No browser, build, tests, real records, production services, accessibility conformance, operator acceptance or client approvals were exercised/established. Only this assigned Markdown deliverable was written by this task; existing application/document changes were left intact.
