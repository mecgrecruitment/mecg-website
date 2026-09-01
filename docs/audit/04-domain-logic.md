# Section 4 audit: rush/recruitment domain logic

## Verdict

The pure scoring math in `evaluation.js` is correct and well tested against
`RUSH_PLATFORM_PLAN.md`'s formula, N/O handling, and the 75%-coverage rule, and
the blind application-screening subsystem (`screening.ts` +
`20260824160000_blind_screening.sql`) is a genuinely careful implementation of
pseudonymous review with server-side re-validation. But the same business
rules (status transition tables, the weighted-score formula) are hand-written
three separate times across `src/lib/workflow.ts`, `evaluation.js`, and
several `supabase/migrations/*.sql` functions, and one of those copies has
already drifted (a finalized round can never be archived through the admin
UI even though the database explicitly allows it). More seriously, the Hash
decision-panel pages (`/admin/hash`, `/admin/hash/deliberate`,
`/admin/applications/[id]`) do not implement the blind-deliberation design at
all: any Panel-only member sees applicants' real names, contact info,
LinkedIn, resumes, and **which named evaluator gave which score**, directly
contradicting the plan's explicit "applicant code instead of name" and "no
evaluator identity during the first review" requirements. The plan is not
stale here — the blind-screening code proves the team knows how to build
this; Hash just never got the same treatment. `npm test` passes cleanly
(42/42), but the suite only proves the TypeScript-side transition tables are
internally consistent, not that they still match the SQL functions that
actually enforce the rules in production.

## State transition tables (as implemented)

### Cycle (`workflow.ts` `CYCLE_TRANSITIONS`, mirrored in `rush.set_cycle_status`)
`DRAFT -> OPEN -> IN_PROCESS -> DECISION_LOCK -> CLOSED -> ARCHIVED`, strictly
linear, no skips, no reopen. Same-state "transition" is always allowed
(idempotent write). SQL adds one extra guard TS doesn't know about: entering
`DECISION_LOCK` requires every round to be `FROZEN`/`FINALIZED`
(`20260821150000_board_functions.sql:74`).

### Round (`workflow.ts` `ROUND_TRANSITIONS` vs. `rush.set_round_status`)
TS: `DRAFT -> PUBLISHED -> ACTIVE -> FROZEN -> FINALIZED -> []` (terminal).
SQL (authoritative, `20260821150000_board_functions.sql:59`): the same chain
**plus** `FINALIZED -> ARCHIVED`, and it additionally gates
`PUBLISHED -> ACTIVE` on the cycle being `IN_PROCESS` and
`ACTIVE -> FROZEN` on the cycle being `IN_PROCESS` or `DECISION_LOCK`. The enum
`rush.round_status` (`20260821090000_rush_foundation.sql:9`) includes
`ARCHIVED` as a real value. See Finding HIGH-1 below.

### Application (`workflow.ts` `APPLICATION_TRANSITIONS`, matches
`rush.set_application_status` in `20260830090000_recruitment_committee_role.sql:19`)
`DRAFT -> SUBMITTED -> {NEEDS_INFO, ELIGIBLE}`, `NEEDS_INFO -> {SUBMITTED, ELIGIBLE}`,
`ELIGIBLE -> INVITED -> IN_PROCESS -> FINAL_REVIEW -> []` (manual transitions
stop here). `OFFERED`/`WAITLISTED`/`REJECTED`/`WITHDRAWN` are terminal and
reachable only through a locked `Decision`, never through this table — that
matches the plan ("An Application moves to Offered, Waitlisted, or Rejected
only when its linked Decision locks"). This copy currently agrees with the
SQL copy exactly, plus the SQL layer adds a role check the TS layer has no
concept of: `RECRUITMENT_COMMITTEE` is blocked from writing an outcome/withdrawal
status even if it somehow reached this function (line 21), matching
`SUPABASE_FULL_FUNCTIONAL_PLAN.md`'s Recruitment Committee role boundary.

### Screening batch/packet/assignment (SQL only, `20260824160000_blind_screening.sql`)
`ScreeningBatch`: `DRAFT -> PUBLISHED -> FROZEN`. `ScreeningPacket`:
`PENDING -> {APPROVED, REJECTED}` (re-editable back to `PENDING` on content
update). `ScreeningAssignment`: `ASSIGNED -> {SUBMITTED, RECUSED} -> LOCKED`.
No TS mirror exists for this state machine; it lives only in SQL and has its
own pgTAP-style guards (three-reviewer minimum, capacity, conflict exclusion,
exact-reviewer-count-per-packet).

### Decision (plan only — not implemented as a named state machine in `src/lib`)
The plan specifies `Pending -> Discussing -> Approved -> Locked -> Released ->
Superseded`. There is no `DECISION_TRANSITIONS` table anywhere in
`src/lib` (searched `workflow.ts` and all of `src/lib`) — decision-lifecycle
legality lives entirely in board-decision SQL functions not in this audit's
file list. This is a real gap in the "core domain logic" layer this task was
asked to review: none of the pure, testable transition logic for the single
most sensitive workflow (final decisions) lives in `src/lib`.

## Scoring pipeline (plain-language)

1. **Per-criterion rating**: 1–5, or `null` for "not observed" (`N/O`).
   Required (essential) criteria cannot be `N/O`.
2. **Per-evaluation score** (`scoreEvaluation`, `evaluation.js:1`): for each
   observed integer 1–5 rating, contribute `weight * (rating-1)/4`; sum and
   divide by the sum of *observed* weights, times 100. Coverage =
   observed-weight / total-weight. Evaluation is invalid if coverage < 75% or
   any required criterion is unobserved. This matches
   `RUSH_PLATFORM_PLAN.md`'s formula and 75% rule exactly, and matches the
   independently-hand-written SQL copy in `rush.submit_evaluation`
   (`20260831180000_release_audit_fixes.sql:32`) and in
   `rush.submit_screening_review` (`20260824160000_blind_screening.sql:239`,
   simpler because that form has no `N/O` option).
3. **Per-round aggregate** (`aggregateRound`, `evaluation.js:30`): needs ≥2
   valid evaluations or the round is `PENDING` (never treated as zero, per
   plan). Arithmetic mean of valid scores; flags `REVIEW` when
   `max - min >= 25` (matches the plan's 25-point spread trigger exactly, `>=`
   not `>`, verified by test).
4. **Final score** (`combineRoundScores`, `evaluation.js:48`): weighted mean
   over rounds with `weight > 0`; if *any* positively-weighted round lacks a
   score, the whole combination is `null` (pending), never silently
   partial. Zero-weight rounds (e.g. blind screening feeding into decisions)
   are excluded from both numerator and denominator, which is what the test
   suite documents as "ignores weight-0 rounds such as blind screening."
5. All three formula copies divide safely: coverage is computed before the
   weighted-sum division, so an all-`N/O` submission produces `coverage=0` and
   is rejected before any `0/0`.

## Findings

### HIGH Hash decision panel exposes real names, contact data, and evaluator identity
`src/app/admin/hash/page.tsx:23-24,140`, `src/app/admin/hash/deliberate/page.tsx:23,75`,
`src/app/admin/applications/[id]/page.tsx:56-67,131-140,193,266,324`

Any membership with only the `PANEL` role (permissions: `HASH_PANEL_ACCESS`,
`DECIDE`, `RELEASE` — no `MANAGE_CYCLE`, no `RECRUITMENT_OPERATIONS`) passes
the guard `if (!canManageCycle && !canPanel && !canOperate) redirect("/member")`
in `applications/[id]/page.tsx:67` and falls through to the full board
dossier: `person.name`, `person.contact` (email), `person.phone`,
`person.linkedin_url`, and an embedded resume iframe
(`/api/admin/applications/${id}/resume`, itself authorized for `PANEL` at
`20260831120000_resume_document_lifecycle.sql:339`). The same page's
"evaluations" tab, gated only on `canPanel` (line 296), renders
`evaluation.evaluator?.display_name` next to that evaluator's individual
criterion ratings and notes (line 324) — fetched via
`evaluator:profiles(display_name)` at line 138. The Hash board and
deliberation-deck pages likewise render `application.pnms.name` (a real name,
not a code) throughout.

`RUSH_PLATFORM_PLAN.md`'s Hash design is explicit: "The initial panel view
shows: applicant code instead of name where practical; ... no evaluator
identity during the first review," and the Board journey says "Run Hash with
pseudonymous applicant codes ... Only assigned decision-panel members receive
this data." None of that is implemented for Hash — the plan is not stale
here, the code simply never built it, even though the team built exactly
this pattern correctly for blind application screening
(`candidate_code = 'Applicant '||upper(substr(digest(...),1,6))` in
`20260824160000_blind_screening.sql:119`).

**Wrong-outcome scenario**: A Panel member who personally submitted an
unusually harsh Speed Dating score for applicant A can open A's dossier
during Hash, see "Jordan (their own name) — 2/5, 'seemed nervous'" attributed
to a specific colleague, and anchor the panel's discussion on who said what
rather than the evidence — precisely the popularity/social dynamic the
blind-review design exists to prevent. It also means a Panel member with a
personal relationship to an applicant learns that applicant's phone number,
email, and LinkedIn from the Hash workspace even if they never had any other
reason to access that data.

**Smallest fix**: gate `person.name`/`contact`/`phone`/`linkedin_url`/resume
and `evaluator.display_name` behind `canManageCycle || canOperate` (i.e. drop
them for `canPanel`-only viewers), and pass an applicant code instead of
`pnms.name` into the Hash/deliberation list and detail views.

### HIGH Duplicated round-status transition table has drifted: finalized rounds can never be archived
`src/lib/workflow.ts:10-16` (`ROUND_TRANSITIONS`), `src/app/admin/rush-controls.tsx:13,307`
vs. `supabase/migrations/20260821150000_board_functions.sql:59`

`workflow.ts` encodes `FINALIZED: []` — a dead end. The SQL function that
actually performs the transition, `rush.set_round_status`, permits
`FINALIZED -> ARCHIVED`, and the `rush.round_status` enum
(`20260821090000_rush_foundation.sql:9`) defines `ARCHIVED` as a real value.
`rush-controls.tsx`'s own `ROUND_STATUSES` constant (line 13) does not even
list `ARCHIVED`, and its dropdown is additionally filtered through
`canTransitionRound` (line 307), so the option can never appear regardless.

**Wrong-outcome scenario**: A Board member finishes a cycle, finalizes Speed
Dating and Group Case, and later wants to archive those rounds as part of
closing out the cycle (the plan's Phase 5 "read-only archive" step). There is
no UI path to do this — the dropdown for a `FINALIZED` round only ever
contains `FINALIZED` itself. The only way to archive a round is a raw RPC
call bypassing the admin UI entirely, which the codebase gives board users no
tool to make.

**Smallest fix**: add `ARCHIVED: []` reachable from `FINALIZED` in
`ROUND_TRANSITIONS` (`workflow.ts:14`) and add `"ARCHIVED"` to
`ROUND_STATUSES` in `rush-controls.tsx:13`, or better, generate both from the
Postgres enum instead of hand-maintaining three copies of the same table.

### MEDIUM No guard against two simultaneously active cycles
`supabase/migrations/20260821110000_create_cycle.sql:19-27`, `src/lib/cycles.ts:10-27`

`rush.create_cycle` only rejects a duplicate *name* (case-insensitive) and
requires the caller to be an existing `OWNER` once any cycle exists. It never
checks whether another cycle is currently `OPEN`/`IN_PROCESS`. There is no
unique-partial-index or check constraint on `rush_cycles.status` either
(`20260821090000_rush_foundation.sql:24-33`). `selectAuthorizedCycleId`
(`cycles.ts:20-26`) silently resolves "the current cycle" for any caller
without an explicit `requestedCycleId` by picking the *newest* cycle the
caller has the requested permission in, sorted by `createdAt` — it has no
concept of "the one active cycle" and would happily pick a brand-new `DRAFT`
cycle over an `IN_PROCESS` one with live evaluations if the new cycle was
created more recently and the caller has permission in both.

**Wrong-outcome scenario**: An Owner accidentally (or a script) calls
`create_cycle("Fall 2026 Round 2")` while "Fall 2026" is still `IN_PROCESS`
with assignments and evaluations mid-flight. Every admin page that resolves
its cycle via `selectAuthorizedCycleId` without an explicit id (e.g.
`/admin/hash`, `/admin/applications/[id]`, `/admin/rush-controls`) silently
switches to showing the new, empty cycle's data instead of the live one,
with no error and no warning — evaluators assigned in the old cycle would
appear to have nothing to do.

**Smallest fix**: add a partial unique index enforcing at most one
non-terminal cycle (`status not in ('CLOSED','ARCHIVED')`), or have
`create_cycle` raise when such a cycle already exists.

### MEDIUM Essential-criterion "N other criteria" rule is not an explicit invariant, only an accident of current weights
`src/lib/evaluation.js:6-17`, `src/lib/rubrics.ts:1-27`

The plan requires "A Speed Dating form must observe Clear Communication plus
at least two other criteria. A Group Case form must observe Collaboration and
Inclusion plus at least three other criteria." The code implements only two
independent checks: a boolean `required` flag per criterion (`missingRequired`
in `evaluation.js:11-13`) and a 75%-of-*weight* coverage floor. There is no
check on the *count* of additional observed criteria. With the current fixed
weights in `rubrics.ts` (Speed Dating: 25/20/20/20/15; Group Case:
20/20/25/15/10/10) the 75% floor happens to require at least three other
criteria for Speed Dating and roughly three for Group Case — stricter than
the plan, so no wrong outcome today. But `RubricVersion` is explicitly a
first-class, versioned concept in the domain model (plan's
"Data model direction" table), and nothing stops a future rubric edit (e.g.
one non-essential criterion given 60% weight) from letting `coverage >= 0.75`
pass with only one other criterion observed, silently violating the plan's
explicit minimum-evidence rule with no test or runtime guard to catch it.

**Smallest fix**: add an explicit `minimumOtherObserved` (or equivalent
per-round constant) check in `scoreEvaluation`/`submit_evaluation`, independent
of weight coverage, and a test that pins it.

### MEDIUM `screeningRpc<T>` casts an untyped RPC response with no runtime validation
`src/lib/screening-rpc.ts:1-7`

```
export function screeningRpc<T>(client: unknown, name: string, args?: Record<string, unknown>) {
  return (client as RpcClient).rpc(name, args) as RpcResult<T>;
}
```

Both casts (`client as RpcClient` and the return `as RpcResult<T>`) are
unchecked; the caller supplies `T` and nothing at the boundary confirms the
Postgres function actually returns that shape. `ScreeningOverview`,
`ScreeningDetail`, and `authorize_resume_access`'s `string` result
(`src/app/api/admin/applications/[id]/resume/route.ts:11`) all flow through
this with zero parsing. Per the `typescript-best-practices` rubric
("Boundary validation... `unknown` over `any`"), this is exactly the pattern
that should parse into a named domain type at the boundary instead of casting.
A migration that renames or reshapes an RPC's return columns (which happened
several times in this migration ledger, e.g. `screening_admin_overview` was
redefined at least twice) would not be caught by the type checker or by any
runtime check — it would only surface as a UI rendering `undefined`.

**Smallest fix**: at minimum, validate the RPC error shape and the presence
of expected top-level keys before casting; ideally parse with a schema
(zod/valibot) per the `SUPABASE_FULL_FUNCTIONAL_PLAN.md` requirement that
sensitive reads be "purpose-built read functions" with typed boundaries.

### LOW `submit_evaluation`'s returned score is computed but never shown or used
`src/app/api/member/evaluations/[assignmentId]/route.ts:42`, `src/app/member/evaluation-form.tsx`

The RPC computes and returns `score`, the route echoes it in the JSON
response (`{ id, score }`), but `evaluation-form.tsx` discards the response
body entirely (only checks `response.ok`). This isn't a leak (members are
allowed to see their own numeric conversion), just dead computation/data —
worth deleting or wiring up, since a future change that "fixes" the SQL
formula could silently start showing a member a stale-relative-to-`evaluation.js`
number if this ever gets displayed without the two formulas being audited
together.

### LOW `hasExactCriterionSet` is exported, tested, and never called from production code
`src/lib/workflow.ts:240-247`

Grepping all of `src/` outside tests finds no caller. The actual "every
criterion exactly once" check is re-implemented inline in
`rush.submit_evaluation` (`count(*) <> expected_count` at
`20260831180000_release_audit_fixes.sql:75-80`) and in
`rush.submit_screening_review` (`20260824160000_blind_screening.sql:236`).
Not a bug, but it means this function's own unit test coverage gives false
confidence that the rule is exercised end-to-end — it only proves the
never-invoked TS copy is correct in isolation.

### LOW Late evaluation submissions are hard-rejected, not routed to review, contradicting the plan
`supabase/migrations/20260821130000_member_functions.sql:23-25` (superseded by the same check in `20260831180000_release_audit_fixes.sql:54`)

The plan says "Late forms enter a review queue. Client timestamps cannot
backdate them." The deadline check itself is done correctly server-side
(`round_row.closes_at < now()`, never trusting a client-supplied timestamp),
but the outcome on a late submission is `raise exception 'assignment closed'`
— the evaluation is simply refused, with no review-queue concept anywhere in
the schema. Minor scope gap, not a security issue, but a concrete
code-vs-plan disagreement worth a product decision rather than silent
acceptance.

## Test run (verbatim)

`npm test` — final summary:

```
1..42
# tests 42
# suites 0
# pass 42
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 447.840041
```

All 42 tests passed, including `src/lib/evaluation.test.js` (formula, N/O,
spread boundary, zero-weight rounds), `src/lib/workflow.test.ts` (transition
tables, intake/draft parsing), `src/lib/cycles.test.ts`, and
`src/lib/screening.test.ts` (max-flow assignment, conflict exclusion,
capacity, reproducibility). No test in this suite exercises the SQL
transition/scoring functions directly (that would need `supabase/tests` and a
live Postgres instance, which `npm test` does not start), so the drift
described in HIGH-2 above is invisible to this test run by construction.
