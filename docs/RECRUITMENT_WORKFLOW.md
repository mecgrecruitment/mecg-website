# Recruitment workspace

The internal recruitment product has five primary destinations:

1. **My Work** — each person’s prioritized reviews, evaluations, observations, and recent completions.
2. **Recruitment** — applicant attention queues, roster, referrals, and guarded stage actions.
3. **Interviews** — round readiness, rubrics, assignments, groups, events, attendance, and results.
4. **Decisions** — evidence blockers, exceptions, ranked readiness, Hash, approval, and release.
5. **Communications** — compose, history, delivery failures, and retries.

Activity remains an unlisted audit record. Website projects remain outside recruitment. Legacy Quick Chats, Group Case, Groups, and notification URLs redirect into the consolidated workspaces.

## Anonymous application screening

- Only active `RECRUITMENT_COMMITTEE` members without Board, Panel, or Owner access are eligible.
- A review pool can contain more than three members, but every application is assigned to exactly three distinct, conflict-free reviewers.
- Assignment is capacity-aware and workload-balanced.
- Reviewers receive a candidate code and written responses, never applicant identity, contact information, resume, peer scores, or decision data.
- Drafts save privately to the server and retain a browser recovery copy.
- Freezing is blocked until every application has three submitted reviews; freezing locks them.

## Advance to Speed Dating

Board and Owner users can select eligible applicants in Recruitment and run **Advance to Speed Dating**. One database transaction:

1. Verifies the latest anonymous screening batch is frozen with three locked committee reviews per applicant.
2. Snapshots the active Speed Dating rubric and assignment policy.
3. Creates a round participation record.
4. Selects two distinct, conflict-free evaluators using least-open-workload balancing and capacity limits.
5. Creates formal evaluation assignments, which immediately appear in My Work.
6. Moves eligible applicants to invited status.
7. Enqueues evaluator assignment notices with stable idempotency keys. Applicants are not emailed; the Board announces rounds on its own schedule.
8. Writes applicant, assignment, participation, and batch audit events.

If any selected applicant cannot be fully staffed, the whole command rolls back. Retrying the same completed command does not duplicate participation, assignments, or notifications.

After advancement, the Board starts the round from the round page. Groups are formed off-app. On the night an evaluator searches the two or three applicants at their table, starts the group, scores everyone in it, and submits once. The Board sees the groups and evaluator coverage on the round page.

## Grading

Formal rubric evaluations are the only merit score.

- Evaluators see anchored 1–5 controls, per-criterion evidence, completion progress, and a final review step.
- Drafts autosave to a private server record and a scoped browser recovery copy.
- Drafts resume across devices and are inaccessible to other evaluators.
- Final submission is explicit, immutable, and clears both draft copies.
- Event check-in and qualitative observations never affect applicant scores, rank, readiness, or decisions.
- Calibration acknowledgement confirms that the evaluator reviewed the active rubric guidance; drift is advisory and never changes a score automatically.

## Decisions and exceptions

Every manual, approval, Hash-derived, and release path uses the same database readiness gate. Every weighted round must be frozen or finalized and contain at least two distinct locked evaluations for the applicant.

The Decisions page leads with blockers such as unfinished rounds, missing evaluations, conflicts, and high score spread. Declaring a conflict voids the declarer’s evidence and attempts an immediate least-loaded replacement. If no replacement exists, an audited exception remains visible.

## Applicant journey and onboarding

- Sign-in preserves safe requested destinations, including QR check-in URLs.
- Application drafts save the exact four-step position to the server with browser recovery.
- The applicant portal presents one prioritized next action and supports calendar downloads.
- Accepted offers create an idempotent five-step onboarding checklist. Applicants can confirm their contact/profile steps; Board or Owner users assign and complete operational handoff steps. Membership is never granted automatically.

## Local verification

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. Before merging, run:

```bash
npm run lint
npx tsc --noEmit
npm test
npm run check:sql
```

Database migrations must also be run against a configured Supabase test project before production rollout.
