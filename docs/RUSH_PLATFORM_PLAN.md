# MECG rush platform plan

> Historical. This is the original build plan, written in future tense; the work it describes has shipped. Read it as a record of intent, not as a backlog.

## Product decision

Build one cycle-based rush system with three distinct user experiences:

- Applicants manage only their own application, schedule, submissions, and released outcome.
- Members can open Speed Dating, Group Case, and Hash. They can read instructions, complete training, and submit evaluations for applicants they were assigned or directly observed.
- Board Members configure the cycle, assignments, rubrics, deliberations, and final decisions.
- System Owners manage accounts and technical settings. They do not participate in scoring by default.

Access to a workspace is not access to every record inside it. A Member can open all three required workspaces without receiving applicant contact data, peer scores, live rankings, private comments, or final decision controls.

This plan recommends that Hash be the internal deliberation stage where locked evidence is reviewed. MECG must confirm that definition in Phase 0. If MECG uses Hash as an applicant-facing social event, configure an additional evaluated round and use the optional rubric at the end of this document.

## Goals and non-goals

The first complete version must let MECG run one rush cycle from application through a locked and released decision. Every sensitive action must belong to a named user and appear in an audit history.

The system must not:

- turn event attendance into a merit score;
- expose live rankings before evaluations lock;
- allow unrestricted popularity voting;
- treat a missing evaluation as zero;
- allow a conflicted member to evaluate or decide on an applicant;
- send an offer or rejection automatically in the first release.

## Roles and privileges

Use term-scoped role memberships. A user may have different roles in different cycles, and roles expire when the cycle or board term ends.

| Capability | Applicant | Member | Board Member | System Owner |
| --- | --- | --- | --- | --- |
| View own profile and application | Yes | Own member profile only | All applicants, with a business need | No routine access |
| Edit application | Own, until deadline | No | Correct with reason and version history | No |
| Open Speed Dating | Own schedule and instructions | Yes | Yes | Technical support only |
| Open Group Case | Own team, prompt, and instructions | Yes | Yes | Technical support only |
| Open Hash | Own released status only | Yes, workspace shell and own evidence | Yes, panel data only when assigned | Technical support only |
| View applicant contact data | Own | Only when an assignment requires it | Yes, restricted by board duty | Break-glass only |
| Submit an evaluation | No | Assigned or observed applicants | Yes, when acting as an evaluator | No |
| Edit an evaluation | No | Own draft before lock | Own draft before lock | No |
| View other evaluators' forms | No | No | After round lock | Break-glass only |
| View aggregate scores | No | No by default | After round lock | No routine access |
| Configure cycle, rounds, prompts, and rubrics | No | No | Yes, before publish or freeze | No business decisions |
| Assign evaluators and groups | No | No | Yes | No |
| Record a final recommendation | No | No | Yes, if conflict-free | No |
| Approve and lock final decisions | No | No | Two-person approval | No |
| Release outcome | View own after release | No | Two-person approval | No |
| Export applicant data | No | No | Logged, purpose-limited export | Break-glass only |
| Manage users and roles | No | No | Request or nominate | Yes |
| View audit history | Own activity | Own activity | Cycle-wide | Technical and security events |

### Permission rules

1. The server checks permissions on every page load, API call, and database query. Hidden buttons are not a security boundary.
2. Members see only their assignments, their drafts, their submitted forms, rubrics, training, and deadlines.
3. Board Members cannot view or act on an applicant when they have a declared conflict.
4. Submitted evaluations are immutable. A correction creates a new version with a reason and approver.
5. Final decisions and sensitive exports require two conflict-free Board Members.
6. Applicants never see ranks, raw scores, evaluator identities, private notes, or other applicants.
7. System Owners use a logged break-glass path for content access. Technical status does not grant a vote.
8. `HASH_WORKSPACE_ACCESS` and `HASH_PANEL_ACCESS` are separate permissions. The workspace response for a regular Member contains instructions, meeting status, conflicts, and evidence they authored. Only an assigned, conflict-free decision-panel member receives locked aggregates, spread, or evidence written by others.
9. A break-glass grant needs two distinct approvers, a stated incident, narrow resources, an expiry, and a fresh conflict check. Nobody can grant or approve their own role or break-glass access.

## Conflict policy

Before assignments, every Member declares conflicts for family, romantic partners, roommates, close friends, prior serious disputes, financial ties, direct supervision, or another relationship that could affect judgment.

A conflict automatically removes the Member from that applicant's profile, evaluation assignments, aggregate results, and decision approval. A Board override needs a written reason and a second approver. The audit history records both.

## Workflow

### Cycle and application states

Keep related states separate instead of using one catch-all status.

| Record | States |
| --- | --- |
| Cycle | Draft, Open, In Progress, Decision Lock, Closed, Archived |
| Application | Draft, Submitted, Needs Info, Eligible, Invited, In Process, Final Review, Offered, Waitlisted, Rejected, Withdrawn |
| Round | Draft, Published, Active, Frozen, Finalized, Archived |
| Assignment | Assigned, In Progress, Submitted, Locked, Recused, Missed |
| Evaluation | Draft, Submitted, Locked, Superseded |
| Decision | Pending, Discussing, Approved, Locked, Released, Superseded |

Only an approved decision can lock, and only a locked decision can release. An Application moves to Offered, Waitlisted, or Rejected only when its linked Decision locks. A correction creates a superseding Decision and repeats approval. These transitions and conflict checks run in one database transaction.

### Applicant journey

1. Create an account or use a secure one-time sign-in link.
2. Submit a cycle-specific application and consent notice.
3. View invitations, RSVP, accessibility options, and a personal schedule.
4. Check in with an authenticated or staff-assisted method. QR remains a convenience, not identity proof.
5. Participate in Speed Dating and Group Case when invited.
6. View only the released outcome and next step.
7. If offered, accept or decline and complete onboarding tasks.

### Member journey

1. Sign in with a named account and confirm the current cycle.
2. Open the Evaluation Hub. Speed Dating, Group Case, and Hash are always present for active Members.
3. Complete rubric calibration and conflict declarations.
4. View assignments without other evaluators' scores or applicant contact data unless needed.
5. Save drafts and submit evidence-based evaluations by the server deadline.
6. After forms lock, participate in Hash using the permissions set by the Board. Regular Members can see procedural status and evidence they authored. Only the decision panel sees aggregates.

### Board journey

1. Create the cycle, dates, application fields, round prompts, rubrics, thresholds, and retention policy.
2. Publish events and manage capacity, time slots, groups, accommodations, and evaluator assignments.
3. Monitor missing evaluations, recusals, attendance exceptions, and score coverage.
4. Freeze each round before opening its aggregate results.
5. Run Hash with pseudonymous applicant codes, locked scores, coverage, spread, and selected evidence excerpts. Only assigned decision-panel members receive this data.
6. Record recommendations and reasons. Two conflict-free Board Members approve each final decision batch.
7. Preview communications, release outcomes, close the cycle, and archive it read-only.

## Evaluation design

### Shared rating scale

Every criterion uses 1 through 5 plus `N/O` for not observed.

| Rating | Meaning |
| --- | --- |
| 1 | Observable behavior seriously undermined the criterion |
| 2 | Below the expected bar or inconsistent evidence |
| 3 | Meets the expected bar with ordinary evidence |
| 4 | Strong and repeated evidence |
| 5 | Exceptional, adaptive, and constructive evidence |
| N/O | Not observed and excluded from the denominator |

Scores of 1, 2, 5, or a safety concern require a short behavior-based note. Evaluators cannot use "vibe," "culture fit," appearance, accent, school prestige, social status, confidence alone, or protected characteristics.

### Speed Dating guide

Groups of two or three applicants are formed off-app. During the round an evaluator searches the applicants at their table, starts the group, scores everyone in it, and submits once. Each applicant gets a single 1–5 star rating:

| Rating | Label | Anchor |
| ---: | --- | --- |
| 1 | Hard no | This candidate said something extremely disrespectful or unwarranted. They should be removed from MECG’s recruitment process. |
| 2 | Leaning no | This candidate was not very memorable and might not be a good fit for MECG. |
| 3 | Average | This candidate was likeable and had average answers, but nothing really stood out. They could potentially be a good fit. |
| 4 | Leaning yes | This candidate was likeable and has qualities that many current members possess. They would be a good addition. |
| 5 | Yes | This candidate should be in MECG already. They were super personable and had super memorable answers. I would vouch for their character strongly. |

Ratings of 1, 2, and 5 require one or two sentences of evidence.

### Group Case rubric

Use three independent evaluations per applicant. At least two observers must directly observe each applicant. Rate individual behavior, not the group's final answer.

| Criterion | Weight | Rating 1 | Rating 3 | Rating 5 |
| --- | ---: | --- | --- | --- |
| Problem framing and assumptions | 20% | No workable frame | Identifies the objective and basic assumptions | Clarifies ambiguity and prioritizes the decision |
| Analysis and evidence | 20% | Unsupported claims or faulty arithmetic | Reasonable analysis | Tests assumptions and weighs evidence and tradeoffs |
| Collaboration and inclusion | 25% | Dominates, withdraws, or dismisses | Participates constructively | Invites quieter voices and resolves disagreement |
| Communication and listening | 15% | Disorganized or ignores teammates | Gives understandable updates | Synthesizes clearly and keeps the group aligned |
| Ownership and reliability | 10% | Misses a commitment | Completes an assigned piece | Anticipates needs and follows through without taking over |
| Recommendation and judgment | 10% | Incoherent or ignores risks | Gives a defensible recommendation | Prioritizes actions, limitations, and next steps |

The group deliverable may receive a separate quality score for program feedback. Do not copy that score onto each applicant.

### Hash deliberation design

Hash is a decision workspace, not an open ballot.

The initial panel view shows:

- applicant code instead of name where practical;
- locked round scores and rating coverage;
- score spread and disagreement flags;
- evidence excerpts tied to a rubric criterion;
- conflicts, recusal status, and procedural exceptions;
- no evaluator identity during the first review.

The panel assigns one of four recommendations: advance, hold for structured review, do not advance, or procedural review. An override cannot cite friendship, popularity, attendance, "gut fit," or an unstructured impression. It requires a reason code, evidence, and two approvals.

### Score calculation

For an evaluation, convert observed criterion scores to 0 through 100:

```text
evaluationScore = 100 * sum(weight * (rating - 1) / 4) / sum(observed weights)
```

An evaluation is valid only when at least 75% of its criterion weight was observed. `N/O` is omitted, not changed to zero. A Speed Dating form has one overall score per applicant, and that score is required. A Group Case form must observe Collaboration and Inclusion plus at least three other criteria. Forms that miss an essential criterion remain evidence notes but do not enter the numeric aggregate.

For each round:

```text
roundScore = mean(valid independent evaluation scores)
```

Require at least two valid evaluations with the same rubric version and comparable essential-criterion coverage. Use the arithmetic mean for the pilot. Show score spread and send a round to structured review when valid evaluator scores differ by 25 points or more. Store every raw rating. Do not apply evaluator normalization in the first live cycle.

Recommended dry-run weights:

- Speed Dating: 40%
- Group Case: 60%

Hash does not add another numeric score. It reviews the evidence behind the two round scores.

The 40/60 weights and 1.5-point tie band are hypotheses for the dry run, not validated facts. Do not hard-code promotion cutoffs before MECG pilots the rubrics. During a dry run, compare score distributions, evaluator agreement, missingness, and whether written evidence supports the resulting order. The Board then publishes weights, thresholds, and a tie band before real applicant evaluations begin. They cannot change after the cycle opens without a versioned policy exception.

### Missing data, ties, and corrections

- One valid evaluation leaves the applicant pending.
- Missing evaluations and excused rounds never become zero.
- An excused missing round requires an alternate assessment or a published minimum-evidence rule.
- For the dry run, test a 1.5-point tie band at a decision boundary. Phase 0 must approve or replace it before the live cycle.
- Resolve a tie with a blind evidence review by an unassigned, conflict-free evaluator.
- If evidence remains equivalent and capacity is fixed, use a documented random draw instead of a popularity vote.
- Late forms enter a review queue. Client timestamps cannot backdate them.
- Corrections append a superseding evaluation. They never overwrite the submitted record.

### Calibration and quality controls

Before each evaluated round, run a 20 to 30 minute calibration using at least three common examples. Evaluators score independently, compare against the anchors, and discuss disagreement before receiving live assignments.

After a round, Board quality checks should show:

- forms submitted and missing;
- criterion coverage;
- evaluator severity against calibration examples;
- inter-rater disagreement;
- late submissions and corrections;
- assignment balance and conflicts.

These checks trigger coaching or a second review. They never silently remove an evaluator or lower an applicant's score.

The first cycle uses calibration for training and quality review only. It does not adjust applicant scores. A later normalization proposal must define its formula, minimum sample size, rubric version, validation evidence, and effect on past scores before MECG enables it.

## Screens

### Applicant

- Application and consent
- Applicant portal
- Invitations and RSVP
- Personal schedule and rescheduling
- Accessible check-in
- Released outcome
- Offer response and onboarding checklist

### Member

- Evaluation Hub
- Calibration and conflict declaration
- Speed Dating schedule and forms
- Group Case schedule, prompt, and forms
- Hash workspace with role-aware results
- Own submission history and correction requests

### Board

- Cycle setup
- Applicant pipeline
- Applicant profile and audit timeline
- Event, slot, and group planner
- Evaluator assignment and recusal queue
- Rubric builder and calibration dashboard
- Round coverage and freeze controls
- Hash deliberation board
- Decision approval and release preview
- Reports, exports, audit history, and retention

## Data model direction

Keep the current `Pnm` data during migration, but stop treating a person as a single-cycle application.

| Entity | Purpose |
| --- | --- |
| `User` | Named authenticated person |
| `RushCycle` | Term-specific configuration and lifecycle |
| `Membership` | User role scoped to a cycle |
| `ApplicantProfile` | Stable person record |
| `Application` | Applicant's cycle-specific submission and state |
| `Round` | Speed Dating, Group Case, or another configured assessment |
| `Event`, `EventSlot`, `Registration` | Scheduling, capacity, and RSVP |
| `Attendance` | Operational attendance evidence and correction history |
| `Group`, `GroupMembership` | Case team assignment |
| `RubricVersion`, `RubricCriterion` | Frozen criteria, anchors, and weights |
| `EvaluationAssignment` | Evaluator, applicant, round, conflict, and lifecycle |
| `ObservationAttestation` | Who directly observed whom, when, and under which event or assignment |
| `Evaluation`, `CriterionRating` | Versioned form and observed ratings |
| `ConflictDeclaration` | Member-applicant restriction |
| `Decision`, `DecisionApproval` | Recommendation, outcome, reasons, and dual approval |
| `AuditEvent` | Append-only record of sensitive actions |
| `ExportJob` | Purpose, scope, approvers, expiry, and audit data |
| `AccessGrant` | Time-limited break-glass scope, two approvers, reason, and expiry |

Key constraints include one application per applicant per cycle, one active rating per criterion per evaluation version, unique evaluator assignment per applicant and round, no active assignment when a conflict exists, and immutable submitted versions. A Member may evaluate only through a Board-created assignment or a verified `ObservationAttestation`. Assignment, conflict, submission, and decision invariants must be enforced in transactions, not only with UI checks.

## Security, privacy, and accessibility

- Replace the shared admin password with named accounts before storing evaluations.
- Prefer university SSO when available. Require MFA for Board Members and System Owners.
- Keep authorization logic in a single server-side policy module and test direct route access.
- Keep applicant names, contact data, notes, ratings, and decisions out of URLs and logs.
- Redact exports by default, prefix spreadsheet formula characters safely, record purpose, and expire downloads.
- Define retention and deletion with the appropriate University office before launch.
- Provide keyboard, screen-reader, mobile, non-camera, and non-QR paths for all three workspaces.
- Offer equivalent accommodations for timed or social formats. Never score the need for an accommodation.
- Record assignment, conflict, submission, correction, aggregate view, export, approval, and release events.
- Prevent self-granted roles and self-approved emergency access. Break-glass access expires automatically and is limited to named records.

## Delivery plan

### Phase 0. Policy and dry run

Time estimate: 2 to 4 days.

- Confirm whether Hash means internal deliberation or an applicant event.
- Approve the role matrix, conflict policy, retention period, decision quorum, and applicant privacy notice.
- Run the rubrics against mock applicants and set thresholds before the live cycle.
- Write permission, scoring, and lifecycle acceptance tests.

Exit check: Board Members can walk through a paper or spreadsheet simulation without inventing a permission, status, or scoring rule.

### Phase 1. Identity and authorization

Time estimate: 4 to 7 development days.

- Add named users, secure sessions, cycle memberships, role expiry, and account revocation.
- Add the central authorization module, conflicts, audit events, and direct API tests.
- Split System Owner powers from Board business powers.
- Preserve current data and backfill it into an inaugural cycle.
- Add explicit Hash workspace and panel permissions, self-grant prevention, expiring break-glass grants, and transactional conflict enforcement.

Exit check: automated tests prove each role can and cannot perform every action in the matrix.

### Phase 2. Cycle, application, and events

Time estimate: 5 to 8 development days.

- Add cycles, cycle-specific applications, pipeline states, invitations, RSVP, slots, groups, and accommodations.
- Replace weighted attendance ranking with operational attendance states.
- Keep QR check-in only as one check-in method and add staff-assisted verification.
- Build applicant portal, Board pipeline, planner, and audit timeline.

Exit check: a test applicant can apply, RSVP, receive a schedule, check in, and appear in the correct pipeline state without gaining access to another applicant.

### Phase 3. Evaluations

Time estimate: 6 to 10 development days.

- Add versioned rubrics, criteria, calibration, assignments, recusal, drafts, submission locks, and correction versions.
- Build the Member Evaluation Hub, Speed Dating flow, Group Case flow, and Board coverage dashboard.
- Implement missing-data and aggregation rules as pure tested functions.
- Remove the old attendance-weight ranking and broad CSV path before accepting live evaluations. Update the README so attendance is documented as operational only.

Exit check: at least two independent evaluators can submit locked forms, `N/O` stays missing, and an unauthorized user cannot retrieve any peer score through the UI or API.

### Phase 4. Hash and decisions

Time estimate: 4 to 7 development days.

- Build the role-aware Hash board, evidence review, disagreement flags, recommendations, and procedural-review queue.
- Add dual approval, final lock, applicant outcome release, and append-only corrections.
- Enforce `Approved -> Locked -> Released` transitions and superseding-decision rules in one transaction.
- Add message previews only. Do not send external messages yet.

Exit check: a complete mock cycle reaches a released outcome with no live-score leakage, every override has evidence and two approvals, and every sensitive action appears in the audit history.

### Phase 5. Reporting and archive

Time estimate: 3 to 5 development days.

- Add redacted reports, controlled exports, cycle close, read-only archive, retention preview, and auditable deletion workflow.
- Add funnel, coverage, disagreement, and evaluator-quality reports.

Exit check: closing a cycle prevents edits, exports are authorized and formula-safe, and the retention preview identifies exactly what will be deleted.

### Later work

- University SSO, automated email, and calendar integration
- Automated scheduling and waitlist promotion
- Mobile staff scanner and stronger check-in verification
- Advanced fairness analysis after enough cycles exist for meaningful data
- Alumni CRM or multi-chapter support

## Required acceptance tests

1. An active Member receives access to Speed Dating, Group Case, and the Hash workspace direct URLs. An inactive Member does not.
2. Direct API and rendered-response tests prove that regular Member responses for all three workspaces never contain other evaluators' scores, applicant contact data, rankings, panel evidence, or exports. Only an assigned Hash panel member receives locked aggregate fields.
3. Applicants can read only their own application, schedule, submissions, and released outcome.
4. A conflicted user cannot view, evaluate, discuss, approve, or export the affected applicant. The server rechecks the conflict inside the write transaction.
5. One valid evaluation leaves a result pending. `N/O` and a missing form never become zero.
6. Submitted forms and decisions cannot be overwritten. Corrections add a version and audit event.
7. Live aggregates remain unavailable until the round freezes.
8. Final release, sensitive exports, and break-glass access require two distinct, conflict-free approvers. Self-grants and self-approval fail.
9. QR possession alone cannot change a merit score or prove applicant identity.
10. All required flows work with keyboard and screen reader, on mobile, and without a camera.
11. Forged or expired sessions, cross-site privileged writes, duplicate submissions, and late client timestamps fail safely.
12. Closing a cycle makes it read-only and starts its configured retention schedule.
13. A decision cannot release before it is approved and locked. A correction creates a superseding record and repeats approval.
14. A Member cannot submit an evaluation without a valid assignment or verified observation attestation.
15. Before live evaluations open, no route or report uses attendance weight as a merit rank and the README states that attendance is operational only.

## Board policy decisions still open

These choices change chapter policy and should not be guessed in code:

1. Confirm MECG's exact meaning of Hash.
2. Name the Board roles allowed on the final decision panel.
3. Choose the final approval quorum. This plan recommends two conflict-free Board Members.
4. Decide whether regular Members can see anonymized aggregate results after all outcomes are released. Default is no.
5. Set the applicant data retention period with the appropriate University office.
6. Decide whether applicants receive written feedback. Default is outcome only.
7. Define the alternate assessment for an excused missed round.

## Optional rubric if Hash is an applicant-facing event

Use this only if Hash is a structured social exercise with fixed rotations. Do not use it for unstructured mingling.

| Criterion | Weight | Guardrail |
| --- | ---: | --- |
| Inclusive engagement | 30% | Reward making space for others, not extroversion |
| Listening and respectful curiosity | 25% | Score observable follow-ups, not shared interests |
| Adaptability and initiative | 20% | Reward constructive action, not dominance |
| Reliability and follow-through | 15% | Requires an explicit task or commitment to observe |
| Boundaries and judgment | 10% | Never reward alcohol use, social status, or pre-existing friendship |

Require three independent observations across at least two rotations. If the event cannot support that structure, Hash should remain unscored.
