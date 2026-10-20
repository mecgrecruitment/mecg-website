# Trust and recovery: workspace revitalization

Planning review, October 17, 2026. Scope: shared applicant/member/board trust behavior, with applicant and member journey design owned by their separate specialists. This review read the current working tree, including uncommitted work. No browser interaction, tests, production calls, app edits, or external writes were performed. Test references below describe assertions present in source; they are not a claim that those tests passed in this review.

## Recommendation

Make the workspace answer three questions beside the action: **Where is my work? What has actually happened? What can I safely do next?** Preserve the existing recovery machinery and improve its presentation before adding new workflows. Use a small, reusable status-and-recovery region in the relevant form or row, not a new recovery dashboard, notification center, or marketing treatment.

Authority: [PRODUCT](../../PRODUCT.md), the current rules at the top of [DESIGN](../../DESIGN.md), [recruitment policy](../../policies/recruitment-policy.md), and the installed design-system-workflow skill. Keep bold blue/orange identity within compact private Operate composition: system sans; 4px rhythm; 8px buttons; 12px panels; 44px targets. Blue identifies the task/action, orange ink draws attention, and text states the condition independently of color. No entrance animations or extra confirmation for routine draft saves.

Evidence labels used here: **Observed** means present in the inspected source or test assertion. **Hypothesis** means a possible comprehension or operational problem requiring user/operator validation. **Proposed** means future work. Source inspection alone does not establish a production incident, real user confusion, or improved completion rates.

## Existing behavior to preserve, journey by journey

### Applicant: edit → save → compare → submit → check status

**Observed, existing:** `/apply` reads authoritative intake schema and draft revision, distinguishes schema/service failure from a closed or not-yet-open window, and names the cycle. Applicant dashboard editing access checks owned application identity against the intake cycle and editable state. A saved draft is explicitly “Draft · Not submitted”; requested changes require resubmission. An unavailable access lookup does not advertise editing. See [apply page](../../../src/app/apply/page.tsx), [application status](../../../src/app/applicant/application-status.ts), and [dashboard assertions](../../../src/app/applicant/application-status-page.test.ts).

**Observed, existing:** [application form](../../../src/app/apply/application-form.tsx) lets the applicant continue through a failed autosave; final submission posts the complete payload, cycle and revision. Do not impose a universal “server autosave must succeed before Continue or Submit” rule. Draft writes serialize revisions and replay the exact uncertain mutation before newer edits. Browser recovery is scoped to user, cycle and question schema, limited to the current tab and up to 24 hours; unavailable storage is reported rather than promised. See [recovery storage](../../../src/lib/application-draft-recovery.ts) and [reliability assertions](../../../tests/e2e/application-reliability.spec.ts).

**Observed, existing:** differing browser/server copies pause saving and preserve both versions; applicants can select exact fields, retain a whole copy, and download both. Combination is deliberate, uses the reviewed server revision, and clears consent. Exports contain personal answers and references, not attachment bytes. See [comparison UI](../../../src/app/apply/application-recovery-review.tsx) and [combine assertions](../../../tests/e2e/application-combine.spec.ts). This is already solved capability, not a new “smart merge” opportunity.

**Observed, existing:** interrupted or malformed submission acknowledgements trigger a same-cycle owned status check; an older cycle cannot clear current recovery. The dashboard independently validates the submitted receipt identifier. Unconfirmed submission preserves work and explains a safe Submit retry under the existing duplicate-prevention contract. See [status endpoint](../../../src/app/api/apply/status/route.ts), [submission assertions](../../../tests/e2e/application-reliability.spec.ts), and [dashboard receipt assertions](../../../src/app/applicant/next-action-page.test.ts).

### Applicant materials: upload → verify → attach

**Observed, existing:** [resume upload](../../../src/lib/resume-upload.ts) has separate start, storage upload, finalize and optional post-submission attach phases, bounded phase waits, and a retry of transient finalize failure for the same document. Failed upload attempts cancellation; uncertain transient finalization and failed attachment preserve the document. Server tests cover controlled storage targets, PDF-byte validation, digest recording, cancellation races, replacement cleanup and attachment gating. See [upload tests](../../../src/lib/resume-upload.test.ts) and [resume route tests](../../../src/app/api/apply/resume/resume-routes.test.ts).

**Observed, existing:** `/applicant` [resume replacement](../../../src/app/applicant/resume-replace.tsx) is separately gated by the database: the application window must allow it and screening packet creation closes replacement. Do not describe all submitted application fields as freely editable, or promise resume replacement until a date regardless of review start.

### Member: private observation → save → quality check → lock or close

**Observed, existing:** generic evaluation and screening drafts use revision-bound writes, preserve both copies on conflict, offer private exports, distinguish current browser backup from server save, and can retain memory-only observations when storage is unavailable. Final evaluation/screening locking requires the latest draft receipt and explicit review. Unknown final outcomes preserve work and direct authoritative verification rather than blind resubmission. Screening recusal remains available when the initial revision lookup fails; confirmed recusal only discards the draft after replacement coverage succeeds. See [evaluation form](../../../src/app/member/evaluation-form.tsx), [screening form](../../../src/app/member/screening/[assignmentId]/screening-review-form.tsx), [evaluation CAS assertions](../../../tests/e2e/evaluation-cas.spec.ts), [backup assertions](../../../tests/e2e/evaluation-backup.spec.ts), and [screening CAS assertions](../../../tests/e2e/screening-cas.spec.ts).

**Observed, important exception:** Group Case inline observations distinguish persistence from quality and editability. “Evidence saved · review incomplete” is a real supported state. `SUBMITTED` in that storage workflow does not mean immutable final completion. Its dedicated workspace remains editable while allowed and becomes readable without writes after freeze/finalization/archive/expiry. [Member home](../../../src/app/member/page.tsx) explicitly documents this distinction. Preserve [Group Case state](../../../src/app/member/group-case/workspace-state.ts), [revision assertions](../../../tests/e2e/group-case-revisions.spec.ts) and [read-only continuity assertions](../../../tests/e2e/member-work-continuity.spec.ts).

**Observed, different contract:** [Speed Dating roster](../../../src/app/member/speed-dating/speed-dating-roster.tsx) uses per-row score/note saves, a `savedAt` receipt and network retry; failed saves restore the confirmed score while retaining typed text. Do not claim its recovery is identical to the revision/mutation protocol used by Group Case and private evaluation forms. [Route assertions](../../../src/app/api/member/speed-dating/ratings/route.test.ts) cover authentication, payload forwarding and frozen-round rejection. Cross-tab concurrency parity would be net-new work requiring a separate contract review, not an established defect.

### Board: selected cohort → recommendation → approval → release → delivery

**Observed, existing:** cohort URLs preserve filters and anchors, shed incompatible entity IDs when switching, and reject contradictory or unauthorized selectors without silently choosing another cohort. A clone needs a returned destination ID before navigation. See [cycle selector logic](../../../src/lib/workspace-cycle-url.ts), [server authorization selection](../../../src/lib/workspace-cycle.ts), and [selection assertions](../../../tests/e2e/cohort-workspace-selection.spec.ts).

**Observed, existing:** [decision controls](../../../src/app/admin/decision-form.tsx) distinguish recommendation, approval and release. Single release validates the target decision receipt, locks uncertain repeats, and offers status reload. Batch release reviews an exact snapshot, keeps filtered visibility separate from the full release cohort, reports skipped outcomes, and requires another review after changed or unknown results. Missing evidence has an authorized applicant/cohort-specific repair destination. See [operator receipts](../../../tests/e2e/operator-write-receipts.spec.ts), [release reliability](../../../tests/e2e/release-reliability.spec.ts), and [release evidence assertions](../../../tests/e2e/release-evidence.spec.ts).

**Observed, existing:** offer-deadline editing captures the proposal, validates Detroit time, requires a matching receipt including explicit null to confirm clearing, and locks another write while uncertain. Closing grading uses a separate readback/recovery flow; a negative read alone does not prove an ambiguous write failed. See [deadline assertions](../../../tests/e2e/offer-deadline.spec.ts), [round-close control](../../../src/app/admin/round-status-control.tsx), and [acknowledgement design record](../acknowledgement-states.md).

**Observed, existing:** release and delivery are separate. `/admin/messages?view=delivery` already exposes terminal failures, attempt counts and scheduled retries. [Notification service](../../../src/lib/notifications.ts) claims outbox work and uses a stable provider idempotency key; [retry API](../../../src/app/api/admin/notifications/route.ts) checks management permission for the notification's actual cycle. Preserve these safeguards. Do not create another release to fix an email failure.

### Sign out

**Observed, existing:** [SignOutAction](../../../src/components/sign-out-action.tsx) bounds its acknowledgement wait at 15 seconds, restores focus/retry on failure, and calls navigation completion only after acknowledgement. [Sign-out assertions](../../../tests/e2e/sign-out-recovery.spec.ts) cover rejection and timeout. A redesign must preserve this reachable action in the small-screen menu. These tests do not establish how every form's private backup behaves across sign-out, account switching or tab duplication.

## Shared trust model and concrete copy

**Proposed presentation contract, largely existing behavior:** describe independent facts instead of assigning one universal “Complete” status. Keep persistence, review quality, editing availability, applicant visibility and communication separate. Derive each phrase from its own authoritative evidence; never expose storage enums directly.

- Memory only: “Changes are only on this page. Keep it open or download a private copy.” Do not claim a browser backup when its write failed.
- Browser copy: “Backed up in this tab. Account save pending.” Expandable detail: “Available for up to 24 hours; closing the tab or clearing browser storage can remove it.” Prefer this over the current applicant phrase “Saved on this device,” whose broader wording may imply durable device storage. That comprehension risk is a hypothesis, not user-study evidence.
- Server receipt: applicant “Draft saved to your account. Not submitted.” Member “Private draft saved. Not locked.” Keep the latest confirmed time as secondary evidence, not a guarantee that subsequent edits were saved.
- Conflicting copies: “Two copies differ. Saving is paused. Compare before choosing.” Keep exact text, export and explicit choice; do not pick a winner by timestamp or add AI rewriting.
- Saved but insufficient Group Case evidence: preserve “Evidence saved · review incomplete,” with the existing specific missing requirement. A successful save cannot turn an invalid review into valid evidence.
- Submitted generic evaluation: preserve “Evaluation submitted and locked.” Group Case while open: “Evidence saved. You can edit while observations are open.” Read-only: “Grading closed. Review saved observations.”
- Applicant submission: “Application received” only after the owned submission receipt/readback is confirmed. “Draft saved” never triggers this message.
- Unknown final action: “We could not confirm whether this review was locked. Keep your private copy and check My work before continuing.” Link to the authorized queue; do not offer a generic “Try again” that repeats the final write.
- Locked board outcome: “Locked for release. Applicant cannot see it yet.” Released outcome: “Released to applicant.” Adjacent notification status: “Email queued,” “Email needs attention,” or a provider-specific success phrase supported by the delivery evidence.
- Sign-out failure: retain “Sign-out could not be confirmed. Retry, or reload to check your session.” Do not replace it with a success toast or close the menu on failure.

All examples are proposed wording unless explicitly identified as existing. Use placeholders/actual server dates in implementation; never fabricate a cycle, deadline, delivery time or saved time.

## Prioritized work packages

### P0 — Preserve the boundaries as a design acceptance gate

**Type:** preservation and documentation, not a new feature. **Dependencies:** shared state vocabulary agreed with applicant/member/board specialists; engineering validates existing contracts before implementation.

Use the source inventory above as the migration checklist for any redesigned form. Update the evaluator section of [acknowledgement-states](../acknowledgement-states.md): its timestamp/no-CAS caveat predates the revision-bound flows now present in source. Preserve its warning that local recovery is not a server operation ledger.

**Acceptance:** every redesigned task identifies its save scope and final-action boundary; no raw enum becomes user copy; Group Case save never becomes final lock; applicant Continue remains usable after autosave failure; latest member draft receipt still gates locking; unknown release/close/final-review writes do not gain blind retry; conflict recovery keeps both copies and explicit choice. No change to blind-review visibility, conflict rules, scoring weights, observed-evidence minimums, quorum or immutable final evaluations.

### P1 — One compact recovery region per active task

**Type:** presentation refinement over existing capability. **Hypothesis:** repeated save labels and backup warnings make the important next action harder to identify. Applicant desktop/mobile status blocks and evaluator compact/full status regions are present in source; visual crowding remains for the parent browser review to establish.

Place a short persistent state line beside the primary action and reveal detail when attention is needed. Show the relevant recovery action once per visible task, with specific labels: “Retry draft save,” “Check submission status,” “Compare copies,” “Download private copy.” Share visual roles and copy rules, not one mutation engine. Keep browser/server facts available together when they differ.

**Dependencies:** P0; existing `OperationNotice`, `workspace.css`, applicant and member composition plans. **Acceptance:** 44px recovery controls, wrapping long errors, keyboard order and live-region feedback; full messages never truncate essential recovery instructions; asynchronous save feedback does not steal a rating pointer-up or ordinary typing focus. Conflict/final-action result focus retains existing deliberate behavior. Parent verifies narrow screens and reading/review tabs with synthetic difficult states.

### P1 — Make delivery retry status specific and bounded

**Type:** concrete UI gap plus copy refinement, not a replacement outbox. [RetryButton](../../../src/app/admin/notifications/retry-button.tsx) currently uses generic “Retry,” an unbounded client fetch/body read, and maps every non-delivered/non-pending response to “Not delivered,” including `NOT_DUE`. The stronger release/deadline controls already distinguish unknown from rejected outcomes.

Propose “Retry email” for eligible failed rows and a bounded full-response wait. On uncertainty: “Retry result could not be confirmed. Check this delivery record before another attempt.” Offer a read-only refresh. For `NOT_DUE`, say “No new send attempted. Check the current delivery status,” rather than implying a new failed delivery. Preserve the notification identity, claim lease, retry limits and provider key.

**Dependencies:** engineering defines a target-bound retry/readback receipt; verify idempotency/lease behavior before allowing another send. **Acceptance:** stalled headers/body and malformed responses restore a useful status without claiming failure or delivery; refresh performs no write; the same outbox record is retried; permission denial preserves context without recipient leakage; queued email never appears as a new release requirement.

Also align success vocabulary with actual evidence: [email adapter](../../../src/lib/email.ts) sets `delivered: true` from provider HTTP success, which does not itself prove inbox delivery or reading. Proposed visible phrase: “Sent to email provider.” Reserve “Delivered” for a future verified delivery-event contract. This is a source-backed evidence/copy mismatch, not a claim that messages have failed. Net-new webhooks are optional and outside this plan.

### P1 — Separate resume verification from application attachment

**Type:** recovery refinement with a possible API dependency. Existing upload phases are robustly separated internally, but [replacement UI](../../../src/app/applicant/resume-replace.tsx) presents a single upload state/error. Attach success currently checks HTTP status; it does not compare the returned attachment path with the finalized file before reporting “now on file.”

Propose phase copy “Uploading PDF” → “Checking PDF” → “Updating application,” followed by a filename and “Attached to this application” only with target-bound confirmation. On uncertain attachment: “We could not confirm which resume is attached. Check your current resume before uploading again.” Offer current-file readback before another replacement. If verified unattached-file recovery is supported later, reuse that document only after authorization/current-cycle checks.

**Dependencies:** engineering confirms attachment readback authority and races around “newest READY” selection; current attach endpoint takes no document ID. **Acceptance:** lost attach acknowledgement never claims the old file remains or the new file is attached; retained finalized files are not cancelled as upload failures; download of answers never implies PDF backup; closed-window/started-review refusal retains clear next steps without bypassing the gate. Do not invent an orphan-document picker, resume version history or automatic attachment retry.

### P2 — Keep cohort, deadline and unsaved scope visible through exits

**Type:** targeted presentation refinement; net-new navigation guard only if evidence warrants it. **Observed:** [cohort switcher](../../../src/components/workspace-cycle-switcher.tsx) immediately navigates and renders option status strings directly; field recovery is owned by individual forms. No data loss is established by this review.

Use the selected cohort name in recovery/result regions and humanize switcher status with existing label helpers. Preserve Detroit timezone and distinguish “No deadline” from “Deadline unavailable.” For memory-only or unresolved writes, consider an inline leave explanation using the actual save state before sign-out/cohort change. Do not add a confirmation on every navigation or block sign-out behind a failed autosave. Offer download where that workflow already supports it; any exit choice must say that session recovery is not secure deletion or durable archival.

**Dependencies:** parent inspects exits; engineering audits form backup ownership, user/account scope and cleanup. **Acceptance:** source and destination cohorts remain explicit; no entity ID is transplanted; unknown access fails closed; verified saved work causes no new exit friction; memory-only warnings make no unsupported preservation claim. Shared-device account switching and tab-close behavior need isolated acceptance evidence before adding any privacy guarantee.

## Safe retry rules and limits

- Application, evaluation, screening and Group Case draft replay: resend the captured mutation under the existing revision contract before newer edits. A corrected definitive rejection is different from an unknown write. Do not mint a new mutation to “retry” an uncertain one.
- Applicant final submission: preserve existing same-cycle reconciliation and guarded duplicate prevention. A failed status read means unknown, not “not submitted.”
- Evaluation/screening final lock or recusal, outcome release, deadline change and round close: use their operation-specific verification paths. Do not transplant the application's Submit retry copy to these controls.
- Email: retry delivery for the existing outbox entry, not release or composition. A UI timeout is not proof that the provider did not accept the send.
- Resume: distinguish upload, verification and attach; use readback after uncertainty before a fresh replacement. Existing finalize retry is not blanket permission to replay all phases.

Policy remains external authority. [Recruitment policy](../../policies/recruitment-policy.md) leaves correction workflows and retention periods unresolved. Do not add “undo submission,” reopen locked evaluations, auto-extend deadlines, bypass recusal coverage, auto-release ready outcomes, or promise a retention/deletion period. A server permission change must override a stale browser view. Private exports contain sensitive answers/notes and belong to the current authorized person, not a global recovery history or analytics feed.

## Handoff evidence still needed

Parent-owned browser review should inspect one failed draft save with newer edits, one two-copy conflict, one storage-unavailable case, one unknown final action, one selected-cohort deep link, one failed sign-out, one uncertain resume attachment, and one queued/failed email. Check narrow layout, long content, keyboard focus, touch targets, status announcements and ordinary typing/rating continuity. Use isolated synthetic fixtures; no production writes are needed to evaluate the design.

Later engineering acceptance should reuse the existing assertions cited above and add targeted coverage only for changed behavior, especially delivery retry/readback and attachment confirmation. Hosted authorization, database concurrency, storage lifecycle, provider behavior and Board/operator acceptance remain separate evidence. No user research, usability uplift, performance multiplier or production readiness is claimed here.
