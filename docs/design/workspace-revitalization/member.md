# Member workspace: work first, confidence at every handoff

Planning proposal, October 17, 2026. Source review only: no interface changes, live backend actions, browser usability testing or policy changes were performed for this brief. Existing behavior is evidenced below; friction is a hypothesis unless described as a direct source mismatch. Effort is relative: S = one bounded interface change, M = several surfaces/shared state, L = new server capability or data contract. P0 means protect completion or recoverability; P1 means remove common task friction; P2 means useful follow-on. These are planning estimates, not schedules.

## Product direction

A member should answer three questions without interpreting the recruitment system: **What needs me? Can I safely leave? What happens after I finish?** Build one work queue and a focused workspace for each task. Keep the current blue/orange identity, compact white sidebar, system sans, 8px buttons, 12px panels, four-pixel spacing and 44px targets from `docs/DESIGN.md`. Orange marks attention; blue marks the current destination and action. Avoid an analytics dashboard, giant welcome block, five parallel progress cards or a separate visual language for every round.

The signature interaction is a trustworthy handoff: a task opens with its required evidence, saved state is explicit, completion confirms the exact result, and the next eligible task is offered. Different workflows must retain different semantics: an immutable submitted evaluation, editable saved Group Case evidence, a saved Speed Dating rating and a mutable Hash vote are not one generic “done.”

## Top five changes

1. **One accurate work queue.** Share one cycle-bound task contract between My work and navigation; include eligible Hash work and distinguish published preparation from active grading. Keep live events contextual instead of hardcoding all live tasks ahead of deadlines.
2. **A focused evaluation desk.** Replace the long homepage assignment-card stack with rows and a selected-task workspace. Preserve rubric acknowledgement, independent scoring, review-before-lock and immutable submission. A successful lock leads to the next eligible review.
3. **One save/recovery language.** Give screening, evaluations and event grading the same visible vocabulary for server-confirmed, saving, unconfirmed and conflicting copies, while retaining their distinct persistence rules. Surface recovery at the task, not in repeated walls of low-priority notices.
4. **An event-night mobile workspace.** Keep the selected event/table, search, applicant identity and current save state close together. Search, record behavior, verify saved, move on; no routine scrolling across the entire roster.
5. **Make saved versus qualifying versus locked explicit.** Especially Group Case: “started grading” is not a qualifying review. Show server-confirmed qualification and specific missing requirements without altering the rubric or encouraging members to fabricate observations.

## Feature matrix for implementation triage

| Feature / route | Existing foundation to keep | Main proposed improvement | Priority / effort |
|---|---|---|---|
| My work `/member` | Combined tasks and exact assignment links | Canonical task eligibility/counts; include Hash; separate preparation | P0 / M |
| Reading queue `/member/screening` | Private next-read queue and deadline | Compact rows; honest Start versus verified Continue | P1 / S–M |
| Blind reader `/member/screening/[assignmentId]` | Read/Score tabs and context-only resume | Reading index, retained tab position, criterion/evidence navigation | P1 / M |
| Evaluation `/member?assignment=…` | Anchors, evidence checks, review and immutable lock | Focused desk with exact receipt and next eligible task | P0 / M |
| Draft recovery, shared | Revision checks, exports, explicit copy choice | Shared vocabulary and safe navigation without weakening recovery | P0 / M–L |
| Calibration `/member/calibration/[roundId]` | Version acknowledgement and return path | Contextual anchors, compact guide, return to exact task | P1 / S–M |
| Observations `/member/event` | Checked-in/conflict-filtered neutral context | Search and selected applicant; distinguish errors from closure | P0 / S error; P1 / M composition |
| Speed Dating `/member/speed-dating` | Search, per-row star autosaves, acknowledgements | Focused phone workflow and debounce/departure safety | P0 / M safety; P1 / M composition |
| Group Case `/member/group-case` | Tables, evidence-only saves, server quality, recovery | Separate saved evidence from qualifying review | P0 / M |
| Hash `/member/hash` | Private votes and eligible-stage gating | Stable presentation following; personal Not yet voted filter | P0 / M safety; P1 / S–M composition |
| Referral `/member/refer` | Board-review receipt and own statuses | Compact personal list; clear data-sharing context | P1 / S |
| Profile / People `/admin/people` | Member directory, separate admin permissions | Clear self-profile entry without management controls | P1 / S–M |
| Member chats, current home form | Zoned 20-minute slots and published list | Discoverability first; booking management is a later server project | P1 / S–M; P2 / L booking |
| Conflicts, current home/task forms | Irreversible recusal and blind boundaries | Contextual accessible consequence review and confirmed result | P0 / M |
| Cohort / account / sign-out, shared | Cycle URLs, server permissions, Clerk logout feedback | Unified dirty-task departure and clear archived context | P0 / M; P1 / S context |

## Evidence map

- Home and legacy evaluation: `src/app/member/page.tsx`, `evaluation-form.tsx`, `assignment-navigation.ts`, `work-continuity.test.ts`, `assignment-navigation.test.ts`.
- Reading queue and blind review: `src/app/member/screening/page.tsx`, `[assignmentId]/page.tsx`, `screening-reading-desk.tsx`, `screening-review-form.tsx`, `screening-draft.ts`, `screening-review-readiness.ts`; `tests/e2e/screening-cas.spec.ts`.
- Calibration: `src/app/member/calibration/[roundId]/page.tsx`, `calibration-form.tsx`, `calibration/load.ts`, `calibration/acknowledge/route.ts` and adjacent tests.
- Observations: `src/app/member/event/page.tsx`, `impression-form.tsx`, `observation-tags.ts`.
- Live scoring: `src/app/member/speed-dating/page.tsx`, `speed-dating-roster.tsx`; `src/app/member/group-case/page.tsx`, `group-case-roster.tsx`, `workspace-state.ts`; `tests/e2e/group-case-evidence.spec.ts`, `group-case-revisions.spec.ts`, `group-case-navigation.spec.ts`, `member-work-continuity.spec.ts`.
- Hash: `src/app/member/hash/page.tsx`, `hash-ballot.tsx`, `src/lib/hash-tally.ts`.
- Personal tools: `src/app/member/refer/page.tsx`, `referral-form.tsx`, `profile-form.tsx`, `buddy-slot-form.tsx`, `conflict-form.tsx`; member-facing directory at `src/app/admin/people/page.tsx`.
- Shared boundaries: `src/components/workspace-nav.tsx`, `workspace-sidebar.tsx`, `workspace-cycle-switcher.tsx`, `logout-button.tsx`, `sign-out-action.tsx`; `src/lib/workspace-navigation.ts`, `workspace-cycle-url.ts`, `workspace-context.ts`; `tests/e2e/cohort-workspace-selection.spec.ts`.
- Authority: `docs/PRODUCT.md`, current rules at the top of `docs/DESIGN.md`, `docs/policies/recruitment-policy.md`. Existing code is not approval of unresolved policy.

## Feature-by-feature proposal

### 1. My work and next work — `/member`

**Already exists:** One list combines calibration, ordinary evaluations, screening and active event work. Assignments are ordered by readiness and deadline, one eligible evaluation is expanded, recently submitted work is secondary, and closed Group Case keeps a read-only link. This is already a task-first foundation.

**Source-backed gaps:** The home task construction does not include Hash, although the shared navigation shows eligible open voting. Speed Dating tasks use `hasSpeedDatingRound`; the Speed Dating route can be published/read-only, so “Grade Speed Dating” may lead to preparation rather than writable grading. Live-event, Speed Dating and Group Case tasks use `dueAt: 0`; screening uses infinity, rather than its available queue-context deadline. Home and nav derive related counts independently. These require a contract audit before calling every instance a user-visible defect.

**Before → after:** “7 open tasks” plus large assignment cards → one short **Needs you** queue, with separate **Available now**, **Prepare**, **Waiting** and **Recently finished** states. Display actual deadline and exact state; do not manufacture urgency. Rows read “Continue candidate A12 · Application review · Due [real date]”; an unopened task says Start, a verified draft says Continue. One selected task opens a focused desk, preserving deep links and the selected cycle.

**Interaction:** Explicitly show why work is blocked (“Review rubric version 3”), link the prerequisite, then return to that exact task. Offer the next eligible item after a confirmed result; do not silently navigate away or discard a receipt. Keep an All work view for finding submitted/recused work. No approximate time-to-complete unless measured and maintained.

**Priority / effort:** P0/M. **Dependencies:** Canonical server-derived task schema, eligible-voter state, screening deadline, round editability, shared count semantics; no change to permissions. **Acceptance:** The same selected cycle yields matching home/navigation task categories; a published round is not labeled writable; eligible open Hash work is discoverable from home; expired/closed work cannot be started; direct links still open the requested eligible assignment. An empty queue states whether nothing is assigned or current work is waiting.

### 2. Blind reading queue — `/member/screening`

**Already exists:** Private progress and deadline, one Up next candidate, later candidates disclosed, completed reviews removed. Identity is candidate code, not name; reviewer access is gated.

**Hypothesis:** A large dark progress panel consumes space without making the first read easier, while “Continue application” does not distinguish an actual saved draft from an untouched review.

**Before → after:** Progress panel + one card + hidden later queue → compact progress/deadline line above candidate rows. Maintain “Start next review” as the single primary action. Mark a draft only from a verified draft-summary contract, not client guesses. Preserve chosen order and allow intentional switching without peer comparisons.

**Priority / effort:** P1/S for hierarchy, M if verified per-review draft summaries are added. **Dependencies:** Existing queue/context RPCs; draft summaries are net-new data. **Acceptance:** First actionable candidate is reachable by keyboard without traversing a large status block; candidate codes are the only identities; zero-assigned, all-complete, unavailable and overdue states say different things. No reviewer speed leaderboard or peer completion pressure.

### 3. Application reading desk — `/member/screening/[assignmentId]`

**Already exists:** Desktop reading/scoring columns, mobile Read application / Score application tabs with arrow/Home/End keyboard support, private responses, resume context-only label, PDF fallback link, queue return, rubric form with autosave and recovery.

**Hypothesis:** Long responses and a nested sticky scorer can lose the relationship between evidence and criterion. Mobile tab switching may require rereading to recover context.

**Before → after:** A long response column beside a long scoring form → readable response sections with an in-page question index and criterion links that jump to the relevant written response where a real mapping exists. Otherwise use explicit “Back to responses,” not invented rubric/question mapping. Preserve scroll position per mobile tab. Keep a compact candidate code/deadline/save strip; resume stays secondary and never becomes scored evidence.

**Interaction:** A member can manually copy an exact passage into an evidence note; attribution remains the member’s action and source text stays verbatim. No AI recommendation, inferred personality, auto-scoring, identity lookup or peer score visibility. Resume new-tab access still passes through the authorized endpoint.

**Priority / effort:** P1/M. **Dependencies:** Existing reader and review form; optional question/criterion map requires a real configured relationship. **Acceptance:** Long answers at 390px wrap without horizontal scrolling; returning from Score restores reading position; invalid criteria reveal/focus the scoring tab; unavailable assignments return safely to the same-cycle queue; PDF failure retains a labeled alternative. Source-only review does not establish resume redaction quality.

### 4. Independent evaluations and immutable submission — currently inline on `/member?assignment=…`

**Already exists:** Calibration gating, anchored 1–5 / Not observed options, observed-evidence readiness, notes, server drafts, browser backup, revision conflicts, explicit review-before-lock and locked submissions. Submission uncertainty is acknowledged instead of pretending success.

**Hypothesis:** Inline evaluation forms inside full assignment cards make the member repeatedly scan status, round, instructions, notes and multiple save notices. Entering a high-consequence action from a disclosure can obscure the final boundary.

**Before → after:** Expand one large card in My work → selected evaluation desk with one applicant heading, rubric/evidence area and a persistent compact action footer. Keep distinct **Save draft** / **Review evaluation** / **Submit and lock** language; do not call saving submission. Review shows the actual selected observations and notes, with Edit returning focus to the relevant field. After acknowledgement: “Evaluation submitted and locked,” followed by “Open next review” and “Back to My work.”

**Priority / effort:** P0/M. **Dependencies:** Existing revision/mutation contract and readiness rules; focused route optional, existing bookmarks must remain valid. **Acceptance:** Submitted/locked work never reopens for editing; reviewed content equals submitted revision; latest unconfirmed edits block locking; stale tabs cannot overwrite newer evidence; required criteria and weight coverage remain unchanged. Locked work explains correction through the Board without inventing an edit entitlement.

### 5. Drafts, recovery and safe departure — cross-feature

**Already exists:** Evaluation and screening forms distinguish server and browser copies, enforce revision comparisons, export private copies, recover uncertain writes and retain drafts. Group Case similarly exposes unknown writes, exact retry, export and explicit copy selection. This resilience must survive any visual simplification.

**Before → after:** Several separate status blocks across forms → one task-level state line, expandable details and a prominent exception panel only when action is required. Suggested vocabulary: **Saved on server**, **Saving**, **Changes only on this page**, **Save unconfirmed**, **Two copies differ**. Never show “Saved” merely because the control changed optimistically or local storage accepted bytes.

**Interaction:** A conflict pauses writes. Show which exact fields differ, preserve full local/server versions and private export, then let the member explicitly choose a whole copy or individual fields only if implemented safely. Rebase through the existing current-revision contract. An uncertain write retries its exact request before newer edits. Add a shared dirty-task departure guard for navigation, cohort switch and sign-out; it reports affected tasks and offers Wait / Keep private copy / Leave where appropriate. A guard cannot guarantee a save when the network is down.

**Priority / effort:** P0/M–L. **Dependencies:** Shared state presentation, feature adapters, secure storage lifecycle, navigation integration. **Acceptance:** Failed save never becomes silent success; newer edits remain visible during retry; storage denied/private browsing works with honest copy; exports are clearly private scores/notes and never sent externally; logout cleanup and browser retention follow a deliberate policy rather than assumed deletion. Re-authentication resumes only after identity and cycle are verified.

### 6. Calibration — `/member/calibration/[roundId]`

**Already exists:** Version-specific anchors, criterion weights/required markers, round-specific evidence standards, acknowledgement and a cycle-preserving return link. Calibration is advisory and does not adjust scores.

**Before → after:** Large repeated anchor cards → compact anchored guide with one criterion expanded at a time on mobile, all content available in sequence for keyboard/screen readers. Link “Review this criterion’s anchors” from the scoring control. Keep rubric version visible and distinguish already acknowledged from a new version requiring acknowledgement. End with “Acknowledge rubric and return to [task],” using verified task context.

**Net-new optional:** Board-authored synthetic examples with explanations, explicitly separate from real candidate evidence. This requires content ownership; it must not become an invented pass/fail quiz or scoring transformation.

**Priority / effort:** P1/S–M, optional examples P2/M. **Acceptance:** Acknowledgement persists against the exact rubric version; failed acknowledgement keeps context and retry; returning never opens a different applicant/cycle; reduced motion and keyboard disclosure behavior work; the entire evidence standard remains reachable.

### 7. Event observations and check-in boundary — `/member/event?event=…`

**Already exists:** Cycle-filtered assigned events, checked-in/conflict-filtered roster, neutral tags or note, explicit Save observation, saved editing and context that observations do not affect scores or attendance decisions. Member check-in operations are not present in this page; do not silently grant them.

**Source issue to validate:** Any roster RPC error currently renders “The observation window is closed.” Network, permission and actual closure should not be treated as the same confirmed state. The empty page says “Check in at a rush event” without providing a member check-in action; audit the real event flow before promising a link.

**Before → after:** Many applicant cards with the first unobserved form expanded → search-first roster of eligible applicants, selected applicant workspace, compact saved observation preview and explicit Save. Event selector is local context, not a horizontal row of full navigation pills. “No observation” remains neutral; no progress pressure to record interactions that never happened.

**Priority / effort:** P0/S for truthful error states; P1/M for roster workflow. **Dependencies:** Typed error/status contract, existing conflict/check-in filtering; authorized operator check-in route only if the member has that capability. **Acceptance:** Network failure offers retry with note preserved; confirmed closed windows disable edits; no eligible applicants explains checked-in/conflict filters without revealing excluded names; an unsaved observation survives a failed attempt; count indicates recorded observations rather than review obligations or score coverage.

### 8. Speed Dating — `/member/speed-dating`

**Already exists:** Name search, slash shortcut, headshots with fallback, five labeled stars, independent per-applicant autosave, per-row acknowledgements, note debounce/blur flush, exact newer-tap handling and read-only published/frozen states. This should remain fast, not become a multi-step grading wizard.

**Hypothesis:** Showing the whole roster below repeated rubric labels makes phone use awkward; a user may confuse a selected star with a confirmed rating. Timer cleanup on unmount and no obvious durable local backup in this component merit navigation-loss verification, especially for note-only edits and saves in flight.

**Before → after:** Search plus a large roster → pinned search and a short result list, selected applicant identity/rating/note in one focused region. “All,” “Rated” and “Needs attention” filters are local workflow aids, not applicant rankings. Show note requirements from existing anchors immediately when an extreme score is chosen, with exact missing requirement; never imply an invalid extreme is successfully recorded if refused by the server. A “Next conversation” action clears search only after acknowledgement or explicit retained-unsaved state.

**Priority / effort:** P0/M for safe-departure/save truth; P1/M for composition. **Dependencies:** Existing rating contract; optional recovery requires a deliberate personal-data storage policy. **Acceptance:** Rapid 1→4→2 taps leave 2 on reload after confirmed writes; note edits do not vanish when navigation interrupts debounce; failed star reverts visibly without losing typed text; no keyboard shortcut submits a vote/score accidentally; stars have text anchors and 44px targets; published rounds are clearly preparation only.

### 9. Group Case — `/member/group-case`

**Already exists:** Table filter, name search, per-applicant expandable scoring, criterion-specific anchors, blank unobserved dimensions, notes without scores, flags, revision/mutation-safe autosave, conflict comparison/export, quality feedback and read-only closed evidence. Existing tests cover navigation, revisions, evidence and closed states.

**Before → after:** “Started grading X of Y” plus long expanded rows → table context and compact applicant rows with separate **Evidence saved** and **Review qualifies / requirements missing**. A selected member observes one applicant at a time but can jump quickly within the assigned team. A neutral **Needs evidence** view lists only exact missing server-returned quality requirements, never an invented score target. Keep notes and work-session versus presentation evidence distinguishable using existing note structure first; new structured phases need schema work.

**Interaction:** Save notes immediately as notes; scoring remains optional where not observed. Recheck qualification after server acknowledgement, and explain what changed if round closure makes the workspace read-only. Completed/qualifying is not “submitted and locked” while edits remain allowed. Preserve absent observations rather than nudging every blank to a score.

**Priority / effort:** P0/M for completion semantics; P1/M for focused table workflow. **Dependencies:** Existing quality contract and round-state logic; optional structured evidence phases L. **Acceptance:** Evidence-only work remains saved yet not falsely qualifying; a refused/unknown save cannot increase confirmed progress; conflicts preserve both copies; closed evidence remains readable and search/filter work without writes; invalid rubric configuration offers a real Board dependency, not endless disabled controls.

### 10. Hash ballot — `/member/hash`

**Already exists:** Eligible-stage gating, quorum from cycle rather than board tally, personal saved votes, Yes/Unsure/No, optional notes, per-tap saving, current presentation polling, search and lazy round-note access. Current copy explains Unsure and result thresholds. Secret ballot intentionally hides peers’ votes/counts.

**Before → after:** Large rules paragraph plus Now presenting and all-applicant ballot → concise **Your ballot · [real stage]** header, one expandable “How this vote works” disclosure and a stable current-applicant region. A visible **Not yet voted** filter helps finish personal work. “Follow presentation” is opt-in: a presentation change must not steal focus or replace a member’s typed note. Personal “saved votes” count is allowed; live aggregate outcomes are not.

**Priority / effort:** P0/M for stable editing and save semantics; P1/S–M for concise hierarchy. **Dependencies:** Stage eligibility/closure data, existing note authorization and vote endpoint. **Acceptance:** Actual quorum/threshold/Unsure wording remains accurate to policy; conflicts exclude voting as enforced by the server; presentation changes announce without moving focus; only one stage/cycle’s votes load; post-application writes fail clearly; no peer vote, current tally, predicted result, consensus color or turnout pressure appears. Personal saved vote is editable only until its actual boundary.

### 11. Referrals — `/member/refer`

**Already exists:** Evidence-oriented referral reason, length counter, cycle-bound submission, named receipt, own referral list and Board status/next-action copy. It does not claim to send an applicant invitation directly.

**Before → after:** Form always precedes a stack of status cards → short “Refer someone” action above a compact personal list, with the form opened on request. Retain the written behavioral example prompt. Receipt says Board review next; it must not imply guaranteed admission or automated outreach. Clarify whose information is being shared and with whom in one line.

**Priority / effort:** P1/S. **Dependencies:** Existing endpoint and status labels; duplicate warnings only if backed by an authorized, non-disclosing server check. **Acceptance:** Failure retains every field; one pending request cannot double-submit; success list reflects actual acknowledgement; status text never leaks application review/outcome information beyond current permission. Do not introduce a referrer leaderboard or member influence score.

### 12. Profile, People and member chat availability

**Already exists:** My work hides profile and buddy availability in one disclosure; profile edits directory fields; a member may read `/admin/people`, while permissions separately gate management/onboarding. Buddy publishing creates 20-minute slots from local time with zone disclosure and lists published times.

**Before → after:** Account/profile/availability embedded below recruitment work → clear secondary **Profile** and **Member chats** destinations or account subviews. The directory keeps its read-only member experience with search and clear self-profile edit, while admin access controls remain separate. Show upcoming slots as dated rows; never imply a booking state that is not fetched. Preserve actual timezone and 20-minute duration.

**Net-new:** Editing/cancelling slots, seeing booked versus available, calendar export and conflict detection need explicit booking data, API authorization and cancellation policy. Design the confirmation around the affected real booking, not a generic delete icon; applicant notification is a separately authorized workflow. A recurring availability scheduler is not part of this proposal.

**Priority / effort:** P1/S–M for discoverability; P2/L for booking management. **Acceptance:** Member sees no role/access controls; profile success reflects server acceptance; long bios/major names wrap; timestamps use a stated zone; past/invalid starts fail without losing input; a slot’s published status is not equated with a confirmed meeting.

### 13. Conflicts and recusal

**Already exists:** Ordinary members can declare a conflict using an applicant picker; irreversible confirmation explains that existing evaluation work is voided. Screening reviewers do not see the named applicant picker on My work.

**Before → after:** Low-visibility generic disclosure plus browser confirm → contextual “Report a conflict” on an eligible task and a full accessible confirmation naming the exact permitted applicant/candidate context, work affected and irreversibility. Keep a global secondary entry. Screening recusal remains in its blind workflow; do not reveal named applicant identities to solve a navigation problem.

**Priority / effort:** P0/M. **Dependencies:** Server recusal contract; confirmed work consequences must come from authorized data. **Acceptance:** Cancel changes nothing and returns focus; accepted recusal removes writable access and explains no more work is owed; timed-out recusal checks actual assignment state before retrying; reason remains private to appropriate operators. No Undo unless policy and server behavior actually support it.

### 14. Cohort switching, role context and sign-out

**Already exists:** Shared sidebar capability gating; available cohorts filtered to authorized destinations; cycle-bound URL helpers preserve scope and strip incompatible task context. Clerk owns logout, which has a pending state, timeout/error and retry focus. Committee-only routes show a useful access explanation rather than a blank grading workspace.

**Before → after:** A small Cohort selector beside task content → one persistent current-cycle label; switch offers accessible names/statuses and a clear archived/read-only label from actual status. Shared departure protection handles dirty forms before route replacement. Multi-role users switch tasks without fake “become Board” controls; permissions remain server-derived. Profile editing never substitutes for identity/account settings.

**Priority / effort:** P0/M for dirty-task integration, P1/S for context. **Dependencies:** Shared navigation/recovery state and secure Clerk session integration. **Acceptance:** Switching never carries applicant/assignment/table IDs into the wrong cohort; in-flight or failed saves are honestly surfaced; denied cycles never render cached private content; sign-out failure remains on-screen with retry; no custom password form is reintroduced over Clerk. Browser backup retention/cleanup requires deliberate implementation and verification, not a promise that sign-out already clears all sensitive local state.

## Essential scene: a member on a phone during a live event

At 390px, the member opens My work, sees the real active event and enters it. The header keeps event/table and save state; the shell menu stays collapsed. Search sits immediately above results with a large clear button. The member selects the applicant they actually met, confirms the permitted identity, records the observed behavior and chooses the existing round-appropriate rating only if observed. The keyboard does not cover the save/status area; no two-dimensional scoring grid requires sideways scrolling.

After server acknowledgement, the row says exactly what happened: observation saved, rating saved, review qualifies, or vote saved. The member moves to another applicant deliberately. If wifi drops, the note remains, the state says unconfirmed, and retry does not overwrite newer evidence. When the Board freezes the round, the member sees read-only context and can review already saved evidence. An applicant who has not appeared because of check-in or conflict filtering is not discoverable through a client-side workaround.

Validate this scene with synthetic long names, missing headshots, large text, on-screen keyboard, slow/refused responses, a changing presentation, a frozen round and denied storage. A desktop screenshot is insufficient evidence for it.

## Shared state and accessibility acceptance

- **Loading:** Show task identity/context already known and a restrained content skeleton; do not flash zero counts, fake completion or writable controls before permission/rubric state is known. Announce readiness once, not each keystroke.
- **Empty:** Distinguish no assignment, no search match, all finished, not yet open, closed and access unavailable. Offer the relevant real next step, not a universal “contact support.” Never reveal an excluded applicant to explain a count.
- **Errors:** Distinguish validation, permission/closure, network and unknown acknowledgement. Preserve inputs. Focus an error summary for submission errors and link exact fields; background autosave errors should announce without stealing focus.
- **Keyboard:** Logical queue→task→evidence→review order; visible focus; Escape closes local dialogs and returns to trigger; arrow keys operate true tab/radio controls; no global single-key score or vote shortcut. Current Read/Score keyboard behavior is worth preserving.
- **Mobile:** 44px targets, 16px practical form text, long-word wrapping, safe-area-aware action footers, no nested scroll trap, no hidden required evidence below a sticky overlay. Test browser zoom and landscape, not only one phone width.
- **Motion:** Immediate routine page/list rendering; 150–200ms only for state/disclosure where useful; reduced-motion removes nonessential changes. No animated scoring, count-up progress or celebratory pressure around applicant judgments.
- **Privacy:** Independent review, conflicts, blind application identity, personal ballot confidentiality and server authorization are product structure. Do not decorate them away or replace them with AI suggestions. Use only authorized, synthetic fixtures for shared demos.

## Implementation sequence and proof

1. **P0 contract map:** Document task eligibility/counts, each completion boundary and each save-state adapter. Confirm Hash discovery, published grading labels, screening deadline ordering and event error classification. Add only the missing behavioral regressions, preserving existing draft/Group Case tests.
2. **One vertical member scene:** My work→calibration→focused review→review/lock→receipt→next task, including revision conflict and uncertain submit. Verify cycle isolation and keyboard/mobile behavior before spreading presentation changes.
3. **Live-event scene:** Search/selected-applicant composition across qualitative observations, Speed Dating and Group Case; retain distinct scoring and completion rules. Verify note-debounce departure, read-only transitions and confirmed progress.
4. **Hash and personal tools:** Stable presentation following, private personal completion, referral receipts, profile and availability discoverability. Defer new booking mutations until their policy/data dependencies are explicit.

Success criteria are observable task outcomes: members find the correct task without an operator explaining navigation; saved/unsaved/locked states match server evidence; the phone scene is usable; no independent-review or role boundary regresses. Numeric “100× better,” conversion gains and user preference remain unproven until real operator/member evaluation. No leaderboard, guessed urgency, AI ranking or extra dashboard widgets are required to make this system feel substantially better.
