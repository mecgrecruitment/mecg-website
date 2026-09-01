# One system: admin, member, recruitment

Brainstorm and organization plan. Grounded in the code at `979616e`, not a greenfield sketch.

---

## 1. What exists today

Four surfaces, four different shells:

| Surface | Routes | Shell | Nav |
|---|---|---|---|
| Marketing | `(marketing)/{home,join,work,team,contact}` | `MarketingSection` etc | site header |
| Applicant | `/apply`, `/applicant`, `/applicant/[token]`, `/checkin/[token]` | `PortalShell` | none |
| Member | `/member`, `/member/screening`, `/member/event` | hand-rolled `<main>` | inline `navLinks` array |
| Board | `/admin` + 8 subpages | hand-rolled `<main>` | `BoardNav` |

Backing model (schema `rush`, 69 migrations, `public` schema already dropped):

- `rush_cycles` -> `rounds` -> `evaluation_assignments` -> `evaluations` -> `criterion_ratings`
- `pnms` -> `applications` -> `application_documents`, `decisions` -> `decision_approvals`
- `events` -> event slots, `checkins`, `member_checkins`, `event_impressions`
- `screening_batches` -> `screening_packets` -> `screening_assignments` -> `screening_reviews`
- `profiles`, `memberships` (per cycle), `case_groups`, `conflict_declarations`
- `audit_events`, `mutation_receipts`, `rate_limits`

Authorization is 8 capabilities over 5 roles in `src/lib/authorization.ts`. Every mutation goes through a `SECURITY DEFINER` RPC (44 of them called from the app). That layer is in good shape and none of this plan needs to touch it.

### What already works well and should not be rebuilt

- Blind screening end to end (candidate codes, reviewer RPCs that never join `pnms`, redaction on frozen batches). This is the strongest thing in the codebase.
- Resume upload with real byte validation (magic number, EOF, encryption, embedded JS scan, SHA-256) plus a cron reaper for abandoned uploads.
- Token check-in (256-bit tokens, SHA-256 at rest, rotatable per event).
- Decision approval chain: `PENDING -> APPROVED -> LOCKED -> RELEASED`, with outcomes hidden from the applicant until release.
- The applicant dossier tabs at `/admin/applications/[id]`.
- Cycle and round state machines in `src/lib/workflow.ts`.

---

## 2. The structural problem

The app is organized by **role**. The domain is organized by **stage of a cycle**.

That mismatch is where all the duplication comes from:

1. **Board members live in two apps.** `/admin` has a button "Evaluation Hub" and `/member` has a button "Board dashboard". A board member who also evaluates crosses that bridge many times a day and has to hold two mental models of where things are.
2. **Three shells for the same person.** `PortalShell` already has a `workspace` variant. `/admin` and `/member` do not use it; they each hand-roll a `<main className="mx-auto flex max-w-7xl ...">` plus a header plus `LogoutButton`. That block is copied across roughly ten pages.
3. **Two nav systems.** `BoardNav` and the `navLinks` array inside `member/page.tsx` both render `PillNav` and both encode capability rules by hand.
4. **`/admin` is a mega-page.** 312 lines covering stats, an attention queue, the pipeline board, the events list, and a `<details>` element titled "Quick actions and cycle settings" that holds cycle status changes, membership grants, round status changes, and evaluator assignment. That collapsed block is a junk drawer, and it is where the highest-consequence actions in the system live.
5. **"Member" means "evaluator during an active rush."** `MEMBER` role grants exactly one capability, `WORKSPACE_ACCESS`, whose only use is reaching evaluation forms. Between cycles a member logs in and sees an empty page. For a system that claims to be the org's home, that is the largest hole.

### The organizing decision

**Merge admin and member into one internal workspace. Keep the applicant surface separate.**

The admin/member split is accidental: same people, same data, same trust boundary, duplicated chrome. Merge it.

The applicant/internal split is real: different RLS posture, no shared data, and every leak in the system would be an applicant seeing internal state. Merging that would save a shell and buy a class of bug. Keep it apart.

So: three shells become two, and one of them is already written (`PortalShell workspace`).

---

## 3. Target route model

```
PUBLIC
  /home /work /work/[slug] /team /contact
  /join                 timeline, FAQ, interest form
  /apply                application (account required)

APPLICANT  (PortalShell, unchanged trust boundary)
  /applicant            status, schedule, offer, survey
  /applicant/[token]    tokened access
  /checkin/[token]      event check-in

INTERNAL  (one shell, one sidebar, items filtered by hasPermission)
  /portal               home: your tasks, next event, cycle pulse
  /portal/evaluate      your assignments            WORKSPACE_ACCESS
    /screening /screening/[id] /event
  /portal/recruit       pipeline + saved views      RECRUITMENT_OPERATIONS
    /applicants/[id]    dossier
    /rounds             rounds, assignment, coverage
    /screening          batch admin
  /portal/hash          deliberation + decisions    HASH_PANEL_ACCESS
  /portal/events        calendar, detail, slots, check-in desk
  /portal/people        directory; roles editable   MANAGE_MEMBERSHIPS
  /portal/settings      cycle, rubrics, questions, comms  MANAGE_CYCLE
  /portal/me            profile, password, conflicts, notifications
```

`/admin/*` and `/member/*` become permanent redirects. Nobody has bookmarks worth breaking, but redirects cost one file.

Nav becomes one array with a capability per entry:

```ts
const NAV = [
  ["/portal",            "Home",       null],
  ["/portal/evaluate",   "My work",    "WORKSPACE_ACCESS"],
  ["/portal/recruit",    "Pipeline",   "RECRUITMENT_OPERATIONS"],
  ["/portal/hash",       "Hash",       "HASH_PANEL_ACCESS"],
  ["/portal/events",     "Events",     "WORKSPACE_ACCESS"],
  ["/portal/people",     "People",     "WORKSPACE_ACCESS"],
  ["/portal/settings",   "Settings",   "MANAGE_CYCLE"],
] as const;
```

`BoardNav`, the inline `navLinks`, and both cross-link buttons get deleted.

---

## 4. Feature brainstorm: board and recruitment operations

Ranked by how much pain each removes, not by how interesting it is to build.

### 4.1 Break up the junk drawer (highest value, lowest risk)

The `<details>` block becomes three real pages:

- **`/portal/rounds`**: create round, publish, activate, freeze, finalize; assign evaluators; a coverage grid showing applicant x evaluator with submitted / open / recused / missed. Today `round-board.tsx` almost does this but is reachable only through two kind-specific URLs.
- **`/portal/people`**: every membership in the cycle, role editing, plus per-person evaluation load, submission rate, declared conflicts, and missed assignments.
- **`/portal/settings`**: cycle status transitions with the legal next states from `canTransitionCycle`, open/close dates, rubrics, application questions, comms templates.

### 4.2 Cycle clone

The single biggest annual time sink. Right now rounds, rubrics, criteria, questions, and the event schedule are seeded by migration (`20260831230000_fall_2026_recruitment_schedule.sql`). That means next fall's setup needs a developer.

Clone last cycle into a `DRAFT` cycle: rounds, rubrics and criteria, application questions, event template with dates shifted, membership roster, comms templates. Carry over nothing applicant-shaped.

### 4.3 Rubric and question editors

`rubrics` / `rubric_criteria` / intake schema all exist in the database with no UI. The board cannot change a scoring criterion or an essay prompt without a migration. A minimal editor (add, reorder, weight, mark required, bump version) removes the developer from the loop. Versioning already exists in the schema, so old evaluations stay pinned to the rubric they were scored against.

### 4.4 Comms center

Today the system sends three emails: application received, contact form relay, decision release. Everything else is somebody in a group chat.

Build:
- **Templates** per trigger, editable, with a preview. `communication_preview` on `decisions` is already the beginning of this idea.
- **Automatic sends**: application received, needs-info request, event invite, RSVP confirmation, event reminder at T-24h, evaluation assigned, evaluation due at T-24h, decision released, offer expiring.
- **Bulk send** to a pipeline segment straight from the filtered applicant list.
- **Send log** per applicant on the dossier, so "did anyone tell them?" is answerable.
- **Batch decision release**: `release_decision` is one call per decision today. Releasing 60 outcomes one at a time on decision night is the wrong shape.

Resend is already wired in `src/lib/email.ts` and fails soft, which is the correct posture for this.

### 4.5 Audit trail viewer

`rush.audit_events` and `rush.mutation_receipts` are written and never read by a human. Add a filterable log, plus a per-applicant "history" tab on the dossier: status changes, who, when, from what. For a process that rejects people, being able to reconstruct a decision is not optional.

### 4.6 Pipeline that scales past 40 applicants

- Multi-select with bulk actions: advance status, assign evaluator, add to a case group, send an email.
- Saved views (URL state is enough; no new table): "missing resume", "no evaluator assigned", "submitted more than 5 days ago", "ready for final review".
- Sort by days-in-stage, not just name. Stale applicants are the ones that fall through.
- Keyboard navigation. `hash/deliberate` already proves the pattern works.

### 4.7 Coverage and calibration dashboard

`docs/RUSH_PLATFORM_PLAN.md` designs calibration (severity adjustment, inter-rater spread, tie handling) and none of it has a screen. Add:
- Assignments outstanding by evaluator, with a nudge button.
- Score distribution per evaluator against the cohort, to surface a rater who scores everyone a 4.
- Spread between evaluators on the same applicant, flagged past a threshold.
- Conflict coverage: applicants whose remaining evaluator pool is too small after recusals.

### 4.8 Exports and archive

One CSV exists (attendance). Add applications, scores, decisions, and a full cycle archive bundle at `ARCHIVED`. The CSV injection guard in `export/route.ts` is already correct; reuse `csvEscape` rather than writing a second one.

### 4.9 Event operations

Exists: create, slots, RSVP, token check-in, rotation, grading toggle, single-event ICS.
Missing: a check-in desk view (live roster, search by name, manual check-in for the person whose phone died), capacity and waitlist on slots, no-show marking, a cycle-wide ICS feed instead of one file per event, and a post-event summary (attended, graded, impressions filed).

---

## 5. Feature brainstorm: member

The rule to apply here: **a member should have a reason to open this between rush cycles.** Everything below is chosen against that test.

### 5.1 Task inbox

One list on `/portal`, ordered by deadline: evaluations due, screening packets waiting, impressions to file after an event, conflicts to declare on a new roster, RSVP requests. Today a member has to visit `/member`, `/member/screening`, and `/member/event` to learn whether they owe anything.

### 5.2 Real profiles

`profiles` holds `display_name` and `active`. Extend with grad year, major, role in the org, photo, and a short bio. This is also what the marketing `/team` page needs, so one edit updates both instead of a content file drifting from reality.

### 5.3 Member directory

Search the org by name, year, project team, committee. Cheap to build on top of 5.2 and it is the most-used feature of every org tool that has one.

### 5.4 Your record

Evaluations submitted, events attended (`member_checkins` already records this), rounds served, conflicts declared. Useful to the member, and useful to the board when picking a panel.

### 5.5 Project and client staffing

`src/content/projects.public.ts` is a static file driving the marketing site. Members have no view of who is on what team. Moving projects into the database and adding a staffing table turns the marketing page into a byproduct of real data and gives members a year-round reason to log in.

Decided: yes. Staffing hangs off `profiles`; see section 9 for why no new identity table is needed, and for the public/private split this requires.

### 5.6 Handbook and resources

Case prep material, rubric anchors (`SCORE_ANCHORS` is already on the member page), onboarding for new members, past deliverable templates. Static MDX is enough; do not build a CMS.

### 5.7 Calendar feed

One ICS URL per member covering their events, their evaluation deadlines, and their buddy slots. The single-event `api/events/[id]/ics` route already has the generation code.

---

## 6. Feature brainstorm: recruitment (applicant-facing)

The applicant portal is the best-designed surface in the app. These are gaps, not a rewrite.

### 6.1 Timeline instead of a stepper

`StatusStepper` shows four stages. Applicants ask "what happens next and when". Show the dated schedule for the cycle with their position on it, past items dimmed, next item with a date and a location.

### 6.2 Document center

Resume replacement before the deadline closes. The full validated upload pipeline exists; it just is not reachable after submission. Also show what the board actually holds: resume, responses, accessibility notes.

### 6.3 Messages

Every email the board sent them, readable in the portal. Removes the "check your spam folder" support load, and pairs with the send log in 4.4.

### 6.4 Offer mechanics

An offer today is accept or decline with no deadline shown. Add an expiry, a visible countdown, and a downloadable decision letter. Add a withdraw button available at any stage, which is both kinder and cleaner than an applicant emailing to ask.

### 6.5 Interest to application

`submit_interest` collects interest on `/join` and nothing connects it forward. Add source attribution, a nurture email when applications open, and a board-visible conversion number: interest submitted, applications started, applications submitted, per source.

### 6.6 Accessibility requests

`accessibilityNotes` is collected at intake and never surfaced. Show the applicant that the request was received, and route it to a named person on the board rather than into a text column nobody reads.

### 6.7 Attendance visible to the applicant

They check in with a token and get no confirmation of what the org recorded. Show the list. It is one query and it prevents the "I was there" dispute.

---

## 7. Cross-cutting

| System | Why | Size |
|---|---|---|
| One shell + one nav | Kills three duplicated headers and two nav systems | Small |
| Command palette (`cmd+k`) | Jump to applicant, member, event. The fastest fix for a deep route tree | Small |
| Notification inbox | One table, read by member tasks and applicant messages both | Medium |
| Audit viewer | Data already written, zero read path | Small |
| Comms engine | The largest genuinely new subsystem here | Large |
| Cycle clone | Removes the developer from annual setup | Medium |
| Mobile-first on three screens | Check-in, live grading, and hash all happen on phones in a room | Small |

---

## 8. What not to build

Named explicitly so it does not creep back in:

- **In-app chat.** The org has GroupMe or Slack. Losing that fight costs months.
- **A permissions editor.** Five roles and eight capabilities in one 30-line file is right for a group this size. A UI for editing them is a way to lock everyone out at 2am.
- **Drag-and-drop kanban with persisted positions.** The pipeline order comes from status and days-in-stage. Dragging cards adds a column that means nothing.
- **An analytics warehouse.** Four CSV exports cover every question anyone will actually ask.
- **AI resume scoring.** Bias exposure on a real admissions decision, against a schema that was deliberately built for auditability.
- **Real-time presence and live cursors.** Nothing here is collaborative editing.
- **A native mobile app.** Three responsive screens cover the phone use cases.

---

## 9. Reapplication and the person spine

Requirement: an applicant may reapply next semester.

I traced this against the schema and the routing code rather than assuming. The result splits cleanly: **the database already supports reapplication correctly, and the application layer forbids it.**

### The database is already right

`rush.pnms` is not per-cycle. It is one row per person, globally:

```sql
create table rush.pnms (
  id text primary key ...,
  auth_user_id uuid unique references auth.users (id) on delete set null,
  normalized_contact text not null unique,
  ...
);
create table rush.applications (
  pnm_id text not null references rush.pnms (id),
  cycle_id text not null references rush.rush_cycles (id),
  ...
  unique (pnm_id, cycle_id)
);
```

One person, many applications, at most one per cycle. That is exactly the reapplication model.

The write path honors it. `save_application_draft` resolves the open cycle, reuses the existing pnm and only inserts one when missing, then:

```sql
insert into rush.applications (pnm_id, cycle_id, status, draft_payload)
values (person_id, v_cycle_id, 'DRAFT', payload)
on conflict (pnm_id, cycle_id) do update ...
```

A new cycle means a new application row for the same person. `submit_application` scopes its lookup to `(pnm_id, v_cycle_id)`. `intake_schema` scopes the draft to the currently open cycle. All correct.

The read path is correct too. `applicant_dashboard()` returns every application ordered by `created_at desc`, and `applicant/page.tsx` already renders one card per application labeled with `cycle_name`. `applicant_schedule()` uses `distinct on (a.cycle_id)` and filters to `c.status in ('OPEN','IN_PROCESS','DECISION_LOCK')`, so a closed prior cycle contributes no stale events. Someone already thought about multiple cycles here.

### The bug: routing makes reapplication unreachable

`rush.is_applicant()` asks "have you ever applied", not "do you have live business":

```sql
select exists(
  select 1 from rush.pnms p
  join rush.applications a on a.pnm_id = p.id
  where p.auth_user_id = auth.uid() and a.status not in ('DRAFT', 'NEEDS_INFO')
);
```

That feeds `resolveAuthDestination`, where `hasApplication` true routes to `/applicant`. And `apply/page.tsx` opens with:

```ts
const destination = await currentDestination();
if (destination && destination !== "/apply") redirect(destination);
```

So a student rejected in Fall 2026 who returns in Winter 2027 is redirected to `/applicant`, shown last cycle's rejection, and has no route to a new application. Permanently. The one flow the requirement names is the one flow the router forbids.

### The fix

Change the question from "have you ever applied" to "is there an open cycle you have not applied to yet". Three small edits, no schema change, no data migration:

1. Add `rush.can_start_application()`: true when a cycle is OPEN and within its window and the caller has no application row for that cycle. This mirrors the cycle selection already written in `save_application_draft` and `intake_schema`, so reuse that predicate rather than writing a fourth copy.
2. In `resolveAuthDestination`, prefer `/apply` when that is true, and fall back to `/applicant` when the caller has past applications. Memberships keep priority, so an accepted applicant who became a member still lands in the workspace.
3. On `/applicant`, when a new cycle is open, show a "Applications for {cycle} are open. Start a new application." card linking to `/apply`. Without it the returning applicant has no way to discover the new cycle.

`src/lib/auth-destination.test.ts` already exists and is pure, so the routing table for these cases is a test-only change on the app side.

### The person spine already exists

I previously recommended a new `people` table for cross-cycle identity. That was based on a wrong reading of `pnms` and it is not needed. The anchor is already there:

- `rush.profiles.id` **is** `auth.users.id`.
- `rush.pnms.auth_user_id` references `auth.users.id` and is `unique`.

So `profiles.id = pnms.auth_user_id` is the join, and an applicant who becomes a member is already one identity in two tables. Cross-cycle applicant history is a query against `applications` grouped by `pnm_id`, available today. The member directory and project staffing from section 5 hang off `profiles`, which needs new columns, not a new anchor table.

This deletes the riskiest migration in the plan. It also deletes the unblinding risk that migration would have created, since no new join path to applicant identity gets introduced. Keep the pgTAP guard anyway as a regression test: it is a test file, and screening staying blind is worth pinning.

The one real identity gap left: a person who applies with a personal address and later joins with a umich address is two `auth.users` rows. That is an account merge tool, small and rare, not a schema problem. Defer until someone hits it.

### Two things to check before launch

- `rush.application_portal_allowlist` currently holds exactly one address (`rbhavan@umich.edu`, noted "Portal closed to everyone else pending launch"). `application_portal_allows` returns false for everyone else, so **no applications can be submitted at all** until that row is removed or the allowlist is filled. This blocks first-time applicants and reapplicants alike.
- Reapplication needs a stated policy, not just a working button: may an applicant who declined an offer reapply, and does the board see prior-cycle history when scoring? The data supports either answer. Section 4.5's audit viewer is where prior history would surface, gated behind `RECRUITMENT_OPERATIONS` so screening reviewers never see it.

---

## 10. Sequence and status

Branch `fix/applicant-reapplication` carries Phases 0 through 3.

**Phase 0. Fix reapplication. Done.** `rush.can_start_application()` (migration `20260901000000_allow_reapplication.sql`), routed on in `resolveAuthDestination`, `/applicant` guard relaxed so history stays reachable, both pages cross-linked. Routing cases went 5 to 11; 5 new pgTAP assertions.

**Phase 1. Unify the shell. Done, with one deviation.** `WorkspaceHeader` and `WorkspaceNav` now back all 12 workspace pages. `admin/board-nav.tsx`, the inline `navLinks` array, and both cross-link buttons are deleted. Round filtering moved from the global nav onto the member page, where it filters something.

The deviation: **routes stayed at `/admin/*` and `/member/*` rather than moving to `/portal/*`.** The move touches 90 string references plus the proxy matcher and the `AuthDestination` union, all of it in the auth-routing surface, and it buys nothing a user can see once the shell and nav are shared. The duplication this phase existed to kill is gone either way. If the tidier tree is worth that churn, it is a mechanical follow-up that can happen any time; it is no longer blocking anything.

**Phase 2. Break up the junk drawer. Done.** `/admin/people`, `/admin/rounds`, `/admin/settings`. `rush-controls.tsx` became a shared `useRushAction` hook plus four focused components instead of one 327-line default export. Each page gates on the capability its actions need, so Settings is unreachable without `MANAGE_CYCLE` rather than merely collapsed. The pipeline page dropped its memberships query.

**Phase 3. Audit viewer. Done.** `/admin/audit`: cycle-wide, newest first, filterable by resource, paged. No migration needed, the table and its read policy and index already existed. Per-applicant history turned out to already exist on the dossier, so only the cycle view was missing.

### Not started

**Phase 4. Comms engine.** Templates, automatic triggers, bulk send to a filtered segment, batch decision release. Still the largest new subsystem here, and still the one that only pays off if sending actually moves off personal inboxes.

**Phase 5. Editors done. Cycle clone not started.** `rush.set_application_questions` / `cycle_application_questions` (migration `...010000`) with an editor on `/admin/settings`, and `rush.set_rubric_criteria` / `cycle_rubrics` (migration `...020000`) with a per-round editor on `/admin/rounds`. Prompts, criteria, weights and required flags are all editable without a deploy.

The rubric editor is versioned rather than destructive: `criterion_ratings.criterion_id` references `rubric_criteria` with no cascade, so editing a scored rubric would either fail on the foreign key or silently rewrite what a past score meant. When the current rubric has any evaluation against it the RPC publishes version + 1; otherwise it edits in place. Editing is refused once a round leaves DRAFT or PUBLISHED.

Cycle clone turned out to be worth less than the plan assumed: `rush.create_cycle` already seeds both rounds, both rubrics with full criteria, and a default question set via `rush.seed_cycle_questions`. A new cycle is not empty. Clone would only carry forward *edited* content and the roster, which is worth doing but was never the thing standing between the board and next semester. The missing editors were.

**Phase 6. Member year-round.** Task inbox, extended `profiles` columns, directory, personal record, then projects and staffing.

**Phase 7. Applicant polish. Withdraw done, rest not started.** `rush.withdraw_application` (migration `...030000`) plus a two-step button on the portal.

WITHDRAWN was an unreachable status: it is in the enum, four guards check for it, and the portal already renders an "Application withdrawn" branch, but `set_application_status` refuses the outcome statuses and no applicant-facing RPC existed. Every one of those guards was dead code. Withdrawal stays off `set_application_status` on purpose, since staff withdrawing someone on their behalf is the ambiguity that refusal was protecting against.

Still open here: timeline with dates, document center, messages, offer expiry and countdown.

---

## 11. Decisions

| Question | Decision | Status |
|---|---|---|
| Does the member portal grow past recruitment? | Yes, year-round org system | Phase 6, not started |
| Do applicants keep accounts across cycles? | Yes | Already true; only routing needed fixing. No `people` table required |
| Does comms move into the system? | Yes | Phase 4, not started |
| May applicants reapply next semester? | Yes | Done |

Open, and none of it blocking:

- **The launch allowlist.** `application_portal_allowlist` holds one address. Clear it before applications open or nobody can apply, first-time or repeat.
- **Reapplication policy.** May someone who declined an offer reapply? Does the board see prior-cycle history while scoring? The plumbing supports either.
- **Retention.** A persistent `pnms` row means a 2026 applicant still exists in 2030. `prune-resumes` is the cron pattern to copy.
- **Comms ownership.** Phase 4 needs a named owner on the board or the templates rot.

## 12. Unverified

Everything above was checked with `tsc`, `eslint`, `npm test` (42 passing) and `next build`. Two things were not, because this machine has neither the Supabase CLI nor Docker:

- Four migrations have never run: `20260901000000_allow_reapplication`, `20260901010000_application_question_editor`, `20260901020000_rubric_criteria_editor`, `20260901030000_applicant_withdraw`.
- The pgTAP file went from 99 assertions to 130 and none of the 31 new ones have executed. Run `npm run test:supabase` and `npm run verify:auth` against a real project before merging. This is the single largest piece of unverified work on the branch.
