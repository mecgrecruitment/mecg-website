# Private workspace visual contract

Planning handoff · 17 October 2026 · source inspection only

## Recommendation and authority

Make MECG feel like a working engineering studio through clear blue actions, orange attention cues, readable evidence and decisive rows. Keep the private Operate interface focused on the current task. The memorable detail is an **action edge**: a 4px orange left rule on the single next task or highest-priority exception, paired with a specific verb. It extends the existing first-member-task treatment rather than adding a new visual identity.

Authority: [PRODUCT](../../PRODUCT.md), the **current rules at the top** of [DESIGN](../../DESIGN.md), repository AGENTS.md, `/home/rahil/.agents/design-routing.md`, and the design-system-workflow skill and its craft-and-review reference. Current blue/orange identity, 240px sidebar, 8px controls and 12px panels supersede historical gray/orange navigation, 232px sidebar, 2px buttons and outer-card exceptions. Explicit task instruction makes 44px interactive targets the default throughout this proposed revision; existing 36/40px desktop controls are observed implementation, not the new target.

This document changes no application code, policy, permissions or scoring. No browser, screenshot or real-user study informed it. “Bulky” explanations below are code-based hypotheses about hierarchy, not claims of observed usability failure. All suggested additions are labeled; existing workflows should not be sold as new features. Role specialists own detailed applicant/member feature planning; this contract supplies their shared presentation layer.

## Source-observed baseline and friction hypotheses

1. **The foundation already exists.** `src/app/workspace.css:1–40` defines the four-pixel spacing scale, type roles, 240px sidebar, cool paper, white controls and geometry. Its sidebar/page-header rules and `src/components/workspace-header.tsx` already provide a compact shell. `src/app/admin/page.tsx:124` composes Recruitment as metrics, applicant list, attention queues and calendar; this is the right starting shape, not a dashboard to discard.
2. **App identity is partly dependent on DOM structure.** `workspace.css:935–1071` scopes shared control and panel treatments to a workspace *with a sidebar*, applicant shell or application editor. The reader at `src/app/member/screening/[assignmentId]/page.tsx:21–82` has `workspace-stack` but no `WorkspaceNav`/sidebar. It therefore does not match that shared scope. Hypothesis: moving between queue and reader can feel like moving between visual generations. Use an explicit private-workspace scope independent of navigation presence.
3. **Legacy surfaces remain alongside corrective overrides.** `globals.css:167` supplies `.surface-card` with 28px corners and a 24px/80px drop shadow; `:234–269` supplies generic workspace spacing, tinted fixed background and section rules. `FormField` still authors 48px minimum input height, 12px corners and layered shadows; `SegmentedControl` authors 12px buttons, inset shadows and scale press. `workspace.css` corrects many values in the recognized scopes. Hypothesis: similar component markup can behave differently by route, and another local patch would deepen that drift. Do not claim all these legacy declarations remain visible after the cascade.
4. **Applicant hierarchy spends several regions saying related things.** `src/app/applicant/page.tsx:310–405` renders a status heading/stepper, conditional receipt, next-action section, timeline and expanded application disclosure. `workspace.css:700–749` already removes direct-child shadows and standardizes panels. Remaining hypothesis: repeated status statements and separate bordered groups compete with the next action, even after the geometry fix. Consolidate information hierarchy before shrinking text or padding.
5. **The reader is structurally capable but visually heavy in source.** The reading page has a custom 30/34px title, uppercase response labels, a tinted answer enclosure and 560px resume iframe. `screening-reading-desk.tsx` already supplies responsive Read/Score tabs and sticky desktop scoring; keep that behavior. The form at `screening-review-form.tsx:302–464` stacks conflict handling, recusal, progress, boxed criteria, save acknowledgements, backup notices and final summary. Hypothesis: repeated framing makes recovery and routine scoring look equally prominent. Keep every safeguard but use state-dependent prominence and shared sections.
6. **Shared state components encode appearance more than meaning.** `src/components/status-pill.tsx` exposes orange/navy/neutral; `operation-notice.tsx` exposes error/success/info and authors its own inset-shadow colors. Hypothesis: teams can use the same tone for unrelated workflow states. Add semantic presentation roles without pretending a color determines domain state.
7. **Public personality already has a boundary.** `src/app/studio.css` contains public hero/photo/process treatments plus the member community image role. Keep its useful white-on-blue focus rule and secondary community photograph. Its large hero composition is not a template for review or operations screens. The new contract does not import public scene or hero geometry into Operate.

## Visual contract: retain values, make ownership explicit

### Color and state

Retain the existing tokens: blue `#254f9f` for active navigation and primary action; navy `#070d1f` for readable ink; orange `#fe904d` for the action edge, attention markers and dark-surface accents; orange ink `#a83e0b` for attention text on light surfaces. Canvas `#f5f8fd`, surface white, secondary text `#52627c`, rule `#d8e1ed`, selected surface `#e5edfc`. Source: current DESIGN rules, `globals.css:4–40`, `workspace.css:1–40`. No new font or palette.

**Proposed semantic aliases**, centralized in workspace.css rather than route-local hex values:

- Action/selected: alias MECG blue and selected surface. Blue buttons have white labels. Selected navigation uses the tinted surface, blue text and `aria-current`; label and marker supplement color.
- Attention: orange ink on a restrained orange tint derived centrally from existing orange. Always give the reason and next step. Orange is not a generic “in progress” paint.
- Danger/invalid: alias existing `--workspace-danger` / `--workspace-danger-surface` (`#b91c1c` / `#fef2f2`). Pair with explicit field error or operation failure; do not make a rejected applicant outcome look like a validation error.
- Confirmed success: consolidate the existing emerald notice family centrally. Use only for an acknowledged save/action with its exact scope. The existing `OperationNotice` uses emerald-50/900; preserve those resolved values initially, then verify contrast on real rendered pairs.
- Neutral/unavailable: secondary text on white/canvas plus an explicit explanation. Unknown is not zero, empty, failed or ready. Disabled controls retain readable labels and adjacent prerequisite text.

Maintain separate **domain labels** even where presentation shares a tone: “Saved draft” means server acknowledgement of that draft; “Browser backup current” is local to the tab; “Submitted” means confirmed final submission; “Decision released” means applicant-visible publication; “Queued”, “Sent” and “Delivered” use only the exact delivery evidence available. Do not create a single generic “Complete” chip. Readiness, score quorum, release and delivery remain separate facts. If the provider only proves “sent”, the UI cannot say “delivered”. Status language continues through `src/lib/labels.ts` where applicable.

Focus: 2px navy outline with 2–3px offset on light; white on blue; orange on navy. Keep the explicit exceptions in DESIGN and studio.css; the older globals.css comment citing the previous blue is not current evidence. Verify contrast in implementation; no conformance claim from source inspection.

### Geometry, density and type

- Preserve 4, 8, 12, 16, 20, 24, 32 and 48px spacing. Use 4–8px between label and related metadata, 12px between small controls, 16px within rows, 24px between task groups. Desktop gutter 32px, narrow gutter 20px. Hairline borders remain 1px; they are not spacing tokens.
- 8px controls and navigation, 12px grouped lists/panels/dialogs, 4px inset only inside segmented groups; round badges/avatars only. Do not migrate ordinary buttons to pills.
- **44px minimum interactive hit areas** including compact toolbars, icon buttons, score choices and menu items. Compactness comes from fewer boxes and shorter distances between related information, not undersized targets. Inline prose links can remain text links with adequate separation. Allow multiline controls to grow.
- Keep the 240px persistent sidebar at desktop. Keep its blue logo band, white body, role-filtered destination groups, selected-cycle context and account area. Narrow layouts use the existing labeled Menu/Close menu behavior, Escape and focus return.
- White interactive panels use 24px inset; repeated internal rows use 16px and dividers rather than another 24px panel. Plain headings and metadata do not need boxes. Shadows are for a floating popover/dialog separation only, not routine structure.
- System sans: Avenir Next / Avenir / Segoe UI / Helvetica / Arial. Weight 400 body, 600 emphasis; 12px metadata, 14px interface/body labels, 16px section emphasis, 20px key value, 28px page title. Heading leading 1.25, body 1.5. Reader answers may use 16px/24px; this is a task-specific reading role, not a second visual system. Narrow inputs use 16px. No 11px stepper labels or routine uppercase tracking.
- Mono only for candidate codes, IDs, timestamps and genuine numeric data; use tabular numerals for aligned counts. Keep names, instructions, field labels and state chips in sans.
- Data density is content-led: a single-line operational row has a 56px minimum with one 44px action; two-line rows grow to at least 72px. These are proposed row roles, not fixed clipping heights. Long names, translations and enlarged text wrap. Avoid enforcing identical heights on evidence paragraphs.

### Shared component anatomy

**Workspace frame (evolve existing shell):** explicit private scope → optional sidebar → skip link → context/header → content. The scope must work in the no-sidebar reader. Keep route/cycle selection in existing permission-aware navigation code; do not replace it with hardcoded links. Header anatomy: 12px cycle/context, 28px title, optional one-paragraph 14px purpose, action aligned beside title on wide screens and below on narrow. Status descriptions live by the task they explain, not in a hero.

**Task section (new reusable composition over existing panels):** heading and optional count → short consequence/deadline → primary action → supporting evidence. Only the single next task gets the orange edge. A non-action waiting state has an explicit “Nothing to submit now” explanation without a disabled fake CTA. A recovery state can become the primary task when saving/access cannot be verified.

**Grouped list (reuse roster/task semantics):** one 12px perimeter → toolbar → rows separated by hairlines → result count/pagination where already supported. Row anatomy: identifying label/code → relevant metadata/state → one explicit action. Keep manual stage editing in the applicant file/stage board; retain “Open file” as the ordinary Recruitment-row action. Do not make nested whole-row links and buttons compete.

**Field group (migrate FormField and existing textarea/select roles):** real label + required indication → control → hint → inline error. White control, shared neutral edge, navy focus, red invalid edge and readable disabled state. Keep `aria-describedby`, `aria-invalid`, entered values and native control behavior. Extend the same anatomy to textarea/select rather than designing another input family.

**Review criterion (new shared composition, existing scoring behavior):** criterion name/anchor → selectable score group with text anchors → evidence note. Render as one section with a divider; avoid a card enclosing another row of card-like choices. Score choices keep their actual rubric values, accessible radio semantics and 44px targets. Never compress the scale into unexplained numbers or silently default a score.

**Acknowledgement line (new reusable presentation):** exact operation state + source/scope + timestamp when known → relevant recovery action. Reserve a stable line for routine saving/saved status; expand into a full notice for error, conflicting copies or uncertain final action. Maintain live announcements without repeatedly announcing every keystroke. Do not hide the download/compare/retry controls required by current recovery flows.

**State label and notice (evolve StatusPill/OperationNotice):** semantic intent + plain label; icon only when it adds information. Use a chip for a compact fact, an inline sentence for routine acknowledgement, and a full-width notice only when a consequence or action needs explanation. Error is assertive where necessary; ordinary success is polite. Do not flatten distinct notices just to reduce component count.

**Segmented control/tabs:** one 12px outer group, 4px inset, 8px child controls, blue or selected-surface active treatment. Preserve the difference between `aria-pressed` option buttons and proper tablist/tab/tabpanel semantics. The reader already supports arrow/Home/End navigation; keep it. Remove 0.96 scale press from dense task controls; color feedback is sufficient.

## Three representative compositions

These are written screen contracts, not screenshot judgments or implemented mockups. Existing behavior remains the source of truth. Width thresholds below are implementation targets to verify with real content, not assumed device categories.

### Applicant home — /applicant

**Task:** know what requires action and whether MECG has received the relevant work. **Primary action:** the existing `NextAction` result (continue application, book a required slot, respond to a released offer, retry a failed lookup, or no action). **Result:** acknowledged action plus an accurate next state. Sources: `src/app/applicant/page.tsx`, `application-status.ts`, `next-action.ts`, `status-refresh.tsx`, `src/components/portal-shell.tsx`.

Proposed hierarchy:

1. Existing compact applicant topbar: MECG, My application, Schedule, public site, sign out. No internal sidebar.
2. One plain title/state header with applicant/cycle context. For a confirmed submission, put the receipt and confirmed timestamp here or immediately beneath; preserve the current privacy wording about written packet identifiers and identifying resume. Use a 12px text-led stage line; never imply internal ranking or predict future decisions.
3. Main column: one next-action section with the orange edge when actionable; then current application as a readable grouped disclosure. Earlier cycles remain clearly labeled and collapsed. Saved/submitted facts and permitted edit controls remain attached to that exact application.
4. Supporting column: confirmed booking first, available scheduling action second, timeline dates as a simple divided list. Avoid a card for every event. Date/time/timezone and safe location/map link remain explicit. “Add to calendar” is not proof of a booking.
5. Released decision/offer response replaces the main task only when authorized release data supports it. Preserve unavailable deadline, expired offer, withdrawn application and schedule-lookup error states. Message history is a separate evidence section; its heading must not imply verified inbox delivery.

Wide target: existing approximately 3:2 columns above 900px, 24px gap, main column allowed to grow. Narrow: receipt/context → next action → confirmed booking → current application → other dates/history. DOM and focus order should match meaningful reading order; avoid relying on CSS placement that tells a different story to keyboard/screen-reader users.

**Existing:** NextAction, immutable submitted record/status, schedule actions, automatic refresh, prior-cycle disclosures, released decisions, recovery. **Net-new presentation:** consolidated receipt/header, ordered schedule summary, shared action-edge section. No new predictive progress tracker, social comparison, streak or application “strength” score.

**Acceptance:** draft, confirmed submission, schedule error, no-action waiting, released offer with missing deadline, expired offer and withdrawn fixtures each show one unambiguous next step; no private board state leaks; receipt never relies on URL `submitted` alone; long location/text wraps at 320px; all task controls meet 44px.

### Member review reader — /member/screening/[assignmentId]

**Task:** read written evidence and submit an independent anchored evaluation. **Primary action:** Review before submitting, then Submit locked review. **Result:** confirmed immutable review and existing next-unread behavior. Sources: reading page, `screening-reading-desk.tsx`, `screening-review-form.tsx`, `src/lib/screening-rpc.ts` and existing draft/recovery modules.

Proposed hierarchy:

1. Compact no-sidebar workspace frame: Reading queue link, candidate code, Application review, cycle/deadline and existing completed/total progress as text. The absence of sidebar must not opt out of shared type/controls.
2. Wide desktop: generous evidence column and a narrower scoring column, 24px gap. Target evidence 56–68 characters per line and scorer roughly 360–440px **only when both fit**; switch to existing Read/Score tabs sooner if needed. Avoid forcing a split view at 1024px with a sidebar also present. Prefer the existing reader without sidebar for this focused task.
3. Evidence column: numbered response labels in 12px sans sentence case, full prompt in 16px emphasis, untouched answer in 16px/24px prose. White reading surface, dividers between answers. Resume follows as explicit “Context only, not scored”; retain authorized original-PDF access, identity warning and fallback link. A collapsible resume preview is an optional new interaction to evaluate, not permission to remove context access.
4. Scoring column: succinct independence instruction, accessible recusal disclosure, each criterion/anchor/note as a section, overall evidence and recommendation, stable save acknowledgement, then final review action. The column may remain sticky on desktop; focus and final controls must remain reachable without nested-scroll traps.
5. Conflict/error overrides routine density: compare exact saved copies; retain explicit keep choices, browser backup/download and unknown-action verification. Final summary remains visible before permanent lock, with Keep editing available. Submitted views remain read-only; no reopening through visual redesign.

Narrow: preserve existing keyboard-accessible Read/Score tabs; show the active tab clearly, retain entered scores on tab change and return focus predictably after validation/reveal-score. Do not overlay a bottom submit bar across fields or the PDF controls.

**Existing:** split reader, mobile tabs, independent drafts, recusal, evidence requirements, final confirmation/lock, conflict recovery. **Net-new presentation:** explicit frame scope, shared criterion/acknowledgement roles and less nested framing. **Optional later idea:** local response-anchor navigation for unusually long packets; keep it out of the first migration unless content requires it.

**Acceptance:** same rubric values/weights and evidence rules; no identity beyond the authorized packet/resume, no other-reader scores or consensus cues; draft save never reads as final submit; conflicting copies/uncertain actions cannot proceed; long answers and all criterion anchors remain accessible at enlarged text; tab change retains draft; locked submission cannot become editable.

### Board operations — /admin Recruitment and its operational handoffs

This composition is the board's recruitment workbench, not the owner-only `/admin/operations` dependency checker. Keep the latter restricted and separately named “Operations readiness”. Sources: `src/app/admin/page.tsx`, `pipeline-board.tsx`, `src/components/workspace-sidebar.tsx`, `src/lib/workspace-navigation.ts`, `src/lib/workspace-cycle-url.ts`, release-evidence page, `src/app/admin/messages/page.tsx`, owner operations page/readiness panel.

**Task:** find the next recruitment bottleneck and act on the exact selected cohort. **Primary action:** Open file or the existing scoped operational action after reviewing selection. **Result:** confirmed change with exact scope, readiness result or actionable blocker.

Proposed hierarchy:

1. Existing white 240px sidebar/blue brand band; explicit cycle switcher; permission-filtered Work/Personal/Administration groups. Keep current destination blue. A long cycle label wraps rather than truncating away which cohort is active.
2. Plain Recruitment header and short cycle context; existing Schedule event action stays secondary to list work. Keep server-derived metrics as a quiet inline definition-list band. No metric cards or invented conversion/funnel rates.
3. Main area: applicant toolbar, exact results/selection context and roster in one grouped surface. One Open file action per row. Filters/view switch remain compact but 44px tall. Show hidden-selection scope and existing exact-review safeguards whenever selection is used; a reassuring count alone is insufficient authorization.
4. Secondary 240px rail: existing attention queue first, calendar second, evaluation progress third. Orange attention count plus plain reason; neutral upcoming dates. Attention links target the exact cycle/filter. If viewport cannot support list and rail, stack the task-critical attention summary before list, with events after it.
5. Applicant dossier/release handoff: show valid evidence, missing quorum/round blockers and immutable submitted evidence as separate sections. Continue to the existing evidence route for detail. Release is an explicit operation with its existing review safeguards; do not turn a green readiness label into an implicit release.
6. Delivery handoff: link to existing `/admin/messages?view=delivery`; queued/sent/failed/delivered facts stay separate from released outcomes. Retry is a distinct authorized action. Unknown response gets verification/recovery, never a fabricated successful receipt.

**Existing:** roster/list-stage views, attention queue, cycle filtering, selected-scope safeguards, evidence diagnostics, explicit release and separate messages/delivery. **Net-new presentation:** shared operational receipt/scope row and consistent grouped surfaces across handoffs. **Deferred idea:** a cross-route “next blocker” queue only after a source contract can provide fresh, authorized blockers; do not synthesize readiness from frontend counts.

For owner-only `/admin/operations`, migrate the existing six configuration/database check tiles to a single divided checklist with check name, Ready/Action label, detail and checked timestamp. Keep actual latency as a number; no gauge or health score. The page's own description says it checks dependencies without exposing secrets. Preserve that boundary; dependency readiness does not prove release readiness or production readiness.

**Acceptance:** board/committee/panel/owner fixtures retain permission-specific destinations and actions; cycle context survives every link; hidden selected applicants remain explicit; no change to scoring, quorum, conflict handling or release gates; counts unavailable are not rendered as zero; failed/unknown release and delivery states remain distinguishable; restricted owner configuration never appears to other roles.

## Motion and personality

Use existing `--t-control` / `--t-detent` 150ms and `--t-panel` 200ms. Blue hover/selection feedback, an immediate textual saved-state change and optional short disclosure transitions explain cause and effect. Reuse the action edge only on the next task; it should not pulse, travel or become a timer.

Keep controls and essential text usable throughout. No route entrance, blur, stagger, animated counters, confetti, live decorative chart or recurring background movement. Preserve the reduced-motion behavior in `globals.css:581` and expose the same final information immediately. Avoid layout-jumping autosave text and active-scale shrinking of repeated score choices. The blue band, candid verbs, orange edge, precise candidate-code typography and occasional existing member-community photograph carry the personality; review evidence needs no photograph or marketing hero.

## Migration order, dependencies and proof

**P0 — Make shared scope/state ownership reliable.** Establish explicit private-workspace styling independent of sidebar presence; consolidate palette/geometry/semantic aliases in workspace.css. Keep public globals and studio hero roles separate. Resolve the current 36/40px desktop values against this task's 44px contract centrally. Adopt shared header, field, notice/status and action geometry before adding new route treatments. Dependency: inspect all consumers of these classes/components so auth/public surfaces do not inherit a private-layout redesign accidentally. Acceptance: same component has the same private geometry in applicant, review and board contexts; no new route-local hex/radius/height patches; public/auth changes occur only when intentionally reviewed.

**P0 — Protect operational meaning during migration.** Write a fixture checklist mapping actual save/submit/release/delivery and unknown/conflict states to exact labels. Use existing source tests as coverage inputs, not as proof of rendered behavior: applicant status/next-action tests, screening CAS/recovery tests, operator write receipt/release tests, cohort workspace selection and sign-out recovery. Dependency: existing domain/API behavior remains authoritative. Acceptance: design-only migration cannot change allowed actions, revision/consent checks, score weights, quorum, blind-review boundaries, immutable submission or policy decisions. Unknown remains actionable uncertainty.

**P1 — Migrate three representative compositions.** Applicant task/receipt hierarchy; focused member reader and criteria; board roster/rail and scoped receipt. Reuse `WorkspaceHeader`, `PortalShell` workspace branch, FormField and OperationNotice before extracting small task/row/acknowledgement compositions. Dependency: P0 roles, then role-specialist feature decisions. Acceptance: fulfill each screen contract above with no extra dashboard widgets or duplicate navigation; verify narrow reading/focus order and long content. Do not require every legacy class to disappear before shipping one coherent route.

**P1 — Sweep connected high-frequency forms.** Apply the proven roles to member evaluation, Group Case/speed-dating rosters, applicant schedule/material updates, board rounds and release evidence. Candidates: `src/app/member/evaluation-form.tsx`, `member/group-case/group-case-roster.tsx`, `member/speed-dating/speed-dating-roster.tsx`, `admin/round-board.tsx`, `admin/applications/[id]/release-evidence/evidence-view.tsx`. Dependency: preserve each surface's distinct evidence and recovery behavior; do not unify these into one generic form schema solely for appearance. Acceptance: consistent controls and state presentation, no lost instructions or recovery action.

**P2 — Remove superseded declarations and migrate secondary tools.** After consumers are accounted for, remove private reliance on `.surface-card`/shadow wrappers and shape-selector overrides such as `.rounded-2xl` as styling APIs. Migrate owner readiness to grouped rows; address settings/provisioning/audit with the proven roles. Dependency: consumer audit and representative rendered regression checks. Acceptance: style ownership is understandable without tracing a sidebar-dependent correction layer; retained legacy/auth/public rules are explicitly scoped. Cleanup is bounded and does not delay protected workflow fixes.

**Cut from this effort:** new font, redesigned logo, alternate palette, configurable density preference, omnipresent KPI grid, gamified review streaks, applicant ranking hints, team chat, giant command center, decorative charts, animation library and new analytics solely to justify the design. These add scope without evidence that they help the task.

## Implementation verification handoff

Parent owns browser and any implementation. This pass performed source reads and wrote only this plan; no app code edits, UI execution, builds, accessibility tests or screenshots were performed. Existing uncommitted work was not modified.

When implemented, inspect actual rendered 320px, 390px, approximately 768px, 1024px and 1440px layouts, then 200% text and keyboard use. Use synthetic fixtures explicitly labeled as fixtures: long applicant/cycle names; multiline locations; lengthy answers; no assignments/events; failed scheduling lookup; unavailable counts; concurrent draft copies; local backup failure; unknown final submit; blocked release; released decision with email failure. Verify focus visibility on white/blue/navy, Menu Escape/focus return, target dimensions, text contrast, errors/live announcements, tab semantics, scroll reachability, narrow DOM order and reduced motion. Do not treat these proposed checks as already passed.

Success for this planning handoff is a coherent implementable contract and preserved domain boundaries. Any later claim about faster completion, satisfaction, accessibility conformance or production readiness requires its own evidence; there is no invented research or measurable “100x” claim here.
