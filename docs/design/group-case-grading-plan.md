# Group Case grading plan

## Outcome

A judge must be able to watch a four-person case, capture evidence without losing the conversation, and finish every assigned rubric in ten minutes. The product must preserve independent judgment and give the Board an Excel-readable backup before the event starts.

This plan applies the rubric and event sequence from `MECG_Group_Case_Redesign (1).pdf` to the current Rush application. It extends the shared grading plan in `docs/design/grading-experience-plan.md`.

## Resolve the source document before coding

The source document has six dimensions:

| Dimension | Product weight | Live evidence tag |
| --- | ---: | --- |
| Team Collaboration | 2 | Collaboration |
| Structured Problem-Solving | 1 | Problem solving |
| Leadership and Initiative | 1 | Leadership |
| Creativity and Business Judgment | 1 | Judgment |
| Composure and Time Management | 2 | Composure |
| Presentation and Communication | 1 | Presentation |

Use a required 1-through-5 rating for every observed dimension. Allow **Not observed** when the judge had no fair chance to see the behavior. Keep the current minimum-observation rule so a judge cannot submit a mostly empty rubric.

The source introduction says dimensions 1, 2, and 5 receive more weight. Its formula doubles only dimensions 1 and 5 and gives a maximum of 40. Those two statements cannot both be true. Use the formula as the current product rule because the stated maximum confirms it. The Board must approve that choice before rubric publication.

Do not show the source document's decision bands while a judge scores. Labels such as "should already be in MECG" invite judges to reverse-engineer an outcome. Show the weighted result only after the judge has reviewed all six ratings. Treat the result as evidence, not an automatic decision.

## Keep the live job narrow

The judge has two jobs, in this order:

1. Capture specific behavior while the case runs.
2. Rate each assigned applicant after the presentation.

Do not place six rating rows under four names during the discussion. That asks the judge to make 24 judgments while listening. The live screen records short observations. The finish screen turns those observations into ratings.

## Match the event sequence

The Board controls one shared phase for each group:

| Event phase | Judge screen |
| --- | --- |
| Silent read | Case prompt, data, constraints, and judge cheat sheet |
| Group discussion | Applicant switcher and observation composer |
| Slide building | Observation composer with time-management tags first |
| Presentation | Presentation tags and follow-up question notes |
| Independent scoring | Applicant finish queue with co-judge work hidden |
| Judge discussion | Differences and flags, after both judges submit |

Show the shared phase and the scheduled end time. Do not run a separate timer on each device. If an operator changes the phase, every open judge screen receives the same update.

## Observation screen

Keep all assigned applicants in one row. Each person shows a note count and a plain state such as **No evidence**, **Observed**, or **Ready to score**. Selecting a person changes the note target without opening another page.

The observation composer contains:

- the selected applicant's name;
- six dimension tags;
- four red-flag tags and four green-flag tags from the source document;
- one short text field labeled **What happened?**;
- **Save observation**;
- the selected applicant's private observation timeline.

An observation stores one applicant, one dimension, one event phase, the judge, the text, and the time. A flag also requires text. Never copy an observation to another applicant. Do not convert the number of observations into a rating.

Use these shortcuts on a laptop:

- number keys 1 through 4 select an applicant;
- `C`, `S`, `L`, `J`, `T`, and `P` select a dimension;
- `Enter` saves a non-empty observation;
- `/` focuses the observation field.

Keep every control at least 44 pixels tall on a phone. Use a horizontally scrollable applicant row and keep the selected name above the keyboard.

## Independent finish queue

At the scoring phase, show one card per assigned applicant:

- **Needs evidence** means the judge recorded no behavior.
- **Ready to score** means evidence exists and no rating has started.
- **In progress** means at least one dimension has a rating.
- **Ready to review** means the rubric meets the observation rule.
- **Submitted** means the evaluation is locked.

Open one applicant at a time. Keep the other applicants in a compact progress row. Each dimension row shows its name, weight, chosen rating, and the chosen anchor. Collapse the full five-anchor table until the judge asks for it.

Place the applicant's observations beside the matching dimensions. Let the judge attach an observation to the evidence note with one action. The judge can edit the note before submission.

Require a note for ratings 1, 2, and 5 to match the current interview contract. Require a note for every red or green flag. A flag never changes the score by itself.

### Make missing evidence honest

Use **Not observed** when the applicant did not present or the judge could not see a dimension. Do not translate **Not observed** into zero. Exclude it from the weighted denominator.

If Presentation and Communication is required for every applicant, the event format must give every applicant a speaking part. The interface cannot fix an event that did not create the observation opportunity.

### Review once

The final review page contains:

- the applicant's six dimension ratings;
- the two doubled weights;
- every required evidence note;
- red and green flags;
- the weighted result;
- one **Submit evaluation** action.

After submission, lock the evaluation. Do not show the co-judge's scores until both judges submit. Then show differences by dimension with both evidence notes. This sequence follows the source document's instruction to score independently before discussion.

## Operator view

The live Board view tracks work without showing scores:

| Cell state | Meaning | Board action |
| --- | --- | --- |
| Empty | No evidence or ratings | Check judge assignment |
| Observing | At least one observation | None |
| Scoring | Ratings started | None |
| Submitted | Evaluation locked | None |
| Recused | Conflict recorded | Assign replacement |
| Offline backup | Judge moved to Excel | Record backup owner |

Use one row per applicant and one column per assigned judge. The Board sees counts, save health, and last activity. Hide ratings and weighted results until the round freezes.

## Excel emergency export

The backup must work before the event loses Wi-Fi. Put **Download Excel backup** on the Group Case round page while the round is published or active. Restrict it to Board and Owner roles and record every download.

Generate one `.xlsx` workbook with these sheets:

### `START_HERE`

Include the cycle, round, export time, rubric version, file ID, and recovery instructions. State that each judge must use a separate copy. Include the exact route where the Board can re-enter or import the completed file.

### `GROUPS`

Include one row per group:

| group_id | group_name | case_title | service_line | phase | applicant_names | judge_names |
| --- | --- | --- | --- | --- | --- | --- |

### `SCORES`

Include one row per applicant and judge. Freeze the identity columns and use Excel validation lists for each rating.

| file_id | round_id | group_id | evaluator_id | application_id | applicant_name | collaboration_2x | problem_solving | leadership | judgment | composure_2x | presentation | evidence | flags | status |
| --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |

Permit `1`, `2`, `3`, `4`, `5`, or `N/O` in rating cells. Add formulas for observed weight and the weighted result. Protect formula and identity cells. Leave score cells blank in a pre-event backup. A live snapshot can include the current judge's saved draft only after an explicit warning.

### `RUBRIC`

Include every 1-through-5 anchor, the weights, the **Not observed** rule, and the note requirements. Judges must not need the application to interpret the workbook.

### `CHANGE_LOG`

Leave a table for the recovery owner to record the judge, time, reason, and any manual corrections.

### Add a simpler fallback too

Offer **Download Excel-ready CSV** beside the workbook. CSV has one `SCORES` table and no formulas. Excel, Numbers, and Google Sheets can open it. This file is the last fallback when workbook generation fails.

Prefix cells that begin with `=`, `+`, `-`, or `@` with an apostrophe. This prevents spreadsheet formula injection from applicant names or notes. Encode CSV as UTF-8 with a byte-order mark so Excel preserves punctuation and names.

### Plan recovery, not only export

An export that cannot return to the system is an archive, not disaster recovery. Add **Import completed backup** after the export format is stable.

The import flow must:

1. Validate the file ID, round ID, rubric version, evaluator ID, application ID, and allowed rating values.
2. Show a preview with new evaluations, duplicates, conflicts, and invalid rows.
3. Require a Board reason and a second confirmation.
4. Create ordinary individual evaluations through one audited database transaction.
5. Keep the original workbook as an audit attachment.

Never overwrite a submitted evaluation. Route duplicates to the existing correction process.

## Data contracts

Add these records:

- `group_case_judge_assignments` connects a group and a judge.
- `group_case_observations` stores private applicant evidence.
- `group_case_sessions` stores the operator-controlled phase.
- `emergency_exports` records the file ID, format, rubric version, creator, and checksum.
- `emergency_imports` records the source export, reviewer, result, and audit attachment.

Keep `evaluation_assignments`, `evaluations`, and `criterion_ratings` as the source of truth for submitted grades. The observation board prepares those records. It does not replace them.

## Failure states

Design these states before production code:

- a judge refreshes after writing three observations;
- one judge loses the network while the other stays online;
- the operator advances the phase while a judge types;
- an applicant has no observations;
- an applicant did not present;
- a judge declares a conflict halfway through the case;
- two judges submit different red flags;
- a workbook uses the wrong rubric version;
- a completed workbook contains a formula in a note cell;
- an import repeats an already submitted evaluation.

Store observation drafts on the server and in the browser. Show **Saved**, **Saving**, or **Saved on this device** beside the composer. Never clear the composer until one of those states is true.

## Build order

1. Prototype the observation screen and finish queue with four applicants on a phone and laptop.
2. Approve the weight contradiction, the **Not observed** rule, and the note rule.
3. Add the session, judge assignment, and observation contracts.
4. Build server and browser draft recovery.
5. Build the independent finish queue on the existing evaluation contract.
6. Add the operator coverage grid.
7. Add the audited `.xlsx` and CSV exports.
8. Run a full 90-minute rehearsal with one device offline.
9. Add the import only after the Board has approved the exported columns and recovery procedure.

## Acceptance checks

- A judge records an observation in three actions: select a person, select a dimension, and type the behavior.
- Switching applicants never moves or copies a note.
- The screen restores every saved observation after refresh.
- A judge can finish four six-dimension evaluations in ten minutes.
- Co-judge scores remain hidden until both judges submit.
- **Not observed** never becomes zero.
- Collaboration and Composure are the only doubled dimensions unless the Board changes the rubric.
- A pre-event export opens in current desktop Excel without a repair warning.
- The workbook contains every group, applicant, judge, rubric anchor, and stable ID.
- The CSV blocks spreadsheet formulas in every text column.
- Export and import actions appear in the audit log.
- A repeated import cannot create a second submitted evaluation.

## Decisions the Board must make

| Decision | Recommended answer |
| --- | --- |
| Which dimensions receive double weight? | Collaboration and Composure. This matches the formula and 40-point maximum. |
| Must every applicant present? | Yes, if Presentation remains a required dimension. Otherwise allow **Not observed**. |
| When can judges compare scores? | Only after both judges submit independently. |
| Do flags change the numeric result? | No. They require evidence and trigger discussion. |
| What is the emergency file of record? | The per-judge `.xlsx` workbook identified by `file_id`. |
| Can the Board import a completed workbook? | Yes, after preview, reason, confirmation, and duplicate checks. |
