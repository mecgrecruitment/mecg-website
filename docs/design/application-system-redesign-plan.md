# MECG application and Board system redesign

Status: proposed master plan

Source baseline: commit `3159bb8`

Research source: [`liquidslr/system-design-notes`](https://github.com/liquidslr/system-design-notes) at commit `9d8388721e7231442763ad37398b8d82224aa68f`

## Outcome

MECG should feel like one recruiting system with four clear jobs:

- a public site proves what MECG does;
- an applicant completes the process and always knows what happens next;
- a member sees assigned work and finishes it without hunting through pages;
- the Board runs the cycle, sees problems early, and can recover when a device or provider fails.

The website does not have a scale problem. It has a clarity, live-event reliability, and operator-confidence problem. Keep one Next.js application and one Supabase PostgreSQL database. Improve the product structure, query contracts, command safety, recovery behavior, and monitoring before adding more infrastructure.

This plan coordinates the existing detailed plans:

- `docs/SITE_AND_PORTAL_REDESIGN_PLAN.md` owns the public visual direction and page-level interface rules.
- `docs/ALL_IN_ONE_SYSTEM.md` owns the move toward one internal workspace.
- `docs/design/grading-experience-plan.md` owns application review and evaluator work.
- `docs/design/pipeline-kanban-plan.md` owns the recruitment board.
- `docs/design/group-case-grading-plan.md` owns live Group Case grading and Excel recovery.
- `docs/architecture.md` owns the current trust boundaries.

Use this document to decide build order and the system changes shared by those plans.

## What the system-design notes contribute

The source repository uses a four-step method: define scope, draw the high-level design, study the risky parts, then name limits and follow-up work. That method is more useful to MECG than copying any one large-system architecture.

| Source topic | MECG use | MECG decision |
| --- | --- | --- |
| Scope and estimates | Size the live recruiting burst before choosing tools | Write down a conservative event envelope and load-test it. |
| Stateless web tier | Keep requests safe across Vercel instances | Store durable state in PostgreSQL, not in server memory. |
| Caching | Reduce repeated reads | Cache public content and stable rubric data. Do not cache permission or live workflow state. |
| Search autocomplete | Return a small set of fast matches | Use normalized PostgreSQL search and indexes. Do not build a trie service. |
| Reservation concurrency | Prevent double claims and stale edits | Use unique constraints, idempotency keys, and version checks in database transactions. |
| Notification system | Separate business commits from provider delivery | Extend the existing notification outbox, retry leases, and deduplication keys. |
| Message delivery | Pick an honest delivery guarantee | Use at-least-once work with idempotent consumers. Do not promise exactly-once delivery. |
| Metrics and alerts | Detect failure before a Board member reports it | Record low-cardinality metrics, define thresholds, and link every alert to a runbook. |

The notes discuss millions of users, message brokers, distributed caches, and separate services. MECG should reject that scale of machinery. It would create more failure points than it removes.

## Current system facts

At the baseline commit, the repository has:

- 43 page routes;
- 58 API routes;
- 123 ordered database migrations;
- 98 application and script test files;
- one Next.js deployment on Vercel;
- one Supabase project for PostgreSQL and private files;
- Clerk for identity;
- Resend for email;
- three scheduled maintenance jobs.

Regenerate the counts with:

```bash
find src/app -name page.tsx | wc -l
find src/app/api -name route.ts | wc -l
find supabase/migrations -maxdepth 1 -type f -name '*.sql' | wc -l
find src scripts -type f \( -name '*.test.ts' -o -name '*.test.js' -o -name '*.test.mjs' \) | wc -l
```

Keep these strengths:

- PostgreSQL owns workflow state and enforces decisive permissions.
- RLS and security-definer functions protect applicant and evaluator data.
- blind screening keeps identity out of reviewer queries;
- submitted evaluations and locked decisions are immutable;
- resume uploads verify bytes before attachment;
- the notification outbox separates decision state from email delivery;
- route bodies have byte limits;
- public routes use database rate limits;
- CI tests application code, database migrations, browser behavior, and live migration parity.

Fix these structural problems:

- the internal navigation is shared, but the route tree still splits work between `/admin` and `/member`;
- many pages assemble their own view through several direct database queries;
- `WorkspaceNav` runs live data queries on every internal page;
- `/api/admin/rush` handles more than twenty unrelated commands;
- most failures write ad hoc `console.error` records with no request ID or duration;
- the operations page checks dependencies only when an Owner opens it;
- the export route covers attendance, while recruiting-night recovery needs applicants, assignments, ratings, decisions, and Group Case work;
- live pages do not share one connection, refresh, and stale-data contract.

## Size the system for the event, not for the Internet

Confirm the real numbers before load testing. Until then, use this conservative planning envelope:

| Item | Planning value |
| --- | ---: |
| Applicants in one cycle | 500 |
| Internal accounts | 150 |
| Simultaneous live-event users | 100 |
| Active Board operators | 15 |
| Evaluation assignments | 5,000 |
| Draft saves during the busiest minute | 1,200 |
| Applicant files | 1,000 PDFs and images |
| Notification burst after a Board action | 1,000 messages |

Design for the short live burst. Average daily traffic is not the useful number.

Set these first service targets:

- render an internal task page within 1 second at the 95th percentile during the load test;
- return name search results within 200 milliseconds at the 95th percentile;
- acknowledge a workflow command within 750 milliseconds when no external provider is in the request path;
- save a local draft immediately and confirm the server copy within 2 seconds;
- never lose a server-accepted evaluation or decision;
- drain the notification backlog within 10 minutes after Resend recovers;
- restore the core recruiting database within the recovery target approved by the Board.

Measure a baseline before treating any target as achieved.

## Organize the product by the user's job

### Keep four page families

Each family needs its own density and navigation rules.

| Family | Primary question | Interface rule |
| --- | --- | --- |
| Marketing | Why should I trust MECG? | Lead with work, outcomes, people, and one clear action. |
| Applicant | What do I need to do next? | Show a dated timeline, one next action, and saved documents. |
| Internal workspace | What work needs my attention? | Show a task queue, cycle context, and role-based navigation. |
| Live event | Who am I evaluating right now? | Remove global clutter and keep identity, timer, save state, and next action visible. |

Do not force one page template across all four families. Reuse controls, tokens, status language, and recovery states.

### Move toward one internal route tree

Use `/portal` as the eventual canonical internal root:

```text
/portal
  /work
  /recruitment
    /applications/[id]
    /screening
    /pipeline
  /interviews
    /speed-dating
    /group-case
    /rounds/[id]
  /decisions
  /communications
  /events
  /people
  /settings
  /operations
```

Keep `/admin` and `/member` redirects for old links. Do not start with route renames. First make the navigation labels, page headers, and task model consistent on the current routes. Rename routes only after browser tests cover every redirect and return path.

### Make the home page a task list

The internal home page should answer three questions in order:

1. What must I do now?
2. What is happening next?
3. Is the cycle healthy?

Show assigned evaluations, screening work, conflicts, overdue items, and the next event. Board-only cycle statistics belong below personal work. A member should not need to open three sections to learn that no task is assigned.

### Keep one cycle context

Display the active cycle in the workspace header. If a user can access more than one cycle, add a cycle selector there. Every route, query, export, and command must resolve the same selected cycle on the server.

Do not let a query-string cycle ID grant access. The server must intersect the requested cycle with the user's memberships.

## Redesign the core experiences

### Public website

Use the proof-first direction from `docs/SITE_AND_PORTAL_REDESIGN_PLAN.md`:

- open with one precise statement of the work MECG does;
- put verified case studies before general organization claims;
- show the problem, MECG's contribution, and the result for each project;
- separate the client and prospective-member paths;
- keep motion subordinate to content and performance;
- publish only content that passed the existing client and MECG approval boundary.

Do not add a content-management system until approved case studies change often enough to justify it.

### Applicant experience

Replace the generic status stepper with a dated cycle timeline. The first card must show the next action, deadline, location, and save state.

Group applicant work into:

- **Next step** for the one current action;
- **Schedule** for events, RSVP, and rescheduling;
- **Documents** for resume and headshot status;
- **Messages** for sent communications and Board requests;
- **Application** for the submitted read-only copy;
- **Past cycles** for earlier applications.

If an external service fails, keep the applicant's business action separate from the follow-up message. For example, accept an RSVP transaction before attempting its confirmation email.

### Application review

Use the two-pane reading desk in `docs/design/grading-experience-plan.md`. Keep the application visible while the reviewer scores. On a phone, keep separate **Read** and **Score** views with preserved positions.

The system should return one review assignment contract containing the redacted application, rubric version, anchor text, draft, deadline, and navigation IDs. The page should not assemble these pieces through unrelated client requests.

### Recruitment Board

Keep the hybrid Kanban in `docs/design/pipeline-kanban-plan.md`. Add information only when it changes the next action:

- days in the current stage;
- missing document state;
- evaluator coverage;
- conflict or replacement state;
- the next required action.

Add a **Needs action** saved view before adding more dashboard statistics. Board members need a queue they can clear.

Use a durable stage-history record for every move. The record must contain the actor, prior stage, next stage, command ID, and time.

### Speed Dating

Treat the two-person pair as the unit of navigation:

1. Search either applicant's name.
2. Open and claim the pair.
3. Confirm both names.
4. Rate both applicants from 1 through 5.
5. Review both ratings.
6. Submit and return to the search field.

The pair claim transaction must remain the concurrency boundary. A unique active claim prevents two evaluators from owning the same pair. A lease permits recovery after an abandoned device.

Do not expose the full applicant roster before a search. Return a small set of exact and prefix matches. Normalize case, whitespace, punctuation, and accents in one shared function.

### Group Case

Use observation-first grading from `docs/design/group-case-grading-plan.md`. A judge captures short behavior notes during discussion, then completes individual rubrics after the presentation.

Keep the shared group phase on the server. Every judge sees the same phase and scheduled end. Use lightweight polling during the first release. Add a live subscription only if a rehearsal proves that polling cannot meet the phase-change target.

Generate the Excel and CSV emergency files before the event begins. Test import through a preview and an audited transaction. Never overwrite a submitted evaluation.

### Decisions

Build one applicant comparison page that leads with:

- missing evidence;
- agreement by criterion;
- material rating spread;
- conflicts and recusals;
- source notes;
- the locked aggregate after every required round freezes.

Keep approval and release separate. An approval changes internal decision state. Release makes the outcome visible and queues communication.

### Communications

Show templates, audience, schedule, queue state, attempts, and delivery result in one section. A Board member should be able to answer "Was this sent?" without opening logs.

Bulk messages need a preview that names the recipient count and exclusions. The send action creates durable outbox rows in one transaction. Workers perform provider delivery later.

## Use one clear application architecture

```text
Marketing, applicant, member, and Board browsers
                        |
              Next.js pages and APIs
                        |
        authenticated query and command contracts
                        |
        PostgreSQL, RLS, and transactional RPCs
              |                       |
     private file storage       notification outbox
                                      |
                              scheduled worker
                                      |
                                   Resend

Structured operational records flow to logs, metrics, alerts, and runbooks.
Audit events remain in PostgreSQL because they are business evidence.
```

Keep Next.js stateless. A request may run on any Vercel instance. PostgreSQL owns all durable progress, claims, versions, outbox entries, audit events, and import jobs.

## Separate reads from commands

### Give each page one read contract

Create page-level read functions or RPCs for the busiest pages:

- `workspace_context` returns cycle context, permissions, navigation counts, and personal task counts;
- `recruitment_dashboard` returns the cycle pulse and attention counts;
- `pipeline_page` returns a paginated applicant projection with stage and action signals;
- `applicant_dossier` returns authorized identity, documents, evidence summaries, decisions, messages, and history;
- `round_operations` returns assignment coverage and round health;
- `live_event_context` returns phase, assigned people, claims, rubric, and drafts.

The contracts reduce repeated queries and give runtime validation one place to live. They do not create a second database or copy of workflow state.

Use cursor pagination for applicant lists and audit history. Do not send every assignment to the browser to compute five dashboard counts.

### Split the command router by domain

`/api/admin/rush` currently dispatches more than twenty actions. Move each action behind a small domain command handler:

```text
/api/admin/cycles
/api/admin/rounds
/api/admin/applications/[id]/status
/api/admin/assignments
/api/admin/groups
/api/admin/memberships
```

Keep shared work in one command helper:

1. authenticate the user;
2. bound and parse the request;
3. validate the command shape;
4. resolve the resource's real cycle;
5. check the application permission;
6. call one transactional RPC;
7. map the result to a safe response;
8. record duration and result without personal data.

Migrate one action group at a time. Keep the old route as a tested adapter until every caller moves.

### Make important commands idempotent

Require a client-generated command ID for:

- evaluation submission;
- pair claim;
- batch advancement;
- bulk assignment;
- bulk message creation;
- decision approval and release;
- emergency import.

Store the command ID in `mutation_receipts` or the target table under a unique constraint. A retry returns the first result instead of repeating the action.

Disabling a button prevents an ordinary double click. The database constraint prevents the duplicate when two requests arrive anyway.

### Detect stale edits

Add an integer `version` to mutable operator records such as draft rubric configuration, event setup, group membership, and communication templates. Update with both the record ID and expected version.

If another operator saved first, return `409 Conflict`. Show what changed and offer **Reload changes**. Do not silently use last-write-wins for Board setup.

Submitted evaluations, locked decisions, and append-only audit records remain immutable and do not need edit versions.

## Keep search proportional to MECG

Build one normalized search contract for applicants, pairs, people, events, and audit actors.

- normalize with lowercase text, collapsed whitespace, and unaccented comparison;
- index normalized name, email, uniqname, and applicant code;
- return at most ten matches;
- rank exact name and uniqname first, then prefix matches, then contained matches;
- debounce remote searches and cancel stale requests;
- include the stable record ID in every result;
- keep unauthorized records out of the database query, not only out of the rendered list.

At the planning envelope, PostgreSQL indexes are enough. Do not add Elasticsearch, a trie service, or a search analytics pipeline.

## Build for failure during a live round

### Use one save-state contract

Every form that holds meaningful work must display one of these states:

- **Saved** with the server time;
- **Saving**;
- **Saved on this device** when the browser copy is newer;
- **Could not sync** with a retry action;
- **Submitted** when the server locks the record.

Store draft changes locally before the network request. Send a monotonic draft version. The server accepts a newer version and rejects an older one. On reconnect, compare versions before merging.

### Define degraded behavior

| Failure | Continue | Stop | Recovery |
| --- | --- | --- | --- |
| Resend unavailable | Business transactions and outbox creation | Nothing | Worker retries with the same idempotency key. |
| One browser loses the network | Local draft editing | Claims, final submission, and Board commands | Sync after reconnect and show version conflicts. |
| Supabase unavailable | Previously loaded instructions and local drafts | All durable reads and writes | Show status, preserve local work, and retry. |
| Clerk unavailable | Existing valid sessions when supported | New sign-in and identity administration | Use the incident runbook and avoid role changes. |
| File storage unavailable | Text application work | New resume and headshot completion | Keep the pending upload and retry. |
| Notification worker delayed | All recruiting workflow | Time-sensitive provider delivery | Alert on oldest pending item. |

Never present a local-only command as complete. Draft text may be local. A claim, submission, decision, role change, or stage move requires server confirmation.

### Export and restore

Create Board-only, audited exports for:

- applicants and current stages;
- event schedule and attendance;
- evaluation assignments and completion state;
- submitted ratings and evidence after the allowed reveal point;
- decisions and approvals;
- Group Case emergency scoring;
- notification delivery state.

CSV text must keep the existing formula-injection guard. Excel files need stable IDs, rubric versions, protected identity columns, and a `START_HERE` sheet.

Test restoration every cycle. A backup that has never been restored is not evidence that recovery works.

## Finish the notification design already in the code

The existing outbox, leases, retries, provider idempotency keys, and template versions match the source repository's reliable notification pattern. Extend that design instead of adding a new queue product.

Add:

- event invitations and reminders;
- missing-information requests;
- RSVP confirmations and changes;
- evaluation assignment and due reminders;
- offer deadlines;
- Board-visible retry and cancellation reasons;
- per-recipient preferences where policy permits them;
- queue age, attempt count, and terminal failure metrics.

Use at-least-once processing. Every worker must tolerate the same outbox item more than once. Keep provider delivery outside the business transaction.

Run the worker often enough to meet the ten-minute backlog target. A once-daily notification cron cannot support live-event messages.

## Measure the work that can stop recruitment

### Standardize operational records

Replace ad hoc server errors with `operationalLog` calls. Each record needs:

- event name;
- request ID;
- route or job name;
- result category;
- duration in milliseconds;
- retry count when relevant;
- cycle ID only when the log policy permits it;
- no applicant name, email, note text, resume path, token, or secret.

Audit events and operational records have different jobs. Audit events answer who changed business state. Operational records answer whether the software worked.

### Track a small metric set

Track counts and latency by route group and result, not by applicant ID.

- request count, error count, and 95th-percentile duration;
- database probe latency and failure;
- draft save success and conflict count;
- evaluation submission success and conflict count;
- pair claim conflicts and expired leases;
- outbox pending count and oldest age;
- notification attempts, retries, and terminal failures;
- file finalize failures and abandoned uploads;
- scheduled-job last success;
- authenticated browser test last success.

High-cardinality labels make dashboards expensive and hard to read. Put record IDs in restricted logs only when incident response requires them.

### Alert on user harm

Start with these alerts:

- no successful database probe for 5 minutes;
- draft save errors above 2 percent for 5 minutes during an active round;
- evaluation submission errors above 1 percent during an active round;
- oldest due notification above 10 minutes;
- a scheduled job misses two expected runs;
- file finalization errors occur five times in 10 minutes;
- live migration parity fails;
- authenticated staging tests fail on `main`.

Every alert links to one owner and one runbook. Test the alert before relying on it.

## Set interface rules for the whole product

### Make status language consistent

Use one label map for database states. A state must have the same name on cards, filters, timelines, emails, exports, and audit history.

Use verbs for actions and nouns or short phrases for states. **Move to Passed first read** is an action. **Passed first read** is a state.

### Design every page state

Every page must handle:

1. loading;
2. empty data;
3. partial or degraded data;
4. recoverable error;
5. forbidden access;
6. completed work.

A blank panel is not an empty state. Name why the list is empty and the next useful action.

### Preserve context

Search, filters, selected cycle, active tab, and list position belong in the URL when another person can share or revisit the view. Draft text and unsaved ratings do not belong in the URL.

Opening an applicant and returning must restore the same list, filter, and neighboring records.

### Keep live controls reachable

On live grading pages:

- keep the current applicant and save state visible;
- use 44-pixel touch targets;
- support the entire task by keyboard;
- keep focus after save, error, and item movement;
- do not rely on color alone;
- respect reduced motion;
- test at 200 percent zoom;
- keep the primary action above the phone keyboard when possible.

## Performance and cache rules

Measure route payload, database query count, server duration, and browser responsiveness before each redesign phase.

Cache only data that is both read often and safe to be briefly stale:

- approved public project content;
- public event information;
- frozen rubric definitions;
- static design assets.

Do not cache:

- permissions;
- conflicts;
- claims;
- draft state;
- current pipeline stage;
- decision release state;
- notification delivery state.

Consolidate repeated reads before adding Redis. Add database indexes from measured query plans. Do not guess.

Set browser budgets after the baseline:

- load only the JavaScript required by the current workspace;
- keep PDF parsing out of routes that do not display a PDF;
- virtualize or paginate lists above 100 visible records;
- do not load headshot bytes until a card is near the viewport;
- avoid polling on background tabs;
- stop live polling when the round freezes.

## Security and privacy remain design constraints

Keep the current trust model:

- Clerk proves identity;
- the application maps identity to a provider-neutral profile;
- cycle memberships grant application permissions;
- PostgreSQL derives the true cycle and enforces decisive authorization;
- RLS protects direct browser access;
- private storage never receives a public bucket policy;
- blind screening and panel views use codes instead of identity;
- conflicts remove both read and write access;
- exports require explicit permission and write an audit event.

Add a privacy review to every new page contract. Return the minimum fields for that job. A convenient joined query is not a reason to disclose a name, email, prior score, or peer note.

## Build the redesign in verifiable releases

### Release 0: agree on scope and measure the baseline

1. Confirm the event capacity envelope.
2. Record current page timings, query counts, route payloads, and live error rates.
3. Approve the canonical internal navigation.
4. Approve Group Case weights and the `N/O` rule.
5. Choose the operational metrics destination and alert owner.

Exit when the Board signs off on the measurements and unresolved policy decisions.

### Release 1: make the workspace coherent

1. Add one `workspace_context` contract. **In progress:** the contract now consolidates screening, live-event, Speed Dating, evaluation, calibration, and total personal-task state.
2. Remove data queries from `WorkspaceNav`. **In progress:** up to four independent lookups are now one validated data-access call, deduplicated when a page needs the same context; move it to a shared workspace boundary when the route groups gain a common layout.
3. Put personal tasks first on the internal home page. **Done:** the page leads with a deadline-ordered task list, and its screening state now shares the workspace snapshot used by navigation.
4. Standardize the cycle selector, headers, breadcrumbs, and return paths.
5. Add loading, empty, degraded, forbidden, and completed states to every internal route.

Exit when a first-time member can find every assigned task without guidance.

### Release 2: finish the recruiting work areas

1. Finish the Kanban follow-up signals and **Needs action** view.
2. Build the two-pane application review workspace. **Implemented:** desktop uses a reading desk with a sticky scorer, mobile uses Read/Score views, extreme ratings require notes, recusal is confirmed near the top, and final submission has an explicit review step.
3. Finish Speed Dating pair grading and operator coverage. **Implemented except live operations rehearsal:** the Board pair builder, pair search, calibrated one-score grading, cross-device drafts, review, atomic two-applicant submission, score-free pair coverage, and durable wrong-pair reporting are implemented; conflict replacement resolution and venue load testing remain.
4. Build Group Case observations, the finish queue, and the operator grid. **Implemented for the core workflow:** members can capture applicant-specific, dimension-linked observations into cross-device drafts, then finish one applicant at a time; the Board sees score-free coverage. A live six-applicant rehearsal remains.
5. Build the evidence-first applicant comparison page.

Exit after a complete rehearsal with realistic applicant and evaluator counts.

### Release 3: harden commands and concurrent work

1. Add the shared command helper.
2. Split `/api/admin/rush` by domain.
3. Add command IDs to high-consequence actions.
4. Add version checks to mutable Board configuration.
5. Add stage history and command receipts to applicant dossiers.

Exit when duplicate requests, stale edits, and two-operator conflicts produce tested, understandable results.

### Release 4: make failure recoverable

1. Apply the shared save-state contract to every draft.
2. Add monotonic draft versions and reconnect handling.
3. Build Group Case Excel and CSV export. **Implemented:** Board and Owner can download an audited five-sheet `.xlsx` workbook with rating validation plus a formula-safe UTF-8 CSV fallback.
4. Build previewed, audited emergency import.
5. Add cycle exports and run a restore rehearsal.

Exit after one device-offline drill and one database-restore drill.

### Release 5: finish communications and operations

1. Add the remaining notification templates and triggers.
2. Increase worker frequency for time-sensitive messages.
3. Add queue health and message history to the Board interface.
4. Standardize operational records and request IDs.
5. Add metrics, alerts, runbook links, and last-success checks.

Exit when a simulated Resend outage queues work, raises an alert, and drains without duplicate messages.

### Release 6: finish the public and applicant areas

1. Publish approved project proof on the public site.
2. Separate client and prospective-member paths.
3. Add the applicant timeline, document section, and message history.
4. Test reapplication across two cycles.
5. Run accessibility and performance checks on the oldest supported phone.

Exit when a student can complete the full process without Board help and the public site meets the approved content standard.

### Release 7: rename routes only if the move still pays for itself

1. Move internal routes under `/portal`.
2. Keep permanent redirects from `/admin` and `/member`.
3. Preserve deep links, search parameters, hashes, and dossier return paths.
4. Update emails, calendar links, runbooks, and browser tests.

Skip this release if the navigation changes already removed the user confusion. URLs are not the product.

## Verification matrix

| Risk | Required proof |
| --- | --- |
| Permission leak | Route tests, RLS tests, and a browser test for each role. |
| Lost evaluation | Draft reconnect test, idempotent submission test, and device-offline rehearsal. |
| Duplicate command | Concurrent route test and database unique-constraint test. |
| Stale Board edit | Two-browser version-conflict test. |
| Slow live search | Seeded load test at the planning envelope. |
| Notification loss | Provider-failure test, lease-expiry test, deduplication test, and backlog drain test. |
| Wrong export | Formula-injection test, schema-version test, Excel open test, and audited import preview. |
| Broken route move | Redirect matrix and preserved return-path browser tests. |
| Poor accessibility | Keyboard, screen-reader, zoom, reduced-motion, and phone checks. |
| Production drift | Existing migration-parity job and protected staging workflow. |

## Do not build these now

- microservices;
- Kafka or another message broker;
- Redis before query consolidation and measurement;
- Elasticsearch or a separate autocomplete service;
- active-active multi-region writes;
- a native mobile application;
- live collaborative rubric editing;
- applicant ranking or score recommendations generated by AI;
- custom analytics infrastructure when the hosting stack can record the required metrics;
- manual card ordering without a durable rank in PostgreSQL.

Each item adds another failure mode or policy risk without solving the current recruiting-night problem.

## Board decisions

| Decision | Recommendation |
| --- | --- |
| Keep one application and database? | Yes. Split contracts and modules, not deployments. |
| Canonical internal root? | Use `/portal` eventually, after the navigation and task model work. |
| Live update method? | Start with bounded polling on live pages. Add subscriptions only after a failed rehearsal. |
| Search technology? | PostgreSQL normalization and indexes. |
| Command concurrency? | Unique command IDs plus version checks for mutable setup. |
| Notification delivery? | PostgreSQL outbox, at-least-once workers, and provider deduplication. |
| Offline scope? | Local drafts only. Durable commands require server confirmation. |
| Emergency recovery? | Versioned Excel and CSV exports plus previewed, audited import. |
| Operational monitoring? | One low-cardinality metric set with alerts tied to runbooks. |
| Route migration priority? | Last. Skip it if the interface already feels like one system. |
