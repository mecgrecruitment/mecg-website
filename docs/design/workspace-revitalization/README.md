# MECG private workspace revitalization

2026-10-17 · Design and product plan, not an approved policy change.

Implementation has started. [The first implementation pass and verification](IMPLEMENTED.md) record what changed and what remains planned. The proposals below remain broader than that pass.

**Make the next task obvious, give people a focused place to do it, and make the result trustworthy.** This is the organizing idea for applicant, member and Board work. The ambition is a substantial improvement in clarity and usefulness; “100×” is a direction of ambition, not a measured result.

[Interactive feature atlas](feature-atlas.html) · [52 feature proposals as structured data](features.json) · [Route coverage](ROUTE-COVERAGE.md) · [Shared dependencies](DEPENDENCIES.md)

## The three experiences

| Person | Primary question | Proposed composition | What changes most |
| --- | --- | --- | --- |
| Applicant | What happens next, and what do I need to do? | Compact application/status header; one primary next action; confirmed schedule; readable application/material records. | Remove repeated status/event panels; make draft, received, requested changes and released outcomes unmistakable. |
| Member | What do I owe, and did my work save? | Accurate My work queue; focused reader/scorer; compact event-day roster; private receipts and deliberate continuation. | Match task eligibility/counts across navigation and home; unify visual language and recovery presentation without merging incompatible scoring workflows. |
| Board/operator | What is blocked, and what can I do about it? | Applicant workbench; actionable attention rail; round/event operating view; evidence-led decision and release review. | Tie blockers to canonical evidence and exact repair actions; keep staffing, valid evidence, approvals, release and communication separate. |

Most of the core capabilities already exist. The strongest redesign composes them better and repairs specific gaps. It does not require another portal, another universal dashboard, or a replacement URL tree.

## What the review established

Ten AI specialist/review contributions cover the three roles, navigation, visual system, trust/recovery, live events, accessibility, product simplification and a final challenge of the combined strategy. These are source reviews, not real-user studies. The parent also inspected five representative desktop sample views: Board recruitment, member home, applicant home, blind reading desk and Speed Dating. See [preview observations](preview-observations.md).

Source-backed findings to address first:

- My work and navigation construct work differently. Hash can be available in navigation without a home task, and `hasSpeedDatingRound` can produce a Grade task for a published read-only round. Live tasks use hardcoded urgency while screening lacks a real deadline in the current task model. See [member review](member.md).
- Applicant event information is repeated through next-action, timeline and schedule rendering. Consolidate the next event without removing booking, map, time-zone or calendar details. See [applicant review](applicant.md).
- Applicant recovery uses `sessionStorage` while some copy says “Saved on this device.” Say that a backup is tab-scoped; keep the existing exact-copy conflict comparison and uncertain-submit reconciliation. See [trust and recovery](trust-and-recovery.md).
- Blind reading detail lacks the normal sidebar-bearing style scope and still renders the older warm visual treatment. It needs the current private visual system and compact orientation; a full identity-bearing navigation/search surface is not appropriate inside blind work. See [visual contract](visual-system.md).
- An event-roster lookup error is presented as a closed observation window even when closure is not established. Distinguish unavailable, denied and closed states. See [live events](live-events.md).
- The email adapter sets a `delivered` result from successful provider HTTP acceptance. Present that evidence as sent to the provider; inbox delivery needs a separate verified contract. Existing notification retry also needs bounded and more specific uncertainty handling. See [trust and recovery](trust-and-recovery.md).
- Resume replacement can be refused after screening packet creation, but the applicant is not given authoritative replacement capability before acting. A useful fix needs a server-derived capability/readback contract, not a guessed client rule. See [applicant review](applicant.md).

These findings do not establish production incidents. Existing regression tests were read as behavior evidence; application tests were not rerun in this planning exercise.

## Seven highest-value changes

1. **A complete, accurate My work queue.** Share task eligibility and state definitions with navigation. Show actionable work, prerequisites, upcoming work and completed read-only work distinctly. Include voting when genuinely available. Do not manufacture urgency or call failed loading zero tasks.
2. **A focused review desk.** Reader beside rubric on desktop; existing Read/Score views on narrow screens. Compact cohort/candidate context, queue return and recusal; quiet save receipt; review and lock; confirmed next task. Keep blind identity boundaries and existing calibration/receipt rules.
3. **One applicant next step.** A single confirmed appointment/action, honest compact status and readable application record. Writing uses section completion tied to actual requirements, rather than interpreting visited steps as complete. Keep direct error/fix links and final review.
4. **Materials with permission and proof.** File rows show what is actually attached and whether replacement is allowed. Separate upload, validation and application attachment. Unknown attachment gets a current-file check; it does not claim the old or new file is definitely on record.
5. **A Board blocker workbench.** Keep the current roster/search and attention rail, simplify filter hierarchy, preserve selection/return context. Distinguish unplaced, insufficient staffing, insufficient valid evidence, spread review, locked decisions and release blockers. Each needs the actual authorized repair destination.
6. **Event mode inside existing rounds/events.** Put attendance/placement/coverage and current phase before settings during operation. Members get fast person/team search, relevant context, rating anchors and row-specific save state. Selected team is not an assigned physical table. A real rotation controller is a conditional new capability.
7. **Finish the handoffs.** Applicant received → review assigned; observations saved → qualifying evidence; decision locked → released; outcome released → notification status; accepted applicant → joining tasks → actual member access. Later, start with an owner-reviewed outgoing/incoming Board handover checklist in Settings/People; a persistent record needs separately defined purpose, ownership and retention. Each transition must name its authoritative record and next responsible role.

## Visual essence

The current blue/orange Open studio identity remains authoritative. Its private expression should be precise and alive through clear selection, useful response and confident typography. Do not import the public homepage's large photo/hero composition into operating screens.

- Blue `#254f9f`: selected destination and primary operating actions. Orange `#fe904d`: restrained attention and the existing next-task edge; orange ink `#a83e0b` for text on light surfaces. Keep surface-aware focus and semantic error/success colors.
- Cool-paper canvas `#f5f8fd`, white grouped work surfaces, rule `#d8e1ed`, muted text `#52627c`. Centralize ownership; don't add per-route palette patches.
- Retain the system sans. Proposed private scale: 28px title, 20px emphasis, 16px section/reading text, 14px interface body, 12px metadata. Mobile inputs use practical 16px text. Mono is for genuine identifiers/times/data.
- Spacing: 4/8/12/16/20/24/32/48px rhythm; desktop 32px gutter, narrow 20px. Controls 8px corners; panels 12px. Target 44px interactive areas, including scoring and recovery actions. Let text and controls grow under zoom.
- Group related rows within one surface; do not give every sentence its own card. Use a compact neutral state line ordinarily and expand recovery details when needed.
- Keep the 240px white sidebar/blue logo band for general internal work. Focused blind work gets safe compact orientation, not directory access. Applicants retain a simple top bar.
- Use immediate state changes and at most short 150–200ms feedback/disclosure transitions. No animated counters, page entrances, confetti or pressure-inducing scoring effects.

The [visual contract](visual-system.md) specifies reusable components and three representative screen compositions. It is a proposal; canonical `docs/DESIGN.md` was not replaced by this exercise.

## Build sequence

“First/Next/Later” in the atlas ranks the full feature set; it is not a promise to ship every First item simultaneously. Effort in role reports is relative, not a schedule estimate. Start with connected vertical journeys.

| Increment | Concrete scope | Dependencies | Evidence required to finish |
| --- | --- | --- | --- |
| A — Shared foundations | Task eligibility/counts; explicit private style scope; truthful save/submit/release/provider-send language; shared field/action/focus roles. | Existing contracts and role/cycle map; no policy changes. | Synthetic no-work, unavailable, closed/published/active, conflict, pending and unknown cases remain distinct. Current permissions and existing safeguards survive. |
| B — Three complete journeys | Applicant form → confirmed receipt → next appointment; member queue → calibration/read/score → lock/receipt → next; Board attention → evidence → reviewed action → release → notification status. | A, existing source-of-truth endpoints; explicit new capability work for materials where required. | Keyboard and narrow layouts, long content, exact selection/cycle context, failure recovery. No lost draft, identity leakage or false confirmation. |
| C — Event operation | Existing event/round operating view; compact mobile scoring; late arrival/placement exceptions; clear saved versus qualifying evidence and read-only continuity. | B and approved event policy. New concurrency/rotation contracts scoped separately. | Rehearse weak network, pending notes, competing edits, recusal, stale roster and round freeze. A global roster is not a member's quota to rate everyone. |
| D — Handoffs and secondary tools | Access reconciliation, next-cycle handover; apply proven patterns to People, Settings, activity, owner readiness and public-project editing. | Named owners and approved access/retention rules; authoritative records. | Accepted/onboarded/access-granted states remain separate; owner-only operations remain restricted; cloned cycles do not inherit applicant evidence or approval. |

Future usability validation should compare the same synthetic tasks before/after with actual applicants, members and operators. Record assistance needed, wrong destinations, backtracking, first correct action, state misunderstandings and recovery success. Collect a baseline before selecting numeric targets. Preserve safety invariants regardless of any speed improvement.

## New capabilities worth considering

Keep these separate from presentation-only work:

- A canonical authorized task/readiness contract, extending the existing workspace context rather than creating a new inbox.
- Material replacement capabilities and target-bound attachment readback.
- Accepted-applicant/access reconciliation using existing records, with a new aggregation contract if needed.
- An owner-reviewed outgoing/incoming Board handover checklist inside existing management work; a persistent record is conditional on purpose, ownership and retention.
- Authoritative event post/rotation assignment only if operators need it; it requires data and lifecycle design beyond the current remembered case-team selection.
- A minimal read-only My project/team/contact view only after confirming recurring need and organization-wide access rules. Do not turn recruitment work into a project management or course platform.

Defer chat, a general AI assistant, AI scoring, member leaderboards, applicant percentile badges, gamified review streaks, a second notification feed, a new LMS and a global command palette. These do not address the observed task-friction first. Preserve existing authorized score/ranking views; any decision-role change requires Board agreement.

## Decisions the design cannot invent

[Recruitment policy](../../policies/recruitment-policy.md) remains unresolved in several areas. Keep the current enforced weights, evidence requirements, quorum, conflict rules and release behavior while decisions go through the Board's process. In particular:

- Define blind-review handling for original resumes; an authorized proxy does not redact identity inside a PDF.
- Reconcile policy language about immutable submitted evaluations with mutable inline-observation persistence states; use accurate UI vocabulary rather than changing the rules.
- Define correction/escalation after final submit/freeze/release; do not add Edit submitted evaluation.
- Define missed-round/accommodation handling, feedback, offer extensions and waitlist promotion before promising those actions.
- Define retention, role activation and next-cycle handover ownership before adding destructive cleanup or automatic membership grants.
- Define who owns applicant replies and schedule exceptions; a reply-to address is not a support-service guarantee.

These are dependencies for their affected features, not reasons to delay unrelated presentation improvements.

## Specialist reports and review record

- [Applicant: 16 feature areas](applicant.md)
- [Member: detailed feature matrix and five key flows](member.md)
- [Board: operations and management feature matrix](board.md)
- [Navigation and role/cycle continuity](navigation.md)
- [Visual system and representative compositions](visual-system.md)
- [Trust, state and recovery](trust-and-recovery.md)
- [Live-event workflows and new-contract boundaries](live-events.md)
- [Accessibility and mobile acceptance scenarios](accessibility.md)
- [Product simplification and handoffs](product-critique.md)
- [Final combined-strategy challenge](strategy-review.md) and [parent resolution](REVIEW-RESOLUTION.md)
- [Parent preview observations](preview-observations.md)

The atlas groups related features differently from the specialist reports, so counts are not additive. It contains 16 applicant, 14 member and 22 Board feature areas, with concrete interaction examples, priorities and dependencies. Reports carry deeper source references, effort and acceptance criteria.

Verification for this deliverable: source-backed synthesis and representative sample inspection; HTML atlas rendered at desktop/mobile widths with its inventory checks. No implementation, production writes, messages, migration or deployment occurred in this task. Existing test results from earlier homepage work are not evidence for the private redesign proposals.
