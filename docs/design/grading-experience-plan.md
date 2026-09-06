# Grading experience plan

Status: proposed

Scope: application review, Speed Dating, Group Case, and the Board's review of submitted evidence

This plan changes how people grade. It does not change the current 1 through 5 scale, round weights, quorum, blind-review rules, or decision authority. Any change to those rules needs Board approval through `docs/policies/recruitment-policy.md`.

Confirmed Speed Dating workflow:

- Applicants participate in groups of two.
- An evaluator searches either applicant's name to find the pair.
- The evaluator grades both applicants during the round.
- This plan interprets "1/5" as one overall rating from 1 through 5 for each applicant.

## The product decision

Do not stretch one long rubric form across three different jobs.

- Application review is a reading task. The reviewer needs the application and scoring guide in view at the same time.
- Speed Dating is pair grading during a live round. The evaluator needs to find either applicant by name, open the correct pair, and rate both people without leaving the screen.
- Group Case is multi-person observation. The evaluator needs to capture evidence across a group before finishing one applicant at a time.
- Board review is an evidence-comparison task. The panel needs agreement, disagreement, coverage, and source notes before it needs a combined score.

Each workflow gets its own workspace. All four use the same rubric, evidence, draft, submission, and accessibility components underneath.

## What success looks like

The redesign succeeds when a first-time evaluator can answer these questions without training from another person:

1. Who am I evaluating right now?
2. What behavior am I looking for?
3. What does each rating mean for this criterion?
4. What evidence have I captured?
5. What is missing before I can submit?
6. Did my work save?
7. What do I do next?

The Board must be able to answer a different set:

1. Does this applicant have enough independent evidence?
2. Where did evaluators agree or disagree?
3. Which notes support each rating?
4. Is a missing score truly not observed, or is an evaluation incomplete?
5. What needs action before the round can close?

Use these initial product targets during usability tests:

| Workflow | Target |
| --- | --- |
| Application review | A reviewer finishes a typical application without losing reading position or opening a second window. |
| Speed Dating | The evaluator finds either name, opens the matching two-person pair, and rates both applicants without returning to the roster. |
| Group Case | The evaluator records an observation for any assigned applicant in at most two taps. |
| Final submission | The evaluator can identify every blocker from one review screen. |
| Board review | The panel can explain a disagreement without opening raw database-like lists. |
| Recovery | Refreshing or changing devices restores a server draft. Losing the network retains a clearly labeled device copy. |
| Accessibility | Every action works at 200 percent zoom and with keyboard or screen-reader navigation. Touch targets remain at least 44 pixels. |

Do not set a time-to-complete target until a dry run measures current performance. Faster grading is useful only if evidence quality and evaluator agreement stay the same or improve.

## What is wrong today

The system already has strong rules and draft recovery. The weak point is the shape of the work.

### One form represents two different interviews

`src/app/member/evaluation-form.tsx` renders the same vertical list for Speed Dating and Group Case. The form knows the rubric criteria but not the round's working context. It does not know the Speed Dating pair, Group Case team, prompt, other applicants under observation, or evaluator coverage.

That creates predictable friction:

- Speed Dating evaluators return to a general "My work" page and find applicants one at a time. They cannot search a name, resolve that name to a two-person pair, or grade both people together.
- Group Case evaluators must open one applicant, complete or leave that draft, then move to another applicant. The interface does not match simultaneous observation.
- Both workflows spend most of the screen on repeated labels, save notices, counters, and text areas.
- Completion counts selected ratings, not submission validity. It does not explain required criteria, observed weight, or required evidence until submission fails.

### Anchors are generic when the judgment is specific

`src/lib/rubrics.ts` provides one global sentence for each score. The rubric criteria describe the behavior, but they do not define what a 1, 3, or 5 looks like for that behavior. "Strong and repeated evidence" is not enough guidance for rating listening, ownership, or problem framing consistently.

The original rubric intent already contains criterion-specific 1, 3, and 5 anchors in `docs/RUSH_PLATFORM_PLAN.md`. The product does not show or store them.

### Application reading and scoring are separated by scroll

`src/app/member/screening/[assignmentId]/page.tsx` places every written response above the whole scoring form. Reviewers must remember evidence while scrolling between the application and rubric. Criterion notes are optional, overall evidence is a free text box, and the form submits directly without a structured review step.

### Board views show records, not a decision story

The dossier's Interviews tab lists each evaluation and its criterion ratings. It does not lead with evidence sufficiency, criterion-level agreement, missing observations, or why a round entered review. The screening results page renders one card per submitted review instead of one applicant summary. The round page tracks assignment status but does not provide a triage queue for missing coverage or high disagreement.

### Important context is missing from the data contract

The current system has Group Case teams and prompts, but the member evaluation query does not bring that context into the grading workspace. Speed Dating has round participation and individual evaluator assignments, but no two-person pair model. A trustworthy pair workspace cannot infer pair membership from assignment order.

## Shared grading foundation

Build the foundation once, then compose it into the three evaluator workspaces.

### Criterion-specific anchors

Store exact rubric-version anchors for scores 1 through 5. At minimum, require authored anchors for 1, 3, and 5. The Board may author 2 and 4 or let the interface label them as the bounded step between their neighboring anchors.

The best data shape is a child table because anchors belong to a versioned criterion:

```text
rubric_criterion_anchors
  criterion_id  -> rubric_criteria.id
  score         1..5
  description
  primary key   criterion_id + score
```

Update `rush.set_rubric_criteria` to save criteria and anchors as one versioned operation. Update `rush.cycle_rubrics`, `rush.screening_assignment_detail`, and member assignment reads to return them. A round cannot publish until every criterion has 1, 3, and 5 anchors.

Do not use a global anchor as the main explanation. Keep the global scale as a short orientation during calibration.

### One rating control

Create one accessible `CriterionRating` component for application review, Speed Dating, and the final Group Case evaluation.

The control shows:

- the criterion name and relative weight;
- a one-sentence behavior definition;
- five large choices and `N/O` when that round permits it;
- the selected score's criterion-specific anchor directly below the choices;
- an evidence field that opens when selected or when the evaluator taps **Add evidence**;
- a visible "Required" marker when the criterion must be observed;
- a visible reason when `N/O` would leave too little valid coverage.

Use a real radiogroup with one tab stop and arrow-key movement. Do not make six independent toggle buttons act like a radio control. Announce the selected anchor and validation state. Keep the selected state recognizable without color.

Do not show the computed 0 through 100 score while the evaluator is rating. That number encourages score steering across criteria. Show the ratings and evidence on review, then show only a submission receipt after lock.

### Validity-based progress

Replace "3 of 5 criteria scored" with a checklist derived from the same rules as the server:

- required criteria observed;
- minimum observed criterion count met;
- at least 75 percent of rubric weight observed;
- evidence added for every 1, 2, and 5;
- all criteria explicitly rated or marked `N/O`;
- overall evidence added when the workflow requires it.

Share a pure `evaluationReadiness` function between the client and route tests. The database remains authoritative. The client must explain the next blocker before the evaluator presses submit.

### Evidence capture

Use one evidence model in the interface:

- A criterion note says what the applicant did or said.
- An optional source points to the application response, Speed Dating prompt, or Group Case moment.
- An overall note records context that does not fit one criterion.

Do not add personality tags, "culture fit," sentiment labels, or an unrestricted bank of adjectives. They make weak evidence easier to enter.

For application review, a source can be a copied excerpt tied to a response key. For an interview, a source can be a timestamp label such as "opening," "discussion," or "recommendation." Exact audio recording is out of scope and should not be added by default.

Structured sources can live inside draft JSON first. If the Board needs them in locked evidence, add an `evaluation_evidence_items` table linked to either an evaluation or a screening review. Do not encode structured evidence into one formatted text blob.

### Draft and connection behavior

Keep the current server autosave and device recovery. Make the state smaller and more useful:

- Show "Saved" with the last saved time in the workspace header.
- Show "Saving" only while a request is active.
- Pin a persistent warning only when server sync fails.
- Say "Saved on this device" when the browser copy is newer than the server copy.
- Retry without reloading the form when possible.
- Warn before leaving only when neither copy contains the newest edit.

Use the existing rubric and assignment identity checks. A draft from another assignment or rubric version must continue to fail closed.

### Review and lock

Every workflow ends on the same review pattern:

1. Summarize each criterion, rating, anchor label, and evidence.
2. Put missing or invalid items first with a direct **Fix** link.
3. Show `N/O` as "Not observed, excluded from score." Never show it as zero.
4. State that submission locks the evaluation.
5. Require one explicit **Lock evaluation** action.
6. Return a receipt with applicant, round, submission time, and next action.

Do not use a modal for the entire review. A full page or full-width panel is easier to scan and recover on a phone.

## Application review workspace

The application-review experience should feel like a reading desk, not a long survey.

### Desktop layout

Use a two-pane workspace. Keep the application at roughly 60 percent width and a sticky scoring panel at 40 percent.

```text
+---------------------------------------------------------------+
| Applicant A19F2C     2 of 7 complete         Saved 1:14 PM     |
+-----------------------------------+---------------------------+
| Written application               | Scoring guide             |
|                                   |                           |
| Question 1                        | Motivation          3     |
| Answer text...                    | Meets the expected bar    |
| [Use excerpt as evidence]         | [Evidence note]           |
|                                   |                           |
| Question 2                        | Problem structuring 4     |
| Answer text...                    | Strong evidence...        |
|                                   |                           |
+-----------------------------------+---------------------------+
| Back to queue              Review application                 |
+---------------------------------------------------------------+
```

The left pane keeps answer headings and reading position. The right pane uses compact collapsed criterion rows. Opening a criterion does not move the application pane.

When the reviewer selects text, offer **Use as evidence**. The reviewer then chooses the criterion and may add a short interpretation. Preserve the exact response key and excerpt in the draft. Do not let a text selection submit itself.

### Mobile layout

Do not shrink the two panes. Use a segmented control with **Read** and **Score**. Preserve position in both views. A sticky footer shows the current blocker and the next action.

After a reviewer reads the last response, move focus to **Score** only when they choose to continue. Do not switch views automatically.

### Queue behavior

The queue should have one primary card, not a grid of identical assignments. Show:

- **Continue Applicant A19F2C** when a draft exists;
- **Start next application** when no draft exists;
- completed, remaining, and deadline;
- a compact list of other unstarted assignments behind **View full queue**.

After submission, show a receipt for a moment, then provide **Open next application**. Never move to the next applicant before the reviewer sees that the current review locked.

### Recommendation quality

Keep Advance, Hold for structured review, and Do not advance. Move recommendation after the rubric and require a short recommendation reason. If the recommendation strongly conflicts with the rubric pattern, show a neutral check:

> Your ratings are mostly below the expected bar, but your recommendation is Advance. Review the evidence or confirm that this is intentional.

This is advisory. It must not silently change or block the recommendation. Record confirmation so the Board can distinguish an intentional judgment from a missed control.

Require evidence notes for screening scores of 1, 2, and 5, matching interview evaluations. The current screening path should not use a lower evidence standard than later rounds.

### Blind-review safeguards

Keep the candidate code, responses, rubric, and private progress. Do not show the name, photo, contact information, LinkedIn, resume, prior cycle, other reviewers, other reviews, or aggregate score. Preserve the current recusal replacement behavior.

Move recusal to a persistent **Recognize this applicant?** action in the header. Use a confirmation step that repeats what will happen to the draft and assignment. Do not bury recusal after the grading form.

## Speed Dating workspace

Speed Dating uses one overall rating from 1 through 5 for each applicant. Applicants participate in groups of two. During the round, an evaluator searches either person's name, opens the matching pair, and grades both people.

This is a different rubric shape from the five-criterion Speed Dating rubric enforced today. The smallest technical change is to keep the existing versioned rubric machinery and replace the Speed Dating rubric with one required criterion weighted at 100. Call it "Overall Speed Dating assessment" and give every score a concrete anchor. The Board must approve that policy change before implementation.

The whole evaluator loop is six steps:

1. Open Speed Dating grading.
2. Search either name from the two-person group.
3. Confirm that both displayed names are the people the evaluator met.
4. Give each applicant a 1-through-5 rating and any required evidence.
5. Review and submit both ratings.
6. Search the next group.

Keep the evaluator in this loop until they have graded every pair they met. Do not route them through the member inbox between groups.

### Make the pair the unit of navigation

Add an explicit pair model. Do not infer a pair from adjacent names or individual assignments:

```text
speed_dating_pairs
  id, round_id, label, status, created_at, published_at

speed_dating_pair_members
  pair_id, round_id, application_id, position
  primary key pair_id + application_id
  unique round_id + application_id
```

Every published pair must contain exactly two active applicants. Store pair membership before the round opens and lock it after publication. A correction replaces the pair through an audited operation. It must not rewrite already submitted evaluations.

Keep the existing `evaluation_assignments` and `evaluations` tables for individual scores. A pair is a navigation and workflow object, not a shared merit record. Each applicant still receives an independent locked evaluation.

Create pair-level evaluator work so both individual assignments travel together. The backend may create the two `evaluation_assignments` when the Board assigns the pair or when an eligible evaluator opens it. Either way, one transaction must enforce these rules:

- the evaluator is eligible for the round;
- the pair is published and contains exactly two applicants;
- the evaluator has not already graded either applicant for this round;
- both individual assignments exist or neither is created;
- a declared conflict blocks only the affected applicant and starts the approved replacement flow;
- the target number of independent evaluations cannot be exceeded accidentally.

### Give the Board a pair builder

The Board needs to create and verify pairs before members can search them. Add a pair builder to the Speed Dating round page with two columns:

- **Unpaired applicants** shows everyone advanced to Speed Dating who is not in a pair.
- **Draft pairs** shows two names per row, pair label, and validation state.

Support manual pairing and a deterministic **Create draft pairs** action. Automatic pairing must create a draft only. The Board can move applicants before publication. Do not add drag and drop as the only way to edit pairs. Every move also needs a select or button control.

The publish checklist blocks publication when:

- any pair has fewer or more than two applicants;
- an applicant appears twice;
- an eligible applicant remains unpaired;
- an applicant no longer belongs to the active round;
- evaluator coverage cannot meet the approved target;
- a draft pair changed after the Board last reviewed it.

If the cohort has an odd number, show one unresolved applicant. Do not create a fake partner or silently publish a one-person pair. The Board must add another applicant, remove one from the round, or record an approved exception.

After publication, the page becomes a read-only pair roster with an audited **Correct pair** operation. Search uses only the latest published pair version.

### Search names first

The Speed Dating landing screen should put an autofocus search field above everything else. Use the label **Search either applicant's name**. Search preferred name, first name, last name, and the full normalized name. Ignore case, extra spaces, punctuation, and diacritics.

Search results represent pairs, not people. If the evaluator searches "Jordan," the result shows Jordan and Jordan's partner together:

```text
+--------------------------------------------------+
| Search either applicant's name                   |
| [ jordan______________________________________ ] |
+--------------------------------------------------+
| Pair 07                                          |
| Jordan Lee + Maya Patel                          |
| Both need ratings                [Claim pair]    |
+--------------------------------------------------+
```

Show only the minimum information needed to choose the right pair:

- both names, with the matching text emphasized;
- the pair label if the event uses one;
- grading state: Not started, 1 of 2 rated, Ready to submit, or Submitted;
- a disambiguator such as preferred name or last initial when duplicate names exist.

Do not show contact information, application answers, prior scores, or other evaluators. Search must return only applicants in the active Speed Dating round whom the member may grade.

Keep recent and unfinished pairs directly below the search field. An evaluator who backs out by mistake should not have to search again. After a successful pair submission, clear the old query and return focus to search.

Define the main search states before implementation:

- With an empty query, show unfinished and recently submitted pairs.
- With one match, put **Claim pair** in the primary position. If this evaluator already claimed it, use **Continue grading**.
- With several matches, show both names and the pair label so the evaluator can disambiguate them.
- With no match, keep the query and offer **Report missing name**.
- For an already submitted pair, show **Submitted** and the submission time. Do not reopen the ratings.
- Do not make a coverage target an exclusive lock. Any eligible evaluator may claim any published pair; the operator view can warn when a pair is below or above its intended coverage.

On a keyboard, `/` focuses search, the arrow keys move through results, and Enter opens the selected pair. On a phone, keep the clear-search control inside the 44-pixel input target.

### Grade both applicants on one screen

Claiming a result records this evaluator's live work and then shows the two applicants together. The claim is idempotent and belongs only to that evaluator; it does not reserve the pair against everyone else. Use two equal cards on a tablet or laptop and stacked cards on a phone. Keep both names visible while either card is active.

```text
+--------------------------------------------------+
| Pair 07                         Saved 1:18 PM     |
| Jordan Lee + Maya Patel                          |
+------------------------+-------------------------+
| Jordan Lee             | Maya Patel              |
| Overall rating         | Overall rating          |
| [1] [2] [3] [4] [5]   | [1] [2] [3] [4] [5]    |
| Meets the bar...       | Strong evidence...      |
| [Evidence note]        | [Evidence note]         |
+------------------------+-------------------------+
| Jordan rated · Maya rated                        |
| Review and submit pair                           |
+--------------------------------------------------+
```

On narrow phones, stack the cards and add a two-item applicant switcher. The switcher shows a check when a rating is complete. Tapping the second name scrolls to that card. Do not hide one applicant in a separate route or browser history entry.

Each card contains:

- the applicant's name in large type;
- one 1-through-5 radiogroup;
- the selected score's exact anchor;
- a short evidence note;
- **I know this applicant** for conflict handling;
- a visible complete or needs-evidence state.

Require a short evidence note for scores 1 and 5. The Board must decide whether score 2 also requires a note, as current interview policy requires notes for 1, 2, and 5. Keep evidence optional for 3 and 4 so the live interaction stays fast. Never let the pair layout copy a rating or note from one applicant to the other.

### Use concrete overall anchors

The single score needs Speed Dating-specific meaning. Use these as prototype copy, then calibrate them before publication:

| Rating | Prototype anchor |
| --- | --- |
| 1 | Serious concern. The interaction showed behavior that conflicts with MECG's expectations. |
| 2 | Below the expected bar. The interaction had a material concern or lacked enough positive evidence. |
| 3 | Meets the expected bar. The applicant communicated clearly and engaged constructively. |
| 4 | Strong. The applicant listened, reasoned, and contributed with clear positive evidence. |
| 5 | Exceptional. The applicant adapted to the conversation and showed unusually strong judgment or collaboration. |

These anchors deliberately combine the current Speed Dating criteria into one judgment. Calibration must teach members that confidence, charisma, similarity, and social familiarity are not the score.

### Submit the pair deliberately

The footer shows pair readiness rather than a generic criterion count:

- **Rate Jordan**
- **Add evidence for Maya's 5**
- **Both ratings ready**
- **Jordan submitted, Maya blocked by conflict**

When both ratings are valid, **Review and submit pair** opens a summary with the two names, ratings, anchors, and notes. One **Submit both ratings** action locks both evaluations in a database transaction. The evaluator sees a receipt before returning to search.

Atomic pair submission is the normal path. If a conflict or technical exception makes only one rating valid, let the operator resolve the exception without losing the valid draft. Do not silently submit one applicant and leave the other behind.

### Support a fast live round

Speed Dating happens during the round, so remove anything that slows the core loop:

- Keep the search field and pair grading screen usable with one hand.
- Save each applicant's rating and note as soon as they change.
- Restore a half-finished pair after refresh or device change.
- Show no timer unless the event actually uses a shared product-owned clock.
- Do not require a separate post-conversation mode.
- Do not send the evaluator back through **My work** between pairs.
- Do not reveal aggregates, other evaluators' ratings, or a leaderboard.

### Show operators live completion without scores

The Speed Dating round page should show one row per pair:

| Pair | Evaluator coverage | Drafts | Submitted | Action |
| --- | --- | ---: | ---: | --- |
| Jordan + Maya | 2 of 2 claimed | 0 | 4 of 4 ratings | Complete |
| Devon + Priya | 1 of 2 claimed | 2 | 0 of 4 ratings | Find evaluator |

Count individual ratings as well as pair claims so a half-finished pair is visible. Operators may see who claimed a pair and whether a draft exists. They must not see the draft rating, locked score, or aggregate while the round is active.

Give operators direct actions to release an untouched claim, replace a conflicted evaluator, correct a pair, or contact someone with an unfinished draft. Each action needs an audit reason once the round opens.

### Handle the wrong pair and conflicts

The evaluator needs two distinct actions:

- **These are not the two people I met** returns to search and reports a pair or roster problem.
- **I know this applicant** starts the existing conflict and replacement flow for that one person.

A wrong-pair report alerts the event operator and preserves both drafts. A conflict immediately hides the affected applicant's protected evidence and prevents submission. The unaffected person's draft stays available, but the interface explains that the pair needs operator resolution.

## Group Case workspace

Group Case needs an observation board first and individual evaluations second.

### Observation board

Load the case group, prompt, assigned applicants, and evaluation assignments in one workspace. The evaluator may see only applicants they are allowed to observe.

```text
+----------------------------------------------------------------+
| Group Case 2       18:40       Prompt and instructions          |
+----------------------------------------------------------------+
| Maya       Devon       Sam        Priya                         |
| 3 notes    1 note      No notes   2 notes                       |
+----------------------------------------------------------------+
| Maya selected                                                   |
| [Collaboration] [Analysis] [Listening] [Ownership] [Other]      |
| What happened? ____________________________________________     |
| [Save observation]                                             |
+----------------------------------------------------------------+
| Coverage: Maya 3  Devon 1  Sam 0  Priya 2                       |
+----------------------------------------------------------------+
```

Tapping an applicant selects that person without navigation. Tapping a criterion tag sets the destination for the note, not a score. This board captures facts while the discussion happens. It does not ask the evaluator to rate six criteria for four people in real time.

The coverage strip counts evidence notes, not rubric completeness. Use it to reveal whom the evaluator has not observed. Do not compare applicants or show a rank.

Keep the case prompt and phase visible. Optional phase labels such as framing, analysis, and recommendation can add timestamps to evidence. They must not force the group through a scripted process.

### Individual finish queue

At the end of the case, turn each assigned applicant card into one of these states:

- **Ready to rate**, enough observations exist to start;
- **Needs evidence**, no direct observation has been recorded;
- **Draft**, ratings started but not locked;
- **Submitted**, evaluation locked;
- **Not observed**, evaluator must explain why and may be unable to submit a valid score.

Opening a person shows the shared rating control beside that person's observation timeline. One tap moves an observation into a criterion note. The evaluator still owns the wording and rating.

Do not copy the group deliverable score to any applicant. Do not prefill a rating from the number of notes or from tags. Evidence assists judgment, it does not make the judgment.

### Group Case coverage for operators

The Board's live view should show a grid of applicants by evaluators:

| State | Meaning |
| --- | --- |
| Empty | The evaluator has not recorded evidence. |
| Draft | Evidence or ratings exist but are not locked. |
| Submitted | A valid evaluation is locked. |
| Recused | A conflict removed the evaluator. |
| Needs replacement | Required independent coverage cannot be reached. |

Use the grid to fix coverage, not to watch scores during the event. Hide ratings and aggregates until the round freezes so operators do not pressure evaluators toward a result.

## Board evidence review

The Board should review one applicant summary, with raw evaluations available on demand.

### Dossier summary

Replace the current top line and nested lists in the Interviews tab with this order:

1. Evidence readiness for each required round.
2. Combined score only when every weighted round is complete.
3. Criterion agreement for each round.
4. Evidence excerpts grouped by criterion.
5. Individual locked evaluations in a collapsed audit section.

For each round, show:

- valid evaluations received and required;
- observed coverage and rubric version for each evaluation;
- round score and weight when complete;
- score range and a clear "Structured review required" state at a spread of 25 or more;
- each criterion's rating distribution, median, and `N/O` count;
- conflicting notes next to each other without merging their wording;
- corrections or late forms as separate audited records.

Do not reduce disagreement to a red warning. A 2 and a 5 on collaboration should open the two evidence notes that produced those ratings.

### Application-screening result

After the batch freezes, group screening results by applicant. One applicant summary should show:

- three locked reviews received;
- recommendation split;
- score range and spread;
- criterion distribution;
- each reviewer's evidence, blinded by default;
- an explicit structured-review reason when recommendations conflict.

Board and Owner users may reveal evaluator identity only when coaching, correction, or procedural review requires it. Record that reveal as an audit event. Identity reveal must not be a casual hover detail.

### Round triage

Turn the round page into an action queue before the existing assignment table:

- applicants with no coverage;
- applicants with only one valid evaluation;
- invalid submissions caused by missing required observation;
- open drafts near the deadline;
- recusals with no replacement;
- high score spread;
- rubric-version mismatch;
- all clear and ready to freeze.

Each row needs one plain next action such as **Assign evaluator**, **Open evidence**, or **Contact evaluator**. Counts without a path to resolution do not help an operator close the round.

## Navigation and information architecture

Keep **My work** as the member inbox. Do not render grading forms inside that inbox.

Use dedicated routes:

```text
/member/review                         application queue
/member/review/[assignmentId]          application reading desk
/member/speed-dating/[roundId]         pair search and live pair grading
/member/group-case/[groupId]           observation board and finish queue
/member/evaluations/[assignmentId]     focused fallback or post-event form

/admin/review                          screening setup and applicant results
/admin/rounds/[roundId]                readiness and coverage
/admin/applications/[id]               applicant evidence dossier
```

Existing paths can redirect. Preserve safe return URLs and draft identity. A route change must not make an evaluator think their work disappeared.

The member inbox should show one card per workflow with its next owed action:

- **Continue application review, 4 remaining**
- **Open Speed Dating grading, search a pair**
- **Finish Group Case notes, 2 applicants remaining**

## Product states that need designs

Design and test these states before implementation is called complete:

- no assignments;
- assignment not open;
- calibration required;
- server draft restored;
- device-only draft restored;
- offline while editing;
- server autosave failure;
- rubric changed before work began;
- round closed while a draft was open;
- Speed Dating name has no match;
- duplicate applicant names in search;
- pair contains fewer or more than two applicants;
- evaluator opens the wrong pair;
- one applicant in a pair has a conflict;
- pair has one valid draft and one blocked rating;
- declared conflict and successful replacement;
- declared conflict with no replacement;
- required criterion not observed;
- insufficient observed weight;
- extreme rating without evidence;
- duplicate submit request;
- submission succeeds but next-assignment lookup fails;
- submitted and locked;
- corrected evaluation exists;
- screen at 200 percent zoom;
- reduced motion;
- long applicant name, long criterion name, and long anchor text.

## What not to build

- No AI-generated rating or recommendation.
- No score inferred from evidence text, speaking time, note count, or sentiment.
- No applicant leaderboard in evaluator views.
- No live aggregate scores before a round freezes.
- No forced distribution or evaluator normalization in the first cycle.
- No recording or transcription by default.
- No automatic score or submission based on round timing.
- No group score copied to individuals.
- No swipe-only actions.
- No drag-and-drop requirement for core work.
- No new rating scale until the Board approves a policy change.

## Implementation plan

### Phase 0: validate the workflow before production code

The first interactive artifact is `prototypes/speed-dating-pair-grading.html`. It tests the proposed pair search, two-applicant grading screen, evidence requirement, review step, and completion receipt without changing production data or routes.

1. Interview two application reviewers, two Speed Dating evaluators, two Group Case observers, and two Board operators.
2. Observe one dry run of each workflow. Record device, lighting, noise, hand use, time between applicants, and where people keep notes today.
3. Build throwaway responsive prototypes for the application reading desk, Speed Dating pair search and grading, and Group Case observation board.
4. Test each prototype with realistic long answers, duplicate applicant names, a half-completed Speed Dating pair, six Group Case applicants, a lost connection, and a conflict.
5. Confirm that the Speed Dating score is one overall 1-through-5 rating rather than several criterion ratings.
6. Confirm whether a Speed Dating score of 2 requires evidence in addition to scores of 1 and 5.
7. Get Board approval for criterion-specific rubric anchors and the stronger screening evidence rule.

Exit when participants complete their workflow without facilitator instructions, and the Board has approved the Speed Dating scoring rule.

### Phase 1: build the shared scoring foundation

1. Add versioned criterion anchors and publish validation.
2. Extend the rubric editor to author and preview 1, 3, and 5 anchors.
3. Build `CriterionRating`, `EvidenceNote`, `EvaluationReadiness`, `DraftStatus`, and `EvaluationReview` components.
4. Extract client readiness rules into a tested pure function.
5. Keep current database validation unchanged, then add anchor completeness checks only at rubric publish.
6. Add component tests for keyboard control, `N/O`, required evidence, and focus on the first blocker.

Exit when the existing generic evaluation flow can use the new components without losing autosave, recovery, validation, or lock behavior.

### Phase 2: redesign application review

1. Add the two-pane reading desk and mobile Read or Score views.
2. Add response-linked evidence excerpts to screening drafts and locked reviews.
3. Add the review-before-lock step and recommendation reason.
4. Add the advisory rating-and-recommendation consistency check.
5. Move recusal into the header with confirmation.
6. Replace the queue grid with Continue or Start next.
7. Update screening results to group three reviews by applicant.

Exit after a blinded usability run and authorization tests prove that reviewers still cannot access identity or other reviewers' work.

### Phase 3: redesign Speed Dating

Implementation started in the separate `worktree-grading-redesign-plan` worktree. The first vertical slice adds the pair schema, atomic Board publication contract, conflict-filtered member queue, search by either applicant name, and an idempotent self-claim action. Pair scoring, cross-device drafts, and atomic two-evaluation submission remain the next slice; the search-and-claim UI does not pretend that a claim is a submitted grade.

1. Add two-person pairs, pair publication validation, and audit history.
2. Change the Speed Dating rubric to one required criterion weighted at 100 after Board approval.
3. Add an idempotent evaluator-specific pair claim. Create or find both individual assignments atomically when the pair is submitted, so claimed work cannot leak into the old one-applicant form.
4. Build name search with duplicate-name handling and pair-shaped results.
5. Build the responsive two-applicant grading screen and pair review.
6. Add wrong-pair reporting separate from conflict declaration.
7. Keep a valid draft when the other applicant is blocked by conflict or an operator issue.
8. Submit both individual evaluations in one transaction during the normal path.
9. Load-test search and draft saves at the expected simultaneous evaluator count.

Exit after a full live-round dry run on the oldest supported phone and the event venue's actual network. The run must include duplicate names, a wrong pair, a conflict affecting one applicant, and recovery of a half-finished pair.

### Phase 4: redesign Group Case

1. Add a member-safe RPC that returns group context, prompt, allowed applicants, assignments, and private draft summaries.
2. Add structured observation items to drafts.
3. Build the observation board and applicant switcher.
4. Build the post-case individual finish queue.
5. Build the operator coverage grid without live scores.
6. Verify that every locked evaluation remains individual and uses the frozen rubric version.

Exit after a six-applicant dry run proves that evaluators can recover who they observed and finish every assigned evaluation without cross-applicant note leakage.

### Phase 5: redesign Board evidence review

1. Create one typed evidence-summary query for the dossier and Hash. Do not recompute policy differently in each page.
2. Add evidence sufficiency, criterion agreement, `N/O`, spread, and version information.
3. Add the application-screening applicant summary.
4. Add the round triage queue and direct recovery actions.
5. Keep raw evaluations collapsed but available for audit.
6. Audit every role and conflict path before exposing new aggregates.

Exit when the Board can explain why an applicant is ready, pending, or under review from the summary, and every number links to its underlying locked evidence.

### Phase 6: calibrate and roll out

1. Run at least three shared-example calibration exercises for each rubric.
2. Measure missingness, evaluator spread, time to submit, draft failures, and correction requests.
3. Compare results with the current experience. Do not compare only completion speed.
4. Launch one workflow at a time behind a cycle-level feature flag.
5. Keep the old focused form as a fallback for the first live cycle.
6. Remove the fallback only after the Board signs off on one complete cycle.

## Verification

Run repository checks documented for the implementation commit. Add focused coverage for these contracts:

- rubric anchors version with their criterion and cannot change after the round starts;
- application reviewers cannot resolve candidate identity;
- one reviewer cannot read another reviewer's draft or submission;
- Group Case observation drafts cannot cross applicants or assignments;
- every published Speed Dating pair contains exactly two active applicants;
- one applicant cannot appear in two Speed Dating pairs for the same round;
- searching either name returns the same pair;
- normalized search handles case, whitespace, punctuation, and diacritics;
- search never returns applicants outside the active round or the evaluator's permission;
- claiming a pair is idempotent and never blocks another eligible evaluator from independently claiming it;
- submitting a claimed pair creates or finds exactly two individual assignments;
- submitting a pair locks two independent evaluations atomically;
- a rating or note never copies from one applicant to the other;
- a conflict on one applicant blocks that evaluation without deleting the other draft;
- client readiness and `rush.submit_evaluation` agree on every boundary case;
- scores of 1, 2, and 5 require evidence in interviews and screening;
- `N/O` stays out of the denominator and never becomes zero;
- round summaries require two valid independent evaluations;
- a spread of exactly 25 enters structured review;
- live operator views do not expose scores before freeze;
- conflict declarations remove protected evidence immediately;
- duplicate submission remains idempotent from the user's point of view;
- keyboard, screen-reader, reduced-motion, zoom, and touch-target checks pass.

For each dry run, record task completion, wrong-applicant incidents, missing evidence, time spent searching, autosave failures, evaluator questions, and Board correction requests.

## Repository map

Start implementation from these files and contracts:

| Area | Current source |
| --- | --- |
| Shared interview form | `src/app/member/evaluation-form.tsx` |
| Member inbox and assignment query | `src/app/member/page.tsx` |
| Application reviewer queue | `src/app/member/screening/page.tsx` |
| Application reading and scoring | `src/app/member/screening/[assignmentId]/page.tsx` and `screening-review-form.tsx` |
| Interview submit route | `src/app/api/member/evaluations/[assignmentId]/route.ts` |
| Screening submit route | `src/app/api/member/screening/route.ts` |
| Rubric defaults and global anchors | `src/lib/rubrics.ts` |
| Score and aggregate rules | `src/lib/evaluation.js` |
| Rubric editor | `src/app/admin/rounds/rubric-editor.tsx` |
| Round workload and assignments | `src/app/admin/round-board.tsx` |
| Screening operations and results | `src/app/admin/screening/page.tsx` |
| Applicant evidence dossier | `src/app/admin/applications/[id]/page.tsx` |
| Interview submission contract | `supabase/migrations/20260901184000_active_cycle_and_evaluation_evidence.sql` |
| Interview drafts | `supabase/migrations/20260902270000_evaluation_drafts.sql` |
| Screening data and locked ratings | `supabase/migrations/20260824160000_blind_screening.sql` |
| Screening drafts and queue handoff | `supabase/migrations/20260902320000_screening_review_drafts.sql` |
| Group data | `rush.case_groups` and `rush.case_group_members` |
| Speed Dating participation | `supabase/migrations/20260902280000_speed_dating_enrollment.sql` |

## Decisions required before implementation

These questions materially change the design and need named owners:

| Decision | Recommended answer | Owner |
| --- | --- | --- |
| Is "1/5" one overall rating from 1 through 5? | Yes. Model it as one required rubric criterion weighted at 100. | VP Recruitment and Board |
| Which Speed Dating ratings need evidence? | Require notes for 1 and 5. Decide whether the current score-2 rule still applies. | Board |
| Can any member grade any published pair? | **Decided:** yes. An eligible evaluator may search and claim any published pair. A claim is per evaluator and does not lock the pair away from other evaluators; conflicts are filtered before search results are returned. | VP Recruitment |
| Can evaluators grade every person in a Group Case? | No. Show only explicit assignments so independence and coverage remain auditable. | VP Recruitment |
| Are screening extreme scores held to the same evidence rule? | Yes. Require notes for 1, 2, and 5. | Board |
| Are recommendation conflicts blocking? | No. Ask for confirmation and send them to structured review. | Board |
| May the Board reveal evaluator identity? | Only for a recorded coaching, correction, or procedural reason. | Board and privacy owner |
| Do response excerpts become permanent evidence? | Yes, when the reviewer explicitly attaches them and the locked review preserves the source response key. | Board and privacy owner |

The first build should cover the shared foundation and application review. Those changes solve an immediate reading problem with the least new operational data. Speed Dating comes next because it needs pair search, pair-level assignment, and atomic submission. Group Case follows because its observation board needs the most live testing. Board summaries land after the locked evidence contracts are stable.
