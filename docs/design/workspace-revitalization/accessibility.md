# Inclusive usability review — workspace revitalization

Planning brief, October 17, 2026. Scope: applicant, member and board interaction foundations, with emphasis on keyboard/focus, large text, assistive technology, live scoring and interrupted work. This is a source review, not a full accessibility audit or a claim of conformance. No browser, screen reader, contrast measurement, performance profiling or tests were run for this brief. Existing test files cited below describe coverage, not results from this review.

Read: `AGENTS.md`, `docs/PRODUCT.md`, current rules at the top of `docs/DESIGN.md`, `/home/rahil/.agents/design-routing.md`, and the design-system-workflow skill and its craft/review reference. TypeScript reading guidance was also consulted. Existing uncommitted work was treated as the current source snapshot; implementation owners should recheck anchors against their final changes.

## Direction and boundaries

Keep the bold blue/orange personality and compact, task-first private Operate UI. Inclusive usability should make the next action, its prerequisites and its confirmed result easier to understand. It does not require a new visual identity, decorative progress dashboards, an accessibility preferences center or extra onboarding before work.

Use the existing system sans stack, four-pixel spacing rhythm, 8px controls, 12px panels and the requested 44px targets. The source still defines 36px/40px compact desktop controls and upgrades many controls on narrow/coarse-pointer screens (`src/app/workspace.css`, control tokens and final responsive overrides). This is a documented implementation tension with this brief's 44px target requirement, not evidence that every rendered control is undersized. Resolve centrally; do not append another per-screen sizing layer. A control may look compact while retaining a sufficiently large, non-overlapping activation area.

Preserve `docs/PRODUCT.md` and `docs/policies/recruitment-policy.md`: role and conflict checks, blind identity boundaries, scoring weights, quorum, immutable submissions and explicit release. Accessibility labels, downloads, announcements and alternate layouts must use only data authorized for that route. Saved draft, submitted/locked evaluation, released outcome and delivered notification are separate facts. Never infer one from another or use a generic “Complete” receipt for all four.

Hypotheses below are design propositions to test, not findings from user research. Anxious or distracted applicants and time-pressured board members are task scenarios, not observed participant groups.

## Existing foundations worth extending

- `src/components/form-field.tsx` associates label, hint and error IDs; supports `aria-invalid` and native required state. `src/components/operation-notice.tsx` supplies alert/status semantics. Extend these contracts before inventing another field pattern.
- `/apply`: `src/app/apply/application-form.tsx` already moves focus to invalid fields and step headings, names consent/submission guidance, and distinguishes saving from submission. Recovery explicitly compares copies. `tests/e2e/application-keyboard.spec.ts` contains sequential native keyboard validation/recovery/consent coverage with intercepted boundaries. Do not replace this flow with a cosmetic wizard that loses those behaviors.
- `/member?assignment=…`: `src/app/member/evaluation-form.tsx` uses native radios, criterion fieldsets/legends, observed-evidence readiness, a focused pre-lock review, focus return and a submitted-and-locked receipt. Its conflict/private-backup states are existing capabilities, not proposed features.
- `/member/screening/[assignmentId]`: `screening-reading-desk.tsx` implements arrow/Home/End tab navigation on narrow layouts and lazy-loads the authorized resume iframe in `page.tsx`. `/member/group-case` already focuses recovery headings and returns focus to expanded row toggles.
- `/member/speed-dating` and `/member/group-case`: roster score buttons have `size-11`, descriptive score anchors, `aria-pressed`, named groups, search labels and live save feedback. Frozen/read-only state is explicit. These are useful live-event foundations.
- `/admin`: `pipeline-board.tsx` already has a list view, selected/hidden counts, exact advancement review, cancel focus return and result focus. `round-board.tsx` already provides narrow-screen assignment cards and a named, keyboard-focusable desktop scroll region. Preserve these safeguards and reuse their successful patterns.
- `globals.css` includes focus styles and reduced-motion overrides; `workspace.css` gives brand-band links white focus. `applicant/status-refresh.tsx` gates polling by visibility/online/action state and keeps a persistent announcement node for outcome branch changes. Avoid rebuilding these systems independently.

## Prioritized recommendations

### A1 — P0: Make focus continuity a shared task contract

**Source observations.** `workspace-header.tsx` puts the skip link in the header; `workspace-nav.tsx` renders its target as a focusable, visually hidden span after the sidebar. `/admin` and `/member` render header before nav in source order, while narrow CSS gives the sidebar `order: -1`. `workspace-sidebar.tsx` already exposes expanded/controls state and Escape focus return; its menu is an inline disclosure, not a modal. `applicant/schedule-action.tsx` replaces the activating button with an inline confirmation and has no explicit focus transfer or restoration.

**Proposed refinement.** Define one consistent DOM/visual reading order and a stable, meaningful content focus destination. Preserve the inline mobile menu model; do not add a modal trap unless the design actually becomes modal. Give booking confirmation a named region, contextual confirmation action (“Confirm time change” with the selected time available), focus entry and cancel return. After a server refresh, preserve a stable result destination rather than focusing a removed control.

**Hypothesis.** A predictable transition from action → confirmation → result reduces the need to rediscover location after navigation or an interrupted booking change.

**Dependencies.** Shared shell owner, applicant scheduling owner; verify existing route/cycle preservation and action-pending polling gate. No API or permission expansion.

**Acceptance scenarios.** Keyboard-only at desktop and 320 CSS px: skip bypasses repeated navigation and lands at the work; Tab order follows the visible sequence; closed menu links are absent from the focus order; Escape returns to Menu. Open, cancel and confirm a booking change with keyboard and screen reader: confirmation identifies the booking, cancel returns to its trigger, success announces only a server-confirmed change, failure preserves context. Reflow/refresh never strands focus on `body` after a removed trigger. Validate actual behavior before calling the current skip link broken.

### A2 — P0: Make live scoring understandable without star color or excessive tab stops

**Source observations.** Both roster components use five independent pressed buttons per score. Filled stars accumulate through the chosen score, while only the exact score is pressed. Group Case's `Clear` is an inline text button with no explicit target dimensions; rubric details use native `summary`, containing a 24px question-mark span. Group Case renders row status both in the collapsed header and the expanded body, each with a polite live region. Speed Dating initially focuses search on non-coarse pointers and registers `/` globally outside input/textarea elements.

**Proposed refinement.** Keep anchors and existing score meanings. Show an explicit selected numeric value/anchor beside stars, including a visible “Not observed” state; do not confuse no observation with zero. Provide Clear as a 44px action with criterion context. Size the full rubric summary as a 44px disclosure instead of making the question-mark span a second control. Evaluate a native radio group with one tab stop and arrow selection against the current five-button pattern; Group Case must retain explicit clearing. Choose one shared pattern after testing, without changing scoring or when writes occur. Scope `/` to non-editable, unmodified key input, expose a shortcut-off mechanism, and consider removing automatic search focus if it skips task context in assistive-technology testing.

**Hypothesis.** A visible selected value and fewer repeated stops will make repeated live ratings easier to verify. This does not establish faster completion until tested.

**Dependencies.** Rubric/domain owner confirms anchors and clear semantics; member specialist; A3 for receipts. No change to weights, frozen-round enforcement, conflict rules, evidence requirements or immutable evaluation submission.

**Acceptance scenarios.** Keyboard and screen reader can identify applicant (candidate code in blind contexts), criterion, selected value and anchor; change one score; clear only where allowed; and distinguish unobserved from low score. With coarse pointer and 200% text, score, Clear and rubric disclosure targets are at least 44×44 CSS px and do not overlap. Five-star visual fill never serves as the sole selected indicator. Frozen/permission-refused writes remain refused after any new interaction pattern. `/` in a contenteditable field, select, or modified shortcut never unexpectedly steals focus.

### A3 — P0: Announce confirmed state once, with the correct object and uncertainty

**Source observations.** `operation-notice.tsx` differentiates error and status. Group Case has duplicate live status locations for an expanded row. Speed Dating has a live progress total and live status per row; progress counts local non-null scores, while save success requires `savedAt` from the response. Applicant refresh reports checks and has a separate persistent announcement node. `evaluation-form.tsx` distinguishes draft save, recovery, local backup and final lock.

**Proposed refinement.** Adopt a small reusable announcement policy: local choice remains visible immediately; announce concise, contextual server acknowledgement (“Rating saved for [authorized identifier]”); announce failures/unknown outcomes once with the recovery action. Keep essential errors inline until resolved. Avoid narrating each saving pulse, character count and unchanged polling result. Preserve visible per-row status even if a shared live announcer handles speech. A submitted evaluation receipt must say locked; release receipts and email delivery receipts must remain distinct.

**Hypothesis.** Fewer competing announcements will leave scoring anchors and recovery instructions audible during fast work.

**Dependencies.** Existing save/revision/receipt state machines remain authoritative; do not simplify them into booleans. Applicant, member and board owners agree on vocabulary. Reuse `src/lib/evaluation-submission.ts`, `src/lib/application-submission.ts` and release reasons from `src/lib/decision-release.ts` where applicable.

**Acceptance scenarios.** Simulate two rapid ratings, delayed/reversed replies, failed save, unconfirmed timeout, draft conflict and round freeze. Visible and spoken receipts name the correct authorized item; no stale response announces success for a newer edit; locally selected progress is not presented as confirmed saved progress. Expanded Group Case rows do not speak duplicate receipts. Polling does not interrupt consent/booking confirmation. A released outcome with delivery failure is described as released with notification needing attention, never unreleased or delivered. Inspect accessible names/live DOM for identity leakage using a synthetic blind-review fixture.

### A4 — P1: Reflow the work, preserve comparative evidence

**Source observations.** `/admin/screening` has a horizontally overflowing table with Rank, reviewer columns, Average, “Z” and abbreviated recommendation counts; its wrapper already uses a named, focusable scroll region (“Screening ranking”), as does `round-board.tsx`. Pipeline contact/major text uses `truncate`; applicant identity and Open file are separate links, with repeated generic Open file labels. The reading desk has a desktop nested scroller with a viewport-based maximum height and sticky panels. Resume preview has a fixed 560px height plus a new-tab fallback. Workspace text roles are mostly absolute px values; browser zoom and text-only enlargement need separate checks.

**Proposed refinement.** Preserve the existing named focusable scroll-region pattern and use it on any new comparative tables; add a table caption and explicit row/column associations, expand “Z” and recommendation shorthand in accessible descriptions, and keep paired numeric columns comparable. On narrow screens prioritize identifier, actionable status and one contextual Open file link; retain an accessible full-detail route/table rather than silently dropping review evidence. Expose truncated contact/major as wrapped text or a keyboard/touch disclosure when needed for the current task. Let sticky/nested panes return to normal document flow at short viewport heights or large text. Keep the authorized PDF fallback readily reachable and labeled as a PDF/new tab.

**Hypothesis.** A short actionable summary plus reachable full evidence will reduce scanning burden without hiding ranking context or quorum gaps.

**Dependencies.** Board specialist owns which evidence is essential for each decision; do not redesign rankings or add charts. Shared shell/layout owner checks sizing rather than reducing type. Existing protected resume endpoint remains the only fallback source; no public OCR/transcription service.

**Acceptance scenarios.** At 320 CSS px and 400% desktop zoom, page chrome and forms reflow without page-wide horizontal scrolling; a genuinely two-dimensional data table may retain a named local scroller. Keyboard users can enter/exit and scroll it, hear headers and identify a row. At 200% text-only enlargement and increased text spacing, controls grow, notes remain visible and no action is clipped under sticky UI. Screen-reader link lists distinguish Open file actions using authorized identifiers. Read/scoring tabs preserve answers and score state across breakpoint changes. PDF failure still permits the authorized fallback; do not claim an untagged uploaded PDF is accessible because an iframe has a title.

### A5 — P1: Standardize recoverable forms and contextual errors

**Source observations.** Shared `FormField` already connects errors/hints. Application intake has richer focus recovery and step validation; many domain forms are bespoke. Scheduling's alert is present but confirmation controls are generically named. Native evaluation radios and explicit pre-lock review provide an existing reusable model.

**Proposed refinement.** Define a field contract for input, select, textarea and grouped choices: persistent visible label; required/optional meaning; connected format hint and error; invalid state; retained input after failure. For multi-error forms, provide a short linked error summary and focus it or the first invalid field consistently. Explain prerequisites beside disabled primary actions. Keep final consent fresh after conflict resolution and preserve the exact pre-lock review; do not introduce extra confirmation steps for ordinary draft saves.

**Hypothesis.** Local, actionable errors will help a distracted applicant recover without rereading the whole form.

**Dependencies.** A1 focus conventions; shared field primitives; existing validation and revision checks. No relaxation of file constraints, consent, evidence minimums or server authorization.

**Acceptance scenarios.** Submit with multiple missing/invalid fields: hear field name and corrective instruction, reach each error via keyboard, fix one without losing others. Test upload rejection, expired session, denied write, server conflict and retry; entered content survives where recovery is supported and no unconfirmed upload is labeled attached. Required-only and optional-only instructions remain understandable without color. Mobile keyboard does not cover the active error/action; password managers and native select/radio behavior remain usable.

### A6 — P1: Audit semantic colors and focus against actual surfaces

**Source observations.** Current design rules require white focus on deeper blue and orange ink on light backgrounds. Global focus selectors cover button/link/input/select/textarea, while native summary relies on browser/default or other styles. Roster stars use amber fill and navy/30 outlines; several secondary text styles still use navy/50 or /55. These are risk candidates, not measured contrast failures in this review. Later shared CSS overrides earlier component classes, so source class names alone cannot establish computed contrast/size.

**Proposed refinement.** Measure computed pairs for the actual selected, disabled, error and focused states. Centralize semantic text/focus/selected roles; include summary and keyboard-focusable scroll regions explicitly. Keep orange attention coupled to words/counts and selection coupled to both text/state and shape. Preserve blue primary actions, white brand-band focus and the existing typeface. Do not replace the palette to solve isolated pairs.

**Dependencies.** Shared token owner; current top-level DESIGN rules win over historical color claims. Contrast measurement belongs to implementation verification.

**Acceptance scenarios.** Normal text meets 4.5:1, qualifying large text 3:1, and required control/selection/focus indicators meet 3:1 against adjacent colors. Check actual backgrounds and opacity compositing, including selected blue, orange actions, error panels and dark surfaces. Keyboard focus is visible and unobscured on every interactive element; forced-colors mode preserves discernible controls and selection. Disabled information remains understandable even where contrast rules exempt inactive controls.

### A7 — P2: Keep motion and runtime cost subordinate to live work

**Source observations.** `globals.css` already caps animation/transition under reduced motion and disables presentation motion explicitly. Roster search filters local applicants; stars/notes patch row state; Speed Dating notes debounce at 800ms and keep server-confirmed state separately. Applicant refresh is gated and polls every 60 seconds. These are existing strategies, not performance measurements.

**Proposed refinement.** Retain immediate workspace rendering and static real counts. Test the existing implementation with representative synthetic roster sizes and long notes before adding virtualization, a motion library or optimistic “completed” badges. Prefer bounded rendering and stable keyed controls; virtualization is conditional on measured need and must preserve focused edits, search position and screen-reader row access. Do not remove recovery/status payloads to make the UI look faster. Do not add an offline queue without a separate data/privacy/concurrency design.

**Dependencies.** Baseline profiling on the parent-owned browser/device; backend/live-state owner for any refresh optimization. No arbitrary speed or conversion claims.

**Acceptance scenarios.** Reduced-motion mode shows every final state immediately without animated scoring/progress entrances. Under slow network and CPU throttling, typing remains usable, focus and caret stay on the edited row, pending work is distinguishable from confirmed work, and an old reply cannot overwrite a newer acknowledged edit. Test leaving before a debounced note saves; the UI must expose the actual loss/recovery behavior rather than claiming offline protection. Record roster size/device/network and measured outcomes before choosing further optimization.

## Reusable implementation package and sequence

1. **First, stabilize task contracts (A1/A3).** One content focus destination; one receipt vocabulary; contextual announce/focus rules. Build on existing shared components and domain state machines. This is refinement of existing capabilities.
2. **Next, strengthen live controls and forms (A2/A5/A6).** Shared 44px activation areas, score selection/clearing, rubric disclosure, field/error bindings and surface-aware focus. Native radio conversion and shortcut disable control are proposed changes, not current capabilities.
3. **Then, prove difficult layouts (A4).** Reuse current list/card/scroll patterns; verify full evidence access and large text. Avoid a separate “accessible version” that becomes stale or bypasses permission checks.
4. **Finally, optimize only measured costs (A7).** Keep motion reduction and current refresh gates; any virtualization or new queue requires evidence and a separate review.

Defer bloat: no global accessibility settings dashboard, compulsory tutorial, AI score helper, color-only urgency meter, automatic score completion, persistent applicant identity in blind route breadcrumbs, or extra delivery success claims. A future accommodation/help entry point can be considered by the applicant specialist, but collecting more sensitive information requires a defined audience and permission boundary first.

## Verification handoff

Parent owns browser inspection. Recommended representative fixtures: application conflict plus invalid upload; applicant booking confirmation plus newly released outcome; blind screening with long responses and unavailable PDF; Group Case expanded row with pending save/conflict; Speed Dating with rapid taps/slow replies; board table with many reviewer columns; advancement with hidden selected applicants and partial failure. All names/data should be explicitly synthetic.

For each implemented feature, record route, content fixture, viewport/zoom/text size, keyboard path, assistive technology/browser combination, actual receipt and unresolved defects. Include keyboard-only desktop; 320px reflow; 200% text-only enlargement; 400% zoom; coarse-pointer targets; reduced motion; forced colors; and one real screen-reader pass, expanding to platform combinations the team intends to support. Source review and automated checks complement these exercises; neither establishes full accessibility conformance or real-user usability. Existing tests such as `application-keyboard.spec.ts`, `group-case-navigation.spec.ts`, `group-case-revisions.spec.ts`, `evaluation-cas.spec.ts`, `operator-write-receipts.spec.ts` and `release-reliability.spec.ts` are useful starting points whose exact scenarios and current results must be checked by the implementation owner.
