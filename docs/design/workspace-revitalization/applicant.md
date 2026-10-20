# Applicant experience: a clear path, a trustworthy record

Planning proposal · October 17, 2026 · source review only

The applicant workspace should answer three questions immediately: **What is my state? What do I need to do? What can I safely change?** Keep the existing reliable application engine and replace the repeated explanations and scattered actions with one coherent journey. The applicant should feel supported rather than monitored.

This review inspected implemented routes, components, server boundaries and existing tests. It did not run a live applicant journey, conduct user interviews, or verify production deployment. “Observed” below means visible in source; usability impacts are hypotheses to validate with applicants. The coordinating agent also reported a live synthetic applicant sample where the Group Case evening appeared in Next up, What happens next and Your schedule, with the action below substantial header/stepper space. The source confirms three separate render paths for those same event details; this supports consolidation, without claiming the fixture represents a production applicant. Test files are coverage evidence, not a claim that tests passed in this review. No feature or policy was changed.

## Five highest-value moves

1. **One applicant home, organized around the next real task.** Present the authoritative cycle and application state, the primary action, and the next confirmed appointment together. Put past applications, full written responses and message history behind clear disclosures. Existing next-action logic is a strong foundation; retain it.
2. **Make saving understandable everywhere.** A persistent, compact save indicator distinguishes “Saved to your account,” “Saved in this tab; waiting to sync,” “Not saved; keep this page open,” and “Two copies need your choice.” Keep the current conflict/reconciliation safeguards rather than replacing them with optimistic toasts.
3. **Treat bookings as a coherent schedule.** Group available times by event/date, show the booked time within its event, and preview old → new time before a change. Preserve server-controlled capacity and the current booking if the change fails. A giant calendar is unnecessary.
4. **Show material permissions before the applicant acts.** A compact file row should state whether a replacement is allowed, why it is locked, and which file is on record. Currently the UI advertises replacement broadly and relies on RPC rejection after review begins. Resolving that requires an authoritative capability response, not a guessed browser rule.
5. **Make submission and decisions concrete records.** Provide a receipt with cycle, confirmed submission state and available timestamp; show released decision and response deadline once, with deliberate confirmation. Remove generic rejection explanations that imply an individualized rationale without supporting evidence.

## Visual and interaction direction

Use the existing Open studio identity: blue `#254f9f`, cool-paper canvas, white editing surfaces, orange ink for attention and orange fill for the next meaningful action. Use the shared workspace geometry: 4px spacing rhythm; 20px narrow-screen / 32px desktop gutters; 24px section separation; 12px panels; 8px controls; 44px mobile targets; 16px mobile input type; 28px page headings. Keep body text readable rather than shrinking it to fit more boxes.

An applicant needs the compact top bar, not the Board sidebar. Use a bounded reading column for writing and an optional secondary schedule column on wide screens. Avoid nested tinted cards, repeated headings and duplicate status summaries. Use one blue current-state marker; amber/orange means an actual task, red a failure or destructive consequence. Status always includes words. The memorable interaction is a task resolving into a durable confirmation, not a celebration animation. Respect reduced motion and browser zoom.

## Feature inventory and concrete changes

Effort is relative: **S** = localized presentation using existing data; **M** = coordinated component/state changes and focused verification; **L** = new server contract, schema/policy work or integration. P0 = foundation before broad redesign; P1 = next experience pass; P2 = conditional investment. These are not calendar estimates.

### 1. Recruitment entry, eligibility and cycle context

**Evidence:** `src/app/apply/page.tsx`; `src/lib/public-recruitment.ts`; `/join` content; `src/app/applicant/application-status.ts`; `src/app/applicant/application-status-page.test.ts`.

**Current / friction:** Observed: intake uses authoritative public recruitment and `intake_schema`; pre-open, closed, missing timeline and malformed schema have distinct treatments. A past applicant can start a newly open cycle and access earlier records. There is no general applicant cycle picker. The entry still renders a large “Apply to MECG” heading and a claim of “About 15 minutes” rather than showing the actual material requirements beside the live cycle. Hypothesis: returning applicants may be uncertain which cycle they are editing.

**Proposal:** A compact cycle strip precedes the form: cycle name, actual open/close information when available, “Open to every major,” and required-material summary. Returning applicants see “Start [live cycle]” beside a separate “Earlier applications” link. Example: “Apply to MECG” → “[cycle name] application · Draft · Continue written responses.” Do not invent a cycle selector that suggests arbitrary past cycles are editable. Do not state estimated duration as measured research; retain only a clearly qualified estimate if the product owner wants one.

**States / access:** No live cycle offers recruitment information, not a dead submit button. Unknown timeline says unknown. Single-column at narrow widths; semantic dates with Eastern timezone. Eligibility copy must match the approved product facts, not infer policy from name/email.

**Scope / priority:** Existing capability, S, P0; public recruitment contract and application identity binding are dependencies. **Accept:** open, pre-open, closed, unavailable, past-cycle and newly open-cycle fixtures each show the correct action without allowing an old draft to masquerade as the current one.

### 2. Account creation, verification and return after sign-in

**Evidence:** `src/app/apply/applicant-signup-form.tsx`; `src/app/login/login-form.tsx`; `/login/[[...login]]`; `src/app/checkin/[token]/checkin-form.tsx`.

**Current / friction:** Observed: Clerk signup, password, email code, resend/change details, duplicate-account guidance, rate-limit retry and safe local return routing exist. Verification screen labels only the code; the destination address is not shown in the rendered verification form. Hypothesis: users may not know which inbox to check or whether they are starting an application versus checking into an event.

**Proposal:** Carry the task into the auth heading: “Create an account to apply” or “Sign in to check in at [event].” Show the verification address and a direct “Change email” action. Example: “Verification code” → “Enter the code sent to r…@umich.edu”; show the full address only in the applicant's own authenticated/signup context as appropriate. Keep reset-password and existing-account paths obvious. Use applicant language for rate limiting instead of exposing “Clerk is handling a signup burst.”

**States / access:** Preserve code entry and email on retry, communicate resend delay without a decorative timer, focus the new heading, allow password managers and code autocomplete. Never replay verification attempts automatically. Maintain CAPTCHA and verified-primary-email boundary.

**Scope / priority:** Existing capability, M, P1; Clerk behavior and login task routing. **Accept:** new signup, duplicate account, missing/expired code, resend, changed email, rate limit, provider outage and check-in return all preserve the intended destination and show a useful next action.

### 3. About-you fields and profile privacy

**Evidence:** `DetailsStep` and validation in `src/app/apply/application-form.tsx`; shared field limits and values in `src/lib/workflow.ts`.

**Current / friction:** Observed: name, preferred name, verified email, optional phone, uniqname, year, college, major and optional expected graduation; autocomplete and field errors exist. It repeats signup name as an editable application field and splits identity/context across a two-column grid. Hypothesis: applicants may mistake “verified email” for a field they can change here or interpret profile separation as fully anonymous review.

**Proposal:** Two plain field groups, “Contact” and “Academic details,” with the verified email as read-only information, not an input-shaped action. Keep optional labels explicit and existing values prefilled. Explain precisely: profile fields are omitted from the written packet; original resumes can still identify the applicant. Example: “Start with the basics” → “About you” with one sentence explaining who can see these fields. Don’t add demographic or personality questions.

**States / access:** Preserve exact invalid entries; link an error summary to fields; long names, multiword majors and phone keyboard. Do not auto-overwrite an applicant's name when account profile changes. Account-email editing is a separate identity flow.

**Scope / priority:** Existing capability, S/M, P1; field schema and visibility rules unchanged. **Accept:** every required field is identified before submission, invalid fields receive linked guidance, optional values remain optional and keyboard focus follows the first error.

### 4. Written responses and preparation

**Evidence:** `ResponsesStep`, `parseIntakeSchema` and question types in `/apply`; schema-driven short text, long text, URL and select inputs; word/character limits already implemented.

**Current / friction:** Observed: all configured questions render on one responses step; each has prompt, requirement, guidance, word count and remaining characters. Hypothesis: long prompts and two simultaneous counters can create visual noise; returning students lack a quick unanswered-question overview.

**Proposal:** Keep all questions accessible in one section, with a compact “2 of 3 required responses complete” summary derived from actual validity, not time spent. Use the word limit as the primary counter when one exists; expose the independent character cap when relevant or close to it. Give each question a stable heading/anchor and optional “Focus on this response” expanded editor, preserving surrounding navigation. Offer a read-only preparation view of the current published prompts before account creation only if the public intake contract explicitly supports those prompts.

**Before → after:** An unstructured list of long editors → a short required-question index leading to the exact editor, with unchanged prompts and text. No AI answer generator, writing score, or model-polished response suggestions.

**States / access:** No fabricated sample answers that imply selection preference. An unavailable/malformed schema must block intake with retry guidance, not drop a required question. Counter announcements should not interrupt every keystroke. Mobile textarea grows, retains cursor and avoids horizontal overflow.

**Scope / priority:** Existing editor improvement M, P1; public prompt preview is a proposed new capability M with an approved/public schema contract. **Accept:** configured types, optional and required questions, over-limit text, empty schema and long prompts retain the same validation; editing from review returns to the selected question without losing text.

### 5. Four-step navigation, review and validation

**Evidence:** `STEPS`, `move`, `changeStep`, `ReviewStep` in `src/app/apply/application-form.tsx`; `tests/e2e/application-keyboard.spec.ts`.

**Current / friction:** Observed: Details → Responses → Materials → Review; sidebar shows completion based on position; mobile shows current step/progress; back/continue, per-step validation, review edit links and focus handling exist. Earlier steps may be invalid after editing even though position-based checkmarks imply completion. This is a source-level mismatch worth verifying.

**Proposal:** Distinguish “Visited” from “Ready”: only show a ready check when current values pass that section's existing validation. Keep sequential first entry; allow revisiting all unlocked sections from mobile with a compact “Sections” disclosure. Review begins with missing/invalid requirements and exact edit links, followed by the actual answers. Example: “✓ Materials” after going back and clearing a file → “Materials · Needs resume.”

**States / access:** One h1 and focusable step heading; focus first invalid field on continuation; sticky controls must not cover the last field at zoom or when the keyboard opens. Back navigation never requires a successful autosave.

**Scope / priority:** Existing capability M, P0; reuse validation, do not build competing completion rules. **Accept:** section readiness updates when values change; keyboard-only applicant can correct every requirement and consent once after final edits; save failures do not trap navigation.

### 6. Autosave, connection and session recovery

**Evidence:** save queue, sequence/revision handling, sessionStorage recovery and `localSaveLabel` in `application-form.tsx`; `src/lib/application-draft-recovery.ts`; `tests/e2e/application-reliability.spec.ts`.

**Current / friction:** Observed: delayed account save, tab-local recovery, exact uncertain-save retries, session-expired errors and storage-disabled fallback already exist. Desktop and mobile show differing amounts of state; language alternates browser/device/page. Recovery uses **sessionStorage**, so “Saved on this device” can overpromise persistence across closing a tab/browser.

**Proposal:** A shared status strip, same wording across sizes: “Saved to your account at [time]”; “Saved in this tab; waiting to sync”; “Not saved; keep this page open”; “Sign in again to sync.” Use quiet normal status and expand failure detail only when needed. Add deliberate “Save now” or “Retry save” where actionable. Show a leave warning only when actual unsaved work is at risk, not for every changed field. Do not replace sessionStorage with longer-lived PII storage as a visual change.

**States / access:** Storage-disabled browsers remain usable. Authentication recovery should preserve the tab's answers and intended return; any new in-place reauthentication behavior requires implementation verification. Announce transitions, not each keystroke. No claim of a successful save until a valid server revision returns.

**Scope / priority:** Existing capability presentation M, P0; session recovery improvements M dependent on Clerk navigation. **Accept:** failed save, offline/reconnect, unknown commit, expired auth, disabled storage and a later acknowledgement never incorrectly show account-saved or erase recoverable answers.

### 7. Competing drafts, recovery comparison and private backup

**Evidence:** `application-recovery-review.tsx`; conflict branches in `application-form.tsx`; `tests/e2e/application-combine.spec.ts`; DESIGN §8.

**Current / friction:** Observed: paused editing, whole-copy choices, changed-field comparisons, per-field combine, separate resume choice, JSON download of both copies and PII/attachment-byte warning already exist. This is valuable functionality, not missing functionality. Long copies may produce a large wall of choices.

**Proposal:** Make this a dedicated recovery workbench: “3 answers differ,” two clearly named sources, changed fields first, an explicit choice for each changed field, then a final “Continue with these choices.” Retain whole-copy shortcuts and expandable unchanged fields. Show source timestamps only if trustworthy metadata exists; never label one copy “newer” from browser time alone. Preview the result of combining without rewriting any text.

**States / access:** At narrow widths stack each field's two options together, not all of copy A then copy B. Preserve field legends, radio groups and focus on resolution. Keep download privacy warning; files are excluded and references are not portable files. Failed export keeps copies available.

**Scope / priority:** Existing capability M, P0; revision protocol unchanged. **Accept:** no writes occur before the applicant resolves the conflict; exact selected text and selected resume reference survive; fresh consent is required; a conflict arriving while typing keeps those new edits.

### 8. Resume upload, preview and post-submission replacement

**Evidence:** `MaterialsStep`; `src/lib/resume-upload.ts`; `/api/apply/resume/{start,finalize,attach,cancel}`; `src/app/applicant/resume-replace.tsx`.

**Current / friction:** Observed: private PDF up to 10 MB, start/upload/finalize pipeline, upload status and metadata; submitted applicant can attempt replacement until server refuses when window closes or a screening packet exists. Existing copy warns of the lock; dashboard does not appear to expose an explicit capability/reason before choosing a file. Returning draft label can be “Previously uploaded PDF” instead of a filename.

**Proposal:** One durable material row: filename when returned, PDF size/pages when available, “View PDF,” and a capability-backed “Replace” or “Locked for review” explanation. Keep the current file effective until a replacement is fully accepted. Example: “Resume on file / Replace resume” → “Resume.pdf · On file · View · Replacement locked: review has started.” Server must provide this capability and reason before the browser can promise it; recheck on write because state can change.

**States / access:** Native file picker remains; no drag-only interface. Rejected type/size, corrupt PDF, expired upload, interrupted finalize, forbidden replacement and stale capability preserve the prior file. Preview must remain authenticated and private. Avoid rendering untrusted filenames as HTML.

**Scope / priority:** Existing upload improvement M; proposed capability/metadata contract M/L, P0 dependency then P1 UI. **Accept:** original remains on record if replacement fails; a stale permission cannot bypass RPC restrictions; reload shows the actual stored file metadata without revealing storage paths.

### 9. Headshot, optional links and scheduling/access needs

**Evidence:** `src/app/apply/headshot-field.tsx`; `MaterialsStep`; `src/app/applicant/headshot-upload.tsx`; application schema availability behavior.

**Current / friction:** Observed: photo required when deployed/supported, native image picker, 25 MB guard, deterministic resize, result preview, previous uploaded state preservation; photo excluded from first-pass written packet. LinkedIn and access/scheduling notes are optional. Generic “Materials and access” mixes file requirements with personal accommodation information.

**Proposal:** Present required files first, optional links second, private scheduling/access needs last with accurate audience and purpose text. Show “Photo received” for existing uploads and a preview only through the existing protected access path; don't force reupload just to display a thumbnail. Explain that a phone photo is enough. Example: unexplained face upload → “Photo for [approved operational purpose] · not included in your written packet.” The purpose needs confirmation from product/privacy owners before making a stronger claim.

**States / access:** Camera capture is optional; file-picker alternative stays. HEIC/unsupported formats need actionable errors based on actual supported processing. Retain successful photo if replacement fails. Never put accessibility notes in general review or analytics views. Do not alter whether the photo is required without a policy decision.

**Scope / priority:** Existing capability S/M, P1; privacy-copy review; any change to photo requirement is policy-gated. **Accept:** no new exposure of photo/notes; reload retains completion; failed replacement never invalidates an existing usable photo; access-needs field remains optional.

### 10. Submission, consent, receipt and delivery uncertainty

**Evidence:** `submit` and `ReviewStep`; `src/lib/application-submission.ts`; `src/lib/application-receipt-delivery.ts`; `/api/apply/status`; submission confirmation gate in `/applicant`; reliability tests.

**Current / friction:** Observed: consent resets after edits; request includes current revision and cycle; duplicate protection and status reconciliation handle failed/malformed acknowledgements; confirmed redirect carries application ID; received banner checks authoritative ownership/state. Email delivery is separate from submission. The dashboard repeats receipt and review descriptions in several areas.

**Proposal:** Final review shows “Submit [cycle] application” with exact immutable consequences and concise consent. Confirmed receipt has cycle, confirmed submission status and timestamp if authoritative data exposes one, plus “View submitted answers.” Keep email delivery separate: “Application received” must not mean “Email delivered.” A downloadable plain receipt is optional, not a PDF feature project; it would contain private information and needs explicit user initiation.

**Before → after:** “You are all set” plus several repeated review statements → “Application received · [cycle] · [server timestamp if available]” and one next task. Unknown submission outcome remains “Could not confirm yet; safe to retry,” with no success animation.

**States / access:** Disable editing during active submit; focus/announce real confirmation; server rejection re-enables review and keeps answers. No user-visible success from a query parameter alone. Do not clear recovery until the correct cycle's authoritative receipt is reconciled.

**Scope / priority:** Existing capability M, P0; timestamp/receipt fields only if already available or added as a server contract. **Accept:** committed-but-disconnected submission yields one application; older-cycle receipt cannot confirm the new cycle; delivery failure cannot undo or mislabel a real submission.

### 11. Applicant home, status, requested changes and prior cycles

**Evidence:** `src/app/applicant/page.tsx`; `application-status.ts`; `next-action.ts`; `status-refresh.tsx`; status/next-action page tests.

**Current / friction:** Observed: differentiated draft/changes requested/review/released/withdrawn states, permission-bound edit access, prioritized next action, timeline, expandable current and historical files, full answers, separate schedule and background refresh. Current application opens with outcome/review copy, files, offers, withdrawal, messages and all responses. Header/status/next-action/current-file can repeat the same information. Hypothesis: this density obscures the next useful action.

**Proposal:** One status header and action, then “Your application” summary and “Your schedule.” Use compact anchors for Materials / Submitted answers / Messages / Earlier applications instead of exposing all prose by default. Requested changes need a visible exact request and due date **only when a structured, authorized request record exists**. Until then retain truthful generic wording and contact route; don’t infer requested edits from message subjects. Provide a separate “Start current cycle” action only from authoritative `can_start_application`.

**States / access:** Keep partial failure isolated (schedule failure doesn't hide application). Background refresh pauses while actions are pending and preserves focus; announce meaningful state changes. Timeline stages must not expose unreleased outcomes or suggest exact progress percentage. History retains cycle labels and cannot edit through the active cycle accidentally.

**Scope / priority:** Existing composition M, P0; structured change requests are proposed new capability L, P2 pending Board workflow. **Accept:** for every draft/needs-info/review/offer/waitlist/reject/withdrawn state, a first viewport exposes truthful state and either one primary task or explicit no-action guidance; no hidden decision reaches the browser.

### 12. Timeline, RSVP, member chats, cancellation and rescheduling

**Evidence:** applicant `next-action.ts`, schedule section, `actions.tsx`, `schedule-action.tsx`, `/applicant/schedule/route.ts`; `/api/applicant/{rsvp,buddy}`; `/api/events/[id]/ics`.

**Current / friction:** Observed: published upcoming events with map/calendar links; confirmed event slots; case group name/prompt; member-chat bookings; open event/chat slots; cancel and change with confirmation. Lists mix date/time lines and repeated actions. The next confirmed appointment takes precedence over available slots, so it should not imply the applicant has no other booking tasks. Some raw button names are generic “RSVP” and “Book 20 min.”

**Proposal:** Event-grouped agenda: next appointment first, each relevant event expands its own available times, then optional member chats. State “Booked” or “Choose a time” per event; don't imply every available event is mandatory. Show Eastern time explicitly and optionally the user's local equivalent with an accessible timezone label. Change preview: “Tue 4:00 → Wed 5:00, same event”; confirmation names the event and consequence. Add day filters only when list length warrants them. Preserve all original capacity/auth constraints.

**States / access:** Full slots explain unavailable state; booking race gives nearby alternatives without silent substitution. Failed change preserves old booking. Distinguish genuine no-slots from failed lookup. Keyboard/native controls, large row targets and focus return after inline confirmation. ICS updates must not falsely imply live calendar sync; member-chat calendar export is a proposed new endpoint if unsupported.

**Scope / priority:** Existing capability M, P1; optional local-time display M, P2; member-chat ICS M new capability, P2. **Accept:** applicant can book/change/cancel by keyboard; exact old/new event/time appears before mutation; stale/full targets cannot lose an existing booking; no merit score is inferred from attendance or chats.

### 13. Event check-in and walk-up recovery

**Evidence:** `/checkin/[token]/page.tsx`, `checkin-form.tsx`, `/api/checkin/[token]`; Board assisted check-in route.

**Current / friction:** Observed: token event lookup, invalid/closed/unavailable distinctions, signed-in identity display, account creation/login return, idempotent already-checked-in success and assisted check-in fallback. This is already substantially task-centered. Hypothesis: walk-ups may wrongly think creating an account requires submitting the application before check-in.

**Proposal:** Dedicated, minimal event context: event name/time, current identity, one check-in button. Logged-out message says explicitly “Create an account; you do not need to submit an application to check in.” On completion show a calm checkmark, event name and optional portal link. Put assisted check-in next to an outage rather than after a long error. Do not add a persistent personal QR code without a real need and threat review.

**States / access:** Handle rotated links, closed event, account mismatch, provider outage and uncertain request without blaming the attendee. Preserve safe return destination and idempotent retry. A bright screen at a busy entrance needs high contrast and a large main action; no animation that holds up the queue.

**Scope / priority:** Existing capability S, P1. **Accept:** signed-out walk-up returns to the same event after verification, and double tap/retry records one attendance event; outage always offers the current assisted fallback.

### 14. Released decisions, offer response and withdrawal

**Evidence:** `OutcomeCard`, deadline lookup and visibility in `applicant/page.tsx`; `OfferButtons`, `WithdrawButton`; `/api/applicant/{offer,withdraw}`; recruitment policy.

**Current / friction:** Observed: only released outcomes visible; offer deadlines distinguish unknown/expired, two-step immutable acceptance/decline, withdrawal two-step irreversible. Rejection copy currently asserts competitiveness/cohort-fit reasoning that is not evidenced per applicant in this component. Offer and withdrawal confirmations use similar generic “Confirm” language. A released offer's deadline can appear far below the main heading in the expanded application.

**Proposal:** A single decision module with actual released outcome, approved message, exact authoritative deadline and direct response. “Confirm acceptance” and “Confirm decline” name the irreversible action; confirmation shows cycle and response. Withdrawal moves into a clearly labeled secondary application action, never beside the primary next task. Replace speculative rejection rationale with respectful factual copy: “We are not extending an offer this cycle. Thank you for the time you put into your application.” Personalized feedback remains blocked by unresolved policy.

**States / access:** Unknown deadline never implies the offer is still open. Expired window shows contact route. Accept/decline race rechecks server state; a failed response stays recoverable. Preserve explicit release gates, immutable response, conflict controls upstream and no automatic response. Waitlist copy cannot promise a future place or unapproved update cadence.

**Scope / priority:** Existing capability S/M, P0; approved communication copy; feedback policy unresolved. **Accept:** unreleased outcomes cannot leak through text, badges or requests; unknown/expired deadlines never enable a misleading promise; exact response and cycle persist after reload and cannot be changed through UI.

### 15. Accepted-member onboarding and Board handoff

**Evidence:** `applicant/onboarding.tsx`, `onboarding-data.ts`, `/applicant/onboarding/route.ts`; keys CONTACT_CONFIRMATION, ORIENTATION, COMMUNICATIONS_CHANNEL, PROFILE_SETUP, BOARD_HANDOFF.

**Current / friction:** Observed: five checklist steps with percentage, applicant-completable contact/profile items, Board-owned orientation/channel/handoff, owner names and completion persistence. Contact step currently confirms by toggling completion; it does not itself edit email. Profile setup is a completion toggle rather than a profile editing destination. Mixed ownership can make a “steps left” headline imply work the applicant cannot do.

**Proposal:** Two groups: “Your next steps” and “MECG is arranging.” Each actionable step opens the actual supported review/edit destination or clearly confirms the current value; don't label a checkbox as profile editing. Example: “3 steps left before handoff” → “Your part is complete. MECG is arranging orientation and access.” Board tasks show owner when returned; dates only if real. Surface “Open member workspace” only when server-authorized membership is provisioned, not merely after acceptance.

**States / access:** New profile/contact edit links require verified implementation and proper authority; no account-email mutation hidden in a checklist. Ownership/completion labels are text, checkbox/toggle updates announce actual save, failed save preserves last confirmed state. Separate unavailable onboarding from a legitimate no-items state: current parsing can turn invalid/unavailable data into an empty list, so new UI should carry a loaded/error distinction.

**Scope / priority:** Existing checklist composition M, P1; capability-backed handoff state/profile actions M/L new contract where absent. **Accept:** applicants cannot self-complete Board steps or acquire member permissions through the checklist; completion reflects persisted state; all applicant work done shows waiting-on-Board rather than another applicant task.

### 16. Message history, process feedback and support

**Evidence:** applicant messages query selects `id,kind,subject,created_at,application_id`; `SurveyForm` in `actions.tsx`; `/api/applicant/survey`; `supabase/migrations/20260830100000_harden_applicant_workflow.sql`; `src/lib/application-receipt-delivery.ts`.

**Current / friction:** Observed: applicant sees message subjects/timestamps, not message bodies or delivery status. “What we have sent you” plus spam guidance can imply delivery, while the query only proves a message record exists. Post-release 1–5 process survey and optional note exist. Survey rows store cycle/rating/note, while the application stores that a survey was submitted; free-text content itself may identify a person even without a foreign key.

**Proposal:** Compact “Message history” with truthful channel/status only when returned by an authorized contract. Message-detail inbox is a conditional new capability, not assumed existing; make sure bodies cannot reveal unreleased decisions. Keep support email reachable from every failure state and prefill only non-sensitive cycle context, not answers. Keep the survey separate from decision acknowledgment. Describe privacy precisely: “Your name is not attached to the feedback record; avoid identifying details in your note,” subject to privacy-owner approval, rather than an unqualified anonymity guarantee.

**States / access:** Message lookup failure is an unavailable state, not “no messages.” No delivery badges from creation time alone. Render email content safely if later added. Survey score remains required, note optional, and errors retain both. No forced survey before accepting an offer or accessing onboarding.

**Scope / priority:** Existing copy/status M, P1; authorized message details and delivery contract L, P2; privacy copy approval. **Accept:** pending/failed delivery cannot be labeled delivered; survey failure preserves input; no unreleased decision appears through message preview; feedback remains optional and has accurate privacy language.

## Boundaries and policy gates

`docs/policies/recruitment-policy.md` is not approved policy. Applicant feedback beyond the outcome, excused missed-round alternatives, decision/evaluation correction, and retention periods remain unresolved. Do not add score breakdowns, reviewer notes, ranking, selection probability, automatic appeals or a self-serve “delete everything now” promise as part of a visual redesign. Any of those requires policy, data and authorization design first. Keep attendance and coffee chats outside merit scores. Preserve original-resume identity disclosure, verified auth, per-cycle ownership, conflict checks upstream, immutable submitted evaluations and release authority.

No universal chat bot, AI essay coach, gamified streaks, decorative analytics, social feed, push-notification campaign, applicant leaderboard or duplicate calendar product. Useful interactivity is editing, comparing, booking, confirming and recovering.

## Suggested delivery sequence and validation

1. **P0 contract and copy pass:** establish a scenario matrix; correct tab-recovery promises and unsupported outcome rationale; define file capability/onboarding/message loaded-error contracts where needed. Preserve existing reliable server logic.
2. **P0 experience composition:** applicant home, status/next action, four-step readiness, shared save status, conflict workbench, submission/offer confirmation. Reuse geometry and route guards rather than building parallel screens with different state rules.
3. **P1 complete task journeys:** auth context, response editor, material rows, grouped schedule, check-in and ownership-aware onboarding. Add only capabilities whose backend contracts are ready.
4. **P2 conditional:** public prompt preparation, message body inbox, richer requested-changes record, optional chat ICS/local-time conveniences. Validate need before adding persistent UI.

Before shipping, exercise synthetic difficult states through the actual app: new applicant, long names/essays, returning old-cycle applicant, no live cycle, storage disabled, offline/unknown save, revision conflict, corrupt/locked file, uncertain submit, full slot/reschedule failure, unavailable schedule, unreleased/released/expired/unknown-deadline decisions, declined/withdrawn state, accepted applicant waiting on Board. Reuse existing reliability and keyboard suites for the behaviors they cover; add meaningful coverage for new capability boundaries. Review desktop plus 320–390px narrow layouts, keyboard-only operation, 200% zoom, focus after updates and reduced motion. Then conduct a short real applicant/Board task review; passing tests or an agent critique alone does not prove usability or production readiness.
