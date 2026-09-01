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

Decided: yes. See section 9 for the schema and the public/private split this needs.

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

## 9. The person spine

Decided: one person record spans cycles, and the member portal grows into the org's year-round system. Both of those rest on the same schema change, so it comes first.

Today identity is split and both halves are cycle-scoped:

- `rush.profiles` is one row per auth user, holding `display_name` and `active`.
- `rush.pnms` is one row per applicant per cycle. Reapplying next year creates a second unrelated row.
- `rush.memberships` ties a profile to a cycle with a role, so "is this person in the org" is only answerable per cycle.

Target: a `people` table as the single identity anchor. `profiles` and `pnms` both point at it. A person can be an applicant in Fall 2026, a member in Winter 2027, and a board member in Fall 2028, and that is one row with three relationships rather than three strangers.

What this unlocks that nothing else can:
- Reapplicant history visible on the dossier: applied before, how far they got, why.
- The alumni and past-member view that a year-round directory needs.
- One profile that feeds the member directory, the marketing `/team` page, and project staffing.

### The risk this creates, and the guard

Blind screening currently works because reviewer-facing RPCs never join `pnms`. A shared `people` table adds a second path to an applicant's identity, and a careless join through `people` would silently unblind a reviewer.

The guard, decided up front rather than after the incident:
- No screening RPC gains a `people` join. Ever. The existing `search_path = ''` plus `SECURITY DEFINER` pattern stays.
- Add a pgTAP test asserting that no function reachable by a screening reviewer selects from `people` or `pnms`. `supabase/tests/` already exists and pgTAP is already enabled, so this is a test file, not new infrastructure.
- Cross-cycle history on the dossier is gated behind `RECRUITMENT_OPERATIONS`, not `WORKSPACE_ACCESS`.

### Projects and staffing

`src/content/projects.public.ts` becomes a `projects` table plus a `project_members` join to `people`. The marketing `/work` and `/team` pages then read from the database instead of drifting from a hand-edited file. Keep the public/private split explicit: a `public` flag per project, and the marketing query selects only public fields. Client-confidential detail must not be one boolean away from the ISR cache.

---

## 10. Sequence

Each phase ships and reverts on its own.

**Phase 0. Unify the shell.** Move `/admin/*` and `/member/*` under `/portal/*` with redirects. Use `PortalShell workspace` everywhere. One nav array. Delete `BoardNav`, the inline `navLinks`, and both cross-link buttons. No new features, no schema change. Best legibility gain per line touched, and it makes every later phase cheaper.

**Phase 1. Break up the junk drawer.** `/portal/rounds`, `/portal/people`, `/portal/settings`. Still no schema change.

**Phase 2. The person spine.** The `people` table, backfill from `profiles` and `pnms`, the pgTAP unblinding guard, and the cross-cycle history tab on the dossier. This is the riskiest migration in the plan and it belongs here, before anything is layered on top of it, not after.

**Phase 3. Answer the two unanswerable questions.** Audit viewer and per-applicant send log. "Who changed this?" and "Did anyone tell them?"

**Phase 4. Comms engine.** Templates, automatic triggers, bulk send to a filtered segment, batch decision release. `release_decision` gets a batch sibling so decision night is one action rather than sixty.

**Phase 5. Cycle clone plus rubric and question editors.** Setup for the next cycle stops needing a developer and a migration.

**Phase 6. Member year-round.** Task inbox, extended profiles, directory, personal record. Then projects and staffing on the spine from Phase 2, with the marketing pages cut over to read from the database.

**Phase 7. Applicant polish.** Timeline, document center, messages, offer expiry and countdown, withdraw.

---

## 11. Resolved decisions

| Question | Decision | Consequence |
|---|---|---|
| Does the member portal grow past recruitment? | Yes, year-round org system | Projects and staffing move into the database; profiles extend; directory ships in Phase 6 |
| Do applicants keep accounts across cycles? | Yes, persistent person record | `people` table in Phase 2, with an explicit unblinding guard for screening |
| Does comms move into the system? | Yes | Comms engine in Phase 4; sending moves off personal inboxes or the work is wasted |

Still open, and answerable later without blocking Phase 0:

- Retention. A persistent person record means an applicant rejected in 2026 still has a row in 2030. Decide a retention window and a deletion path before Phase 2 ships, not after someone asks for their data back. `prune-resumes` already establishes the cron pattern for this.
- Who on the board owns comms templates day to day. The engine needs an owner or the templates rot.
