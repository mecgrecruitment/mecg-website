# Workspace revitalization: navigation and continuity

Planning only · October 17, 2026 · Source inspection, no browser inspection or app changes.

## Recommendation

Keep the working route trees and one shared internal shell. Make **My work** the member's task queue; give operators a clearly separated **Recruitment** group; put personal utilities in **Community** and configuration in **Administration**. Applicants keep their own compact top bar. Do not introduce a global role toggle that makes board members leave personal assignments to operate recruitment.

The useful new behavior is a **context-preserving handoff**: each task tells the person which cohort they are working in, what was confirmed, and where to continue. Most of the required capabilities already exist. This is an information architecture refinement, not a proposal for another dashboard or a new URL hierarchy.

Evidence terms used below:

- **Observed:** present in the inspected source; not proof of rendered usability or production behavior.
- **Hypothesis:** a likely friction or benefit requiring a walkthrough with actual applicants, evaluators, and operators.
- **Existing refinement:** reorganizes or connects existing functionality.
- **New behavior:** needs implementation beyond changing labels or link placement.

Authority: [PRODUCT](../../PRODUCT.md), the current rules at the top of [DESIGN](../../DESIGN.md), `/home/rahil/.agents/design-routing.md`, and the installed `design-system-workflow` skill. Blue `#254f9f`, orange `#fe904d`/orange ink `#a83e0b`, white 240px sidebar, existing system sans, 4px spacing rhythm, 8px buttons/navigation, 12px panels, and 44px interaction targets remain. Private Operate screens stay compact and task-first. No marketing hero, new font, or new visual identity is needed.

## What the source currently does

| Surface | Observed topology and behavior | Implication / hypothesis |
|---|---|---|
| Internal shell | [workspace-nav.tsx](../../../src/components/workspace-nav.tsx) composes `Workspace`, `My tools`, and `Administration`; [workspace-sidebar.tsx](../../../src/components/workspace-sidebar.tsx) renders desktop sidebar and a narrow-screen `Menu` disclosure. It closes on navigation and Escape, returning focus on Escape. | One shell already solves much of the role-switching problem. Refine its grouping instead of replacing it. |
| Main destinations | `My work` for internal users; `Recruitment`, `Application review`, `Interviews`, `Communications` for recruitment operators; `Overview` for panel-only users; `Decisions` for panel access. | Personal work and operating tools currently occupy one group. Hypothesis: explicit group boundaries will clarify why two application-review destinations exist. |
| Member tools | [workspace-navigation.ts](../../../src/lib/workspace-navigation.ts) conditionally adds `Speed Dating`, `Group Case`, `Hash vote`, `Read applications · N`, `Live event`; always includes `Refer someone` and `People`. | Urgent evaluation surfaces and occasional community tools have the same level. Preserve direct active-work links; separate the utilities. |
| Administration | `Activity` for recruitment operators, `Projects` for board/owner, `Settings` for cycle managers, `Operations` for owners. | Labels can communicate scope more clearly; project publication work should remain available without consuming recruitment navigation. |
| More menu | [workspace-more-menu.tsx](../../../src/components/workspace-more-menu.tsx) still implements `More` and secondary selection, but inspected source has no production importer; only its own definition and a test stub reference it. | Do not design around a second live navigation system. Confirm usage before deleting any legacy component/test. |
| Cohort | [workspace-cycle-switcher.tsx](../../../src/components/workspace-cycle-switcher.tsx) preserves URL context through [workspace-cycle-url.ts](../../../src/lib/workspace-cycle-url.ts). Options are filtered by permissions required for the **current path**, and switcher renders only with multiple options. A single-cohort label says `Current cycle`. | A member of another cohort can lack a switch option while on an owner-only page. This is protective existing behavior, but may make available cohorts appear to vanish. `Current cycle` can also be ambiguous when viewing history. |
| Member home | [member/page.tsx](../../../src/app/member/page.tsx) has deadline-ordered tasks, calibration prerequisites, screening, live-event and round links, recent completions, conflict reporting, profile and chat availability. Group Case and Speed Dating use their dedicated workspaces. | The task queue already exists. Do not propose a duplicate inbox as a net-new feature. Task/count consistency deserves verification: local task rows and shell `openTaskCount` have different construction paths. |
| Board home | [admin/page.tsx](../../../src/app/admin/page.tsx) combines applicant list/stage board, attention filters, events and evaluation progress. [pipeline-board.tsx](../../../src/app/admin/pipeline-board.tsx) owns list state and dossier entry. | Keep list and stage board as views of one destination. A separate applicant dashboard would duplicate it. |
| Applicant home | [applicant/page.tsx](../../../src/app/applicant/page.tsx) chooses a next action, shows current/earlier applications, onboarding, released outcome, message history and schedule. [portal-shell.tsx](../../../src/components/portal-shell.tsx) links `My application`, `Schedule`, `Public site`, sign out. | Applicant IA already differs appropriately from internal IA. Preserve existing anchors and improve the intake-to-status handoff. |
| Deep work | Screening detail and calibration pages do not mount `WorkspaceNav`; screening provides `Reading queue`, calibration provides a return path. Screening submission already routes to the next assignment from its receipt. | Hypothesis: focused work benefits from a compact orientation strip, not necessarily the full sidebar. Do not claim that next-application navigation is missing. |
| Existing consolidation | `/admin/groups`, `/admin/group-case`, `/admin/speed-dating` use [legacy-round-redirect.ts](../../../src/app/admin/rounds/legacy-round-redirect.ts). `/admin/notifications` redirects to Communications delivery. `/admin/login` redirects to `/login`; `/applicant/[token]` redirects to `/applicant`. | Retain these working entry points. Do not restore them as peer navigation destinations. |

## Proposed route map and exact labels

Routes below remain canonical unless explicitly marked new. Append `cycleId` to internal links through the existing helper; a route path alone is not a permission grant.

### Applicant

Top navigation: **My application**, **Schedule**. Utility navigation: **Public site**, **Sign out**. Display the actual application cohort next to status, including while viewing earlier applications. Applicants do not get the internal cohort selector or directory.

- **My application** → `/applicant#current-application`. Current status, answers/materials, released decision and response stay together. Expand the target disclosure when arriving by anchor; this is a proposed explicit behavior to verify, not a current guarantee.
- **Schedule** → `/applicant#applicant-schedule`. Confirmed bookings first, booking/rescheduling controls next; preserve RSVP receipts and calendar links.
- **Continue application** → `/apply` only when authoritative intake says editing is available. **Start application** uses the same route for a newly eligible cycle. Never imply that an arbitrary earlier application can be edited here.
- **Continue onboarding** → `/applicant#member-onboarding` when the existing onboarding state permits it. It stays a next action rather than a permanent empty tab.
- Earlier application disclosures remain on `/applicant`, labeled by cohort. Do not create a redundant `History` destination until volume makes the existing disclosure model inadequate.

Intake top bar should have a real **Application status** link to `/applicant` where authorized, plus **Public site** and account controls; it must not reuse status-page anchors on `/apply`, where those targets do not exist. Preserve the current submission-confirmation path and resume/recovery behavior. A saved draft remains **Saved draft**; confirmation alone can say **Application received**.

### Evaluator member

Desktop groups, in order:

1. **My work** group: **My work** → `/member`; **Read applications** → `/member/screening` when assigned; **Speed Dating** → `/member/speed-dating` when available; **Group Case** → `/member/group-case` when available; **Live observations** → `/member/event` when an event exists; **Hash vote** → `/member/hash` when permitted and open.
2. **Community** group: **People** → `/admin/people`; **Refer someone** → `/member/refer`.
3. Account utilities: **Profile and availability** → proposed stable `/member#profile-and-availability` anchor on the existing disclosure; **Public site** → `/home`; **Sign out**.

Do not force every member to see every conditional link. Active reading isolation continues to determine round visibility, names and data access; a more unified navigation must not broaden reviewer access. Keep a relevant closed Group Case read-only destination available according to its existing state contract. Do not turn an unavailable task into an apparent assignment just to stabilize the menu.

The `/admin/people` path can stay: [people/page.tsx](../../../src/app/admin/people/page.tsx) deliberately permits member directory access and separately gates management. UI wording should be `People`, never `Admin people`. No new `/member/people` alias is necessary.

### Board / recruitment operator

Keep the same shell, with the same **My work** group first. Insert **Recruitment** after it, then **Community**, then **Administration**. Board duties and an individual's reviews remain distinct without a mode switch.

**Recruitment**:

- **Applicants** → `/admin`. Rename current `Recruitment` destination and page title to `Applicants`; group heading supplies the wider context. Keep its current list, stage board and attention rail. **List** and **Stage board** are local views, not extra sidebar destinations. Preserve existing query values even if visible labels change.
- **Review oversight** → `/admin/screening`. Rename the board destination/page to distinguish assignment/ranking administration from the individual's **Read applications** queue. **Reader-adjusted ranking** remains local at `/admin/screening/calibrated`.
- **Rounds and events** → `/admin/rounds`. Rename `Interviews`: the route already contains application-screen rounds and events. Round details stay `/admin/rounds/[roundId]`; event details `/admin/events/[id]`; **Schedule event** stays `/admin/events/new`.
- **Decisions** → `/admin/hash`, only with its actual access permission. **Discussion mode** → `/admin/hash/deliberate` stays contextual. Board role alone does not mean panel, decide, or release authority.
- **Communications** → `/admin/messages`, retaining local **Compose**, **History**, **Delivery** views and the delivery capability gate. Failed delivery attention links directly to `?view=delivery#failed-notifications` where allowed; it does not add a `Notifications` destination.

**Community**: the same **People** and **Refer someone** links. Board onboarding remains local to People; ownership of completion is explicit.

**Administration**: **Activity** → `/admin/audit`; **Public projects** → `/admin/projects` for board/owner; **Cohort settings** → `/admin/settings` for managers; **Operations readiness** → `/admin/operations` for owner. **Account setup incidents** → `/admin/provisioning` stays contextual from People and only for membership managers. **Referrals** → `/admin/referrals` stays contextual from Applicants, rather than becoming another sidebar item.

For panel-only users, label `/admin` **Cohort overview**, retain **Decisions**, and omit operating destinations. Committee users see operating destinations for eligible cohorts, but receive no implied board, release or owner access. This map follows [authorization.ts](../../../src/lib/authorization.ts), not a simplified three-role permission model.

### Dual-role behavior and sign-in

Observed [auth-destination.ts](../../../src/lib/auth-destination.ts): inactive → `/access-denied`; owner/board/panel/eligible committee → `/admin`; member → `/member`; then eligible new/editable application → `/apply`; existing application → `/applicant`; otherwise `/apply`. Closed/archived committee membership is excluded. Keep this deterministic default in the first pass.

- Board + member: personal tasks remain visible first; sign-in continues to `/admin`. Do not open the applicant queue merely because the person clicked **My work**.
- Board/panel permissions in one cohort and member access in another: resolve every destination against selected-cohort capabilities. Do not carry board navigation into the member-only cohort.
- Internal user + applicant history: **My application** can be an account utility only after an authorized applicant check. This is **new behavior**, not an existing supported dual-role flow. `/apply` currently redirects internal users according to their destination. Supporting an internal user starting an application requires a separately reviewed eligibility/auth change; a menu link cannot implement it safely.
- Preserve authorized task deep links through authentication where the existing identity flow supports them. First inventory callback behavior before promising return-to-task; add a same-origin, allowlisted, permission-rechecked return destination if absent. Do not replace working post-login defaults with unvalidated remembered URLs.

## Cohort context and task-to-task continuity

### Cohort switching

Existing refinement: use **Cohort** consistently, show the selected name and lifecycle status even with one option; do not say `Current cycle` while displaying an archive. Retain `cycleId`, legacy `cycle` parsing, contradictory-selector rejection, and explicit unauthorized-cohort refusal in [workspace-cycle.ts](../../../src/lib/workspace-cycle.ts).

New behavior, P1: offer all cohorts the user can access in the cohort selector. If the current surface is unavailable in the chosen cohort, navigate to its authorized role home and say **“Opened My work for [cohort]. Cohort settings is unavailable for your role here.”** Use destination-specific copy. This requires a server-authorized destination resolver; it is not a client-only expansion of the current options list. Keep today's restricted selector until that resolver is implemented.

Existing switch behavior already sends entity routes back to relevant parent workspaces and strips `assignment`, `event`, and `return`. Preserve it. Audit retained query/hash values: `returnTo`, selected applicant IDs, and anchors can also contain old-cohort context. Reset entity-specific selection and batch selections; preserve only meaningful list filters. Do not transplant a round, dossier, assignment or selected applicant into a different cohort. Announce the new cohort and land focus at the page heading.

### Handoff contracts

1. **Applicant save → submit → status:** saved draft receipt remains visible in intake. Only a confirmed submission lands in status with **Application received**. An ambiguous response keeps recovery/verification controls; navigation cannot manufacture a receipt. Released decisions and delivered messages remain separate facts.
2. **My work → calibration → evaluation:** preserve the selected cohort and intended assignment. Existing calibration `return` support is retained, but validated as an allowlisted internal destination, not just by prefix. On completion, return to that task when still eligible; otherwise **Back to My work** with the reason it is no longer actionable. No new calibration sidebar item.
3. **Reading queue → review → next review:** existing screening receipt already supplies `nextAssignmentId` and auto-navigation. Add a compact persistent strip with **My work / Read applications / [candidate code]**, cohort, and **Reading queue**. Keep blind candidate codes; do not add directory/search shortcuts that expose identity. Announce the confirmed prior submission on the next view. Recusal returns safely to queue; unconfirmed action stays in recovery.
4. **Round grading → confirmed save → next applicant:** retain dedicated atomic Speed Dating and Group Case flows. Provide **Back to My work** and an always-visible cohort/round label. Saved observations must not be relabeled as locked evaluations; Group Case's persistence `SUBMITTED` is not itself immutable completion (explicitly documented in member home source).
5. **Attention filter → dossier → next dossier → filtered list:** keep [dossier-navigation.ts](../../../src/app/admin/applications/[id]/dossier-navigation.ts)'s filter-aware previous/next and validated `/admin` return target. Never replace this with a generic back button. Decisions currently open dossiers without that return context; extending dossier return origins to Decisions or Review oversight is **new behavior** requiring a bounded allowlist and correct queue ordering. Until implemented, label the destination honestly **Back to Applicants**.
6. **Decisions → release evidence → release → delivery:** retain explicit evidence/release screens and permission checks. A released outcome may still have a failed email. Provide a delivery follow-up link only for authorized operators; do not put `Release and send` in navigation or collapse both into `Complete`.

## Attention, mobile and search

One authoritative task-count meaning is needed before emphasizing badges. **My work · N** should mean actionable personal tasks in the selected cohort, excluding the same task counted again as a calibration prerequisite and evaluation. Counts on **Read applications** represent unread assigned reviews. They need not sum to the home count; explain different units through accessible labels. Failed/unknown context loads must not claim **0 tasks** or **You're up to date**. Navigation remains usable with a neutral **Task status unavailable** notice and retry.

Keep urgent work visible as rows on My work and as a compact **Needs attention** list on Applicants; no extra top-level inbox. Use orange ink for attention counts with text labels, blue for selected destinations, and white focus on the blue brand band. Avoid decorative counters and score-like attention totals. Do not count attendance or chats as evaluation evidence.

Mobile keeps the labeled **Menu** and the same group order; no five-tab bottom bar for a role-dependent tree. Put the selected cohort in the closed header, with the name allowed to wrap. Opening Menu exposes full readable labels, cohort selection and account actions; keep 44px targets, keyboard operability, Escape and focus return. Preserve correct focus order and ensure collapsed links cannot receive focus. If implemented as an overlay, contain focus and make covered content inert; if it remains an inline disclosure, do not add modal semantics. Verify both at 320px and with long cohort/account names. Keep action/status controls visible in task content when Menu is closed.

No global command palette in this proposal. The tree is small enough to group, and a global applicant search could undermine blind review. Keep existing local applicant/roster/directory search. A future **Find applicant** tool would need evidence of repeated cross-surface retrieval needs, server-side permission/cohort scoping and explicit exclusion from blind-review contexts; it should not become a prerequisite for finding an urgent assignment.

## Priorities, dependencies and acceptance criteria

| Priority | Concrete change | Dependencies | Acceptance criteria |
|---|---|---|---|
| P0 | Fix orientation without replacing routes: group personal work, rename operator labels, add focused-work breadcrumbs/return links. | Capability map in `workspace-nav.tsx`; applicant/member specialists confirm local terms. | Each supported role has one unambiguous parent for every task. Screening detail/calibration show cohort and safe exit. My work never routes to operator review. Direct active-work links remain visible. |
| P0 | Preserve receipt/state semantics across navigation. | Existing draft, evaluation, screening, release and delivery contracts; source-reviewed policy constraints. | Saved, submitted/locked, released, and delivered each have distinct copy. Unknown writes cannot trigger success or automatic next-task navigation. Submitted evaluations stay immutable; no new score weights/quorum or conflict exemptions. |
| P0 | Regression inventory for existing deep links and cohort context. | `workspace-cycle-url.ts`, auth routing, legacy redirects, dossier navigation. | Legacy round and notification URLs still land correctly with selected cohort; old assignment/filter links remain usable or return with an explanation. Unauthorized explicit cohorts never silently become another cohort. Dossier next/back preserves query, status/resume filters and stage-board context. |
| P1 | Make task counts agree in meaning; retain useful closed-work access. | `workspace_context` RPC and local task derivation must agree on units and availability. | Fixtures cover calibration + assignment, active screening isolation, simultaneous rounds, closed Group Case, no work and failed load. Zero is shown only for known empty work. No identity-bearing task rows reach blind readers. |
| P1 | Add cross-capability cohort switching and safe unsaved-work exit handling. | Authorized destination resolver; entity/filter reset rules; existing save/recovery states. | Owner in A/member in B can discover B and land on B's My work; no A permissions/IDs/selections leak. Unsaved/unconfirmed work offers existing save/retry/download recovery before an explicit leave; confirmed work needs no gratuitous confirmation. |
| P1 | Connect permitted origin queues to dossier return paths. | Allowlisted origin model and permission/ordering checks; no arbitrary return URL. | From Decisions, next/back follows only that authorized queue. Existing Applicants behavior remains intact. Cohort changes invalidate old queue membership. |
| P2 | Account shortcuts to profile/availability and authorized applicant history. | Stable disclosure anchors; dual-role eligibility review. | Anchors open/focus their content. Applicant shortcut appears only when authorized; no new application eligibility is inferred from an internal role. |

Implementation should adapt [workspace-navigation.test.ts](../../../src/lib/workspace-navigation.test.ts), [workspace-nav.test.ts](../../../src/components/workspace-nav.test.ts), [workspace-cycle-url.test.ts](../../../src/lib/workspace-cycle-url.test.ts), auth routing and dossier-navigation tests. Parent-owned browser verification should exercise existing [cohort selection](../../../tests/e2e/cohort-workspace-selection.spec.ts), [member continuity](../../../tests/e2e/member-work-continuity.spec.ts) and [Group Case navigation](../../../tests/e2e/group-case-navigation.spec.ts) journeys, then the narrow-screen menu, focus and long-label cases above. This report did not run these tests or claim they pass.

## Deliberate cuts and questions for validation

Cut a new universal home, separate applicant list route, separate event calendar route, duplicate board grading menus, permanent empty onboarding/history tabs, an active `More` menu, and a global command palette. Retain the real capabilities under their canonical parents. No new notifications system, gamification, or consolidated completion percentage.

Validate these hypotheses in the parent's walkthrough: whether operators understand `Review oversight`; whether panel-only users need `/admin` as a starting page rather than Decisions; whether members discover profile/availability from account utilities; whether focused-work breadcrumbs are sufficient without the full sidebar; and whether long active-work lists require a later grouping refinement. These are design hypotheses, not reported user findings or promised measurable improvements.
