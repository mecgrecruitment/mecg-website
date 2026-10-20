# Product critique: make the handoff the product

Planning proposal · 2026-10-17 · private workspace · source review only.

## Scope and evidence limits

This is the independent product-simplification contribution to applicant/member/Board revitalization. It complements the separate role specialists; it does not replace their screen-level plans. No app code, browser, external system, production data, or subagent was used or changed. This document is the only intended write.

**Observed** below means visible in the current working-tree source, not verified in a running application. **Hypothesis** means a proposed explanation or future experiment, not user research. **Existing** means an implementation is present, not that it is deployed or accepted. **New** means a proposed capability or aggregation contract whose end-to-end behavior has not been established. This is not a formal two-assessment Impeccable audit: the explicit source-only, no-browser, no-subagent brief governs. The optional context launcher returned permission denied; project context was read directly. No heuristic score, detector verdict, or usability claim is supplied. Questions skipped: policy choices are recorded for the parent plan rather than interrupting the assigned task.

Authority: `AGENTS.md`, `docs/PRODUCT.md`, the **top current rules** of `docs/DESIGN.md`, `/home/rahil/.agents/design-routing.md`, and design-system-workflow. The current design is bold blue/orange, system sans, compact **Operate** UI. Preserve 4px spacing rhythm, 8px buttons, 12px panels, 44px action targets, the 240px white sidebar with blue brand band, blue selections, and restrained orange attention. Do not import historical square buttons, alternate fonts, marketing heroes, or a new visual identity from older plans.

## Ruthless thesis

**MECG should tell each authorized person what needs them next, show the evidence required to act, and hand confirmed work to its next owner.** Every proposed feature must make one of those three things materially clearer.

The product is allowed to be quiet between recruitment cycles. Year-round engagement is not sufficient justification for building chat, a learning platform, an assistant, or a social feed. Genuine project staffing and member contact needs can justify small extensions; a login habit is not an outcome.

The necessary complexity is policy and evidence: independent reviews, conflicts, rubric validity, quorum, staged release, and asynchronous delivery. Preserve it. The unnecessary complexity is making people navigate the same underlying work through several lists, treating counts as readiness, and leaving role handoffs to inference. **Merge entry points and explanations; do not merge permissions, records, or state transitions.**

## Source ledger and what it establishes

- **S1 — Product and visual authority:** `docs/PRODUCT.md`; `docs/DESIGN.md`, current rules and §§9–10. Public persuasion and private task completion have different jobs. Identity is Clerk, recruitment storage/authorization is Supabase, delivery is separate. Current rules override older geometry.
- **S2 — Navigation already exists:** `src/components/workspace-nav.tsx`; `src/lib/workspace-navigation.ts`; `src/lib/workspace-cycle-url.ts`. Shared permission-gated navigation has My work, Recruitment, Application review, Interviews, Decisions, Communications; conditional member tools; People, Projects, Settings, owner Operations. Cycle-aware URLs already exist. A unified navigation rewrite is not a missing feature.
- **S3 — Recruitment overview:** `src/app/admin/page.tsx`; `src/app/admin/pipeline-board.tsx`; `src/app/admin/pipeline-selection.ts`. Submitted applicants, attention links, events, assignment submission counts, list/stage work, and reviewed cohort selection are present. The overview computes “ready for final review” from `FINAL_REVIEW` application status; it is not the canonical evidence/release preflight.
- **S4 — Existing member work:** `src/app/member/page.tsx`; `src/lib/workspace-context.ts`; `src/app/member/assignment-navigation.ts`; `src/app/member/group-case/workspace-state.ts`. My work already prioritizes tasks and has screening, grading, calibration, locked submissions, recent completions, conflict reporting, profile and buddy availability. Specialist workspaces are not all interchangeable forms.
- **S5 — Round and decision boundaries:** `src/app/admin/rounds/page.tsx`; `src/app/admin/rounds/[roundId]/page.tsx`; `src/lib/round-evidence.ts`; `src/lib/round-close-summary.ts`; `src/app/admin/hash/page.tsx`; `src/lib/decision-release.ts`; `src/app/admin/applications/[id]/page.tsx`. Staffing, validity, independent evidence, exceptions, approvals, preflight, applicant files and per-item release failure reasons already have implementation. Submission count alone is not validity; status alone is not release eligibility.
- **S6 — Communications is already consolidated:** `src/app/admin/messages/page.tsx`; `src/app/admin/notifications/page.tsx`. Compose, History, and permission-gated Delivery share one destination. The old notifications route redirects. History uses `messages.delivered`; automated Delivery uses richer `notification_outbox` states. Their correspondence needs an explicit terminology audit, not an invented single status.
- **S7 — Handoff already has a foundation:** `src/app/applicant/page.tsx`; `src/app/applicant/onboarding-data.ts`; `src/app/applicant/onboarding.tsx`; `src/app/admin/people/page.tsx`; `src/app/admin/people/onboarding.tsx`; `src/app/admin/provisioning/page.tsx`. Accepted-applicant onboarding, task owners, contact/profile confirmation, Board completion, directory, access controls and account setup incidents exist. People explicitly says checklist completion and membership access are separate.
- **S8 — Events and outreach:** `src/app/admin/events/[id]/page.tsx`; `src/app/admin/referrals/page.tsx`; `src/app/member/refer/page.tsx`. Assisted check-in, attendance refresh, slots, observation summaries, referrals and outreach statuses exist. Event observations explicitly do not affect scores, readiness, or rank.
- **S9 — Projects are bounded:** `src/app/admin/projects/page.tsx`; `src/lib/projects/public-projects.ts`; `docs/reviews/2026-10-redesign/current-owner-decisions.md`. Board editing/staffing exists; projects are organization-wide even though staff choices use the selected cycle. No approved project material is available. Publication is a separate approval boundary.
- **S10 — Domain/policy truth:** `src/lib/authorization.ts`; `docs/policies/recruitment-policy.md`; `docs/reviews/2026-10-redesign/release-open-items.md`. BOARD and PANEL are different capability sets. Policy approval, correction procedures and retention remain unresolved under current authority. Later resume access conflicts with the earlier blind-review promise. No staging environment is established in the current evidence record.
- **S11 — Prior plans are history, not a backlog:** `docs/ALL_IN_ONE_SYSTEM.md`; `docs/design/application-system-redesign-plan.md`; `docs/design/portal-ux-plan.md`; `docs/design/2026-10-redesign-plan.md`; `docs/design/acknowledgement-states.md`; `docs/recruitment-workflow.md`. Older proposals include portal renaming, task inboxes, profiles, directories, clone/editing tools, messaging and event operations. Several now exist. The workflow still describes Supabase Auth onboarding while current product authority says Clerk. Older retention and no-resume statements cannot silently settle current policy. Receipt/recovery documentation remains useful, subject to later revision-write implementations.

## What to merge, demote, defer, and keep

### Merge navigation around jobs; keep specialist workspaces

**P0: existing capability refinement.** Keep `/member` as the personal entry and `/admin` as recruitment operations entry. Make Application review, Interviews, and Decisions the stable destinations for their respective work. Use deep links from My work into the exact assigned item. Preserve Group Case roster grading, Speed Dating workflows, screening reading, and calibration because they have different observation scenes and privacy requirements [S2, S4, S5].

**Hypothesis:** conditional links plus parallel task lists make an occasional operator unsure which entry is authoritative. Proposed first experiment: retain My work plus one contextual “Current assignments” group, demoting duplicate personal destinations into My work filters only after findability testing. Never make closed Group Case review disappear when grading closes. Do not remove an active-room shortcut merely to hit a navigation-item target.

Do not migrate every route to `/portal` just to imply one product. Shared navigation already provides the coherence the old route-rewrite proposal sought [S2, S11]. Keep bookmarks, `cycleId`, previous/next applicant context and safe return links. Dependency: capability/cycle route inventory. Acceptance: all existing authorized deep links remain reachable; unauthorized roles gain no data through the merged shell; completing a task returns to the same cycle and meaningful queue position.

### Remove rank from primary attention; retain authorized evidence comparison

**P1: existing capability presentation change.** Screening currently exposes Ranking and reader-adjusted ranking; Decisions has a ranked queue [S5; `src/app/admin/screening/page.tsx`, `src/app/admin/screening/calibrated/page.tsx`]. Do not describe ranking as absent or delete calculations without review. Default operators to missing evidence, coverage, exceptions and actions; make authorized score ordering an explicit view after readiness is understood.

**Hypothesis:** prominent ordering can encourage treating incomplete evidence as a verdict. Preserve ties, validity explanations and current scoring weights. Show adjusted screening estimates only as clearly explained diagnostics until the Board approves their decision role; do not substitute them for canonical scores. No member leaderboard, applicant percentile badge, “top talent,” or automatic threshold-based offer. Dependency: Board agrees how existing comparative views may be used. Acceptance: incomplete/blocked cases remain findable regardless of score; no score or quorum changes; blind members never receive peer aggregates through the new views.

### Keep Communications; remove the idea of a second notification product

**P0: keep existing architecture.** The merge already happened [S6]. Keep Compose/History/Delivery, failed delivery recovery and per-applicant context. A new feed duplicates the outbox without resolving ownership. Elevate actionable terminal failures into the recruitment attention rail via a link, subject to the viewer's delivery permission. Do not expose recipient identities in panel-only blind work.

**New, narrow P1 extension:** a shared operational status vocabulary across the existing History, Delivery and dossier surfaces. Audit what provider evidence supports “sent,” “delivered,” “failed,” “queued,” and “unknown” before choosing copy. A false `delivered` flag alone must not be displayed as definitive terminal failure if it can mean pending. Preserve separate data sources until their semantics are proven. Acceptance: saved, submitted, approved/locked, released, queued/sent/delivered and unconfirmed are distinguishable; successful release with failed email remains released; retrying delivery cannot repeat release.

### Keep People as one directory with guarded operational views

**P1: existing capability refinement.** People already combines directory, onboarding and Access, with owner-only incident handling [S7]. Do not add separate Member CRM, New member portal and Role manager destinations. Make the directory the member view; surface onboarding/access only to authorized roles. Put account setup incidents behind the relevant Access task, not in everyone's sidebar.

**New, narrow P1 extension:** a read-only reconciliation row for accepted applicants: offer response, onboarding owner/completion, membership access confirmed/unconfirmed, and next authorized owner. Derive this from authoritative records rather than adding a second “is member” checkbox. Acceptance: Board checklist completion cannot grant access; a membership failure is visible to the owner; applicants are not promised member access before it exists; joining a member channel is not treated as a permission grant.

### Keep Projects bounded; defer a project LMS

**P2: preserve existing editing and staffing.** The admin route maintains actual engagements and safe public content [S9]. Do not turn recruitment revitalization into milestones, chat, courses, quizzes, file storage, timesheets, task dependencies or a client portal.

**Conditional new feature:** a read-only “My project” entry with confirmed team membership, named lead and one owner-maintained resource link, only if members demonstrate a recurring need to find those facts. Do not imply members can already access the Board editor. Dependency: define organization-wide project access independently of selected recruitment-cycle membership; approve external-link visibility and an update owner. Acceptance: no confidential material is publicly exposed, inactive/unassigned users cannot read protected staffing, no invented deliverables appear, and no approved public material remains a legitimate pending state. Stop at staffing/contact if this answers the actual task.

## Six tempting additions to reject or constrain

1. **General AI assistant — defer.** No observed unmet need requires conversational access to recruitment records. Deterministic next-action copy and exact blocked reasons already fit the domain [S4, S5]. An assistant would add authorization, freshness, disclosure and correction responsibilities. Do not offer AI scoring, applicant summaries as decision evidence, predicted fit or ranking. Reconsider a public handbook search helper only after repeated unanswered findability tasks are documented, with approved nonpersonal sources, visible citations and a human contact path. This is a future hypothesis, not demand evidence.
2. **In-app chat — reject for this scope.** Older plans explicitly exclude it [S11]. Current applicant scheduling says “Member chat” for a scheduled buddy meeting; that label is not a missing messaging backend. Show meeting logistics and an approved contact method. The current tool used by the organization has not been verified; do not assert Slack or GroupMe adoption as fact.
3. **Notification feed — reject as a primary destination.** Tasks and exceptions need resolution, not unread badges. Keep critical transactional delivery, exact-item receipts, and a small role-specific attention queue. Reminder expansion is conditional on recipient need, deduplication, channel consent, timezone handling and a named operator; it is not permission to send anything now.
4. **Global command palette — defer.** Existing list search and explicit deep links should carry the primary jobs. A palette does not repair an unclear hierarchy. Reconsider only if repeated keyboard navigation/search tasks remain slow after the IA experiment. It must be optional, permission/cycle scoped and incapable of bypassing consequential-action review.
5. **Rankings and gamification — constrain existing, reject new.** Keep score evidence available to authorized decision roles, not a universal competition surface. Member activity counts do not establish review quality or merit. Do not gamify volume, offer acceptance, attendance or referrals [S5, S8, S10].
6. **Project LMS/resource hub — defer.** Calibration is task-local preparation, not evidence that a course platform is needed. Keep rubric anchors beside evaluations and a short approved resource link where relevant. Add searchable content only after real repeated retrieval failures; require a content owner and expiry/review date before building another repository of stale material.

## Overlooked handoffs: the highest-value new work

These are thin additions to existing flows, not six new top-level products.

### H1 — Submission → review preparation → independent reviewer

**Existing:** intake receipt/recovery, screening packets and review assignment [S3–S5, S11]. **New P0 planning contract:** describe the next responsible role for each preparation blocker: missing material, redaction not approved, insufficient eligible reviewers, recusal awaiting replacement. Read-only attention rows should deep-link to the existing authorized action.

Dependencies: resolve resume/blind-review policy; define which operational blocker may be shown to each role. Acceptance: applicants receive only their own next action or truthful waiting state; reviewer tasks contain no identity-bearing operational metadata; a recusal does not look like completed evidence; no generic “ready” label substitutes for independent coverage. Retain required intake validation; a missing-resume attention count is not by itself evidence that intake should accept incomplete required documents.

### H2 — Event attendance → observation → valid evaluation

**Existing:** assisted check-in and event observations already exist [S8]. **New P1 composition:** after-event handoff shows attendance recorded, assigned evaluations outstanding, valid evidence coverage, and the next recruitment owner separately. Do not request an observation from every attendee just to fill a metric.

Dependencies: a permission-scoped link between the event, round and relevant assignments; no inferred merit from presence. Acceptance: “checked in,” “observation filed,” “evaluation submitted,” and “valid independent evidence” never collapse into one completion count; event cancellation/rescheduling has a truthful applicant next step; expired check-in tokens preserve an assisted path. No new attendance-based scoring.

### H3 — Reviewer → recruitment operator → decision panel

**Existing:** calibration, conflicts, independent-evidence checks, spread review, close summary, and decision exception inbox [S4, S5]. **New P0 aggregation:** one role-filtered blocker summary using those contracts, with cause, responsible role, current state and exact resolution link. Derive task state; do not build a generic ticket engine or another editable status field.

Dependencies: authoritative validity and release contracts; define visibility per role. Acceptance: submitted-but-invalid evidence remains blocked; two entries from one evaluator cannot manufacture independence; frozen-round missing evidence leads to the approved escalation path; a Board-only user cannot approve/release because the summary contains a link. Distinguish “workflow stage: final review” from “evidence complete” and “eligible for release.”

### H4 — Locked decision → applicant release → outbound delivery

**Existing:** exact release review and per-item blocked reasons [S5, S6]. **New P0 composition:** a post-action receipt separates reviewed, released, skipped/blocked, and delivery pending/failed states. Preserve per-item partial success instead of one reassuring aggregate toast. Give each blocked item a destination and required role.

Dependencies: retain fresh snapshot review and server authorization/revalidation. Acceptance: a changed snapshot requires fresh review; unknown acknowledgement does not invite duplicate writes; a conflicted user cannot learn protected evidence through failure text; released outcomes remain visible to the applicant even when email fails; previewing a message is never equivalent to releasing it.

### H5 — Accepted offer → onboarding → usable member access

**Existing:** owned onboarding tasks and separate membership controls [S7]. **New P1 composition:** the reconciliation view above plus an applicant-facing “Waiting for Board” explanation and a confirmed route into My work once access exists. Keep self-completable contact/profile tasks distinct from Board-verified orientation/channel/handoff tasks.

Dependencies: Board defines membership activation eligibility and the account owner resolves partial provisioning. Acceptance: accepted, onboarding complete, and member access granted remain separate; an unassigned task says who can assign it; no account is automatically deleted/recreated to clear an incident; private application records never become member-directory biography content by default. Test a person who is both a returning applicant and an existing member across different cycles.

### H6 — Outgoing Board → incoming Board → next cycle

**Existing:** cycle settings, clone tooling, role management, audit, and owner readiness [S2, S7, S10, S11]. **New P1 proposal:** a compact cycle handover record listing unresolved exceptions, current approved policy version, operational owners, public contact owner, delivery failures and approved next-cycle setup links. Keep it in existing Settings/People context. No password vault, general wiki, or sensitive attachment export.

Dependencies: retention and closure policy; outgoing/incoming roles and effective dates. Acceptance: cloning cannot copy applicant/evaluation/decision evidence or silently carry approval; dates and policy are explicitly reviewed before opening; stale operators lose only the intended capability; closed-cycle read/recovery behavior matches role policy; unresolved exceptions do not disappear because a cycle closes. Public weekly hours and mandatory meeting commitments remain excluded by the current owner decision [S9].

## Policy decisions that interface design cannot settle

**P0 before treating the cycle as ready:** the recruitment lead proposes and Board approves the relevant rules through `docs/policies/recruitment-policy.md`; engineering maps each approved value to its effective cycle. Existing behavior is evidence of implementation, not Board approval.

- **Blind screening and original resumes:** reconcile the current resume capability with the no-identity promise [S10]. Decide allowed content, redaction responsibilities and reviewer access before choosing labels or exposing a universal document viewer. A proxy URL does not redact PDF bytes.
- **Corrections after submission/freeze/release:** name who reports, reviews and authorizes correction, how prior records remain preserved, and what applicants are told. Keep submitted evaluations immutable. A “report an error” request can be proposed; an Edit submitted evaluation button cannot substitute for an approved superseding/voiding process.
- **Panel roles, approvals and Hash:** retain current 40/60 weights, nonnumeric Hash, 1–5/N/O rules, at least 75% observed weight, required criteria, two valid independent evaluations, 25-point spread review and two distinct conflict-free approvals while policy remains unresolved. Preserve all additional criterion-count checks. Decide the role of stage ballots and adjusted rankings explicitly; no new algorithmic cutoff.
- **Missed rounds, accessibility and scheduling exceptions:** decide who receives a private request, acceptable alternatives and equitable deadlines. Do not implement an accommodation mailbox readable by all graders or interpret absence as low merit. This is a policy gap to resolve, not proof that a new scheduling engine is needed.
- **Feedback and waitlist handling:** specify approved applicant language, feedback scope, offer-expiry/extension ownership and communication sequence. Do not promise personalized explanations or automatic waitlist promotion until those rules and records exist.
- **Retention, close and archive:** older documents claim a two-year anonymization decision; current policy still requires approval [S10, S11]. Reconcile the record, actual scheduled behavior and privacy review before adding destructive cleanup controls. Keep metadata and backups within the approved scope.
- **Membership activation and project access:** who may grant which role, when accepted applicants become members, and how organization-wide projects remain accessible independent of a recruitment cycle. Keep Board onboarding completion separate from owner membership grants.
- **Communication ownership:** a configured reply-to is not a staffed support promise. Name a role and backup for schedule exceptions, delivery failures and applicant replies; agree response expectations before showing them in UI. No external messages are authorized by this plan.

## Outcome-based phases and future experiments

All measures below are proposed acceptance goals. No baseline, participant result, conversion gain, retention improvement, or “100×” effect is claimed. The parent should recruit appropriate authorized participants later; this document sends no invitations. Compare like tasks under the same synthetic records and keep safety errors separate from speed.

### Phase 0 — Agree what the product may claim

P0 dependencies: current authority, role/cycle matrix, blind-review resolution, correction escalation, and a hosted synthetic test environment when available. Reconcile stale planning statements in a later authorized documentation pass; do not rewrite historical review verdicts.

Exit: one parent-owned feature inventory marks existing/refine/new/defer and names an action owner, authoritative record, permission and receipt for each critical transition. Any unresolved policy remains visibly blocked. Future experiment: authorized operators classify synthetic saved/submitted/locked/released/delivery-pending/unknown cases. Goal: no harmful state conflation in the agreed acceptance scenarios; record counts and explanations, not just a satisfaction score.

### Phase 1 — Finish recruitment without hunting

P0 build candidates: H1/H3/H4 composition, readiness wording, scoped failure links, preserved deep links and Communications semantics. Prefer composing existing contracts before new persistence.

Future experiment: applicant confirms a real submission receipt; reviewer finds one current assignment, recuses and resumes another; operator finds incomplete independent evidence; panel member resolves an authorized blocker and releases a reviewed subset. Capture wrong destinations, assistance needed, backtracking, time to first correct action and state-interpretation errors against a recorded baseline. Goal: fewer navigation failures/backtracks with no new permission leak, lost work, duplicate action or incorrect readiness conclusion. Set numeric improvement thresholds after baseline collection, before testing the revision. Failure to preserve a safety invariant blocks rollout regardless of speed.

### Phase 2 — Close the role gaps

P1 candidates: H2 event handoff, H5 access reconciliation, H6 Board handover; demoted rank views only after Board agreement. Depend on Phase 1's shared state language and explicit policy decisions.

Future experiment: rehearse an accepted applicant with completed checklist but missing access, an unowned onboarding step, a failed email after successful release, a withdrawn applicant in a reviewed cohort, a cancelled event, and a closed round with insufficient evidence. Measure unowned/unresolved cases, correct escalation, time to confirmed resolution, and whether the next role understands the handoff without a side-channel explanation. Goal: every rehearsed exception retains a named next responsible role and a truthful current state; none is falsely marked done. Rehearse screen reader/keyboard and narrow-screen use separately; source review cannot establish accessibility conformance.

### Phase 3 — Earn any year-round extension

P2 conditional candidate: minimal project staffing/contact view. Require observed recurring retrieval need, a data owner, access rules and maintenance capacity first. Test whether a small view answers “who is on my project, who leads it, where is the approved resource?” Measure successful retrieval and data freshness, not daily active usage. Add a handbook, calendar subscription or reminder only when its specific task failure is documented; private calendar subscriptions require revocable access and privacy review. If the smaller view solves the task, stop. Chat, general AI, LMS, gamification and a command palette remain deferred.

## Parent integration recommendation

Make **confirmed handoffs** the organizing frame for the combined plan. Keep each role specialist's useful ideas, but reject any new primary destination that duplicates an existing job, any “ready” state not backed by its canonical contract, and any feature whose only benefit is making the product feel more complete. Preserve the current bold identity through blue navigation, orange task emphasis and precise copy; spend new complexity on ownership, recovery and reliable transitions.

Planning verification: source references were inspected in the live working tree; no browser/render, runtime, provider integration, usability session, accessibility certification or production-readiness claim accompanies this critique. The large pre-existing working-tree diff was left untouched.
