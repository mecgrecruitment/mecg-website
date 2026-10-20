# Consequential operator reviews and cohort scale

Later-tree response to frozen panel083/086. No vote or snapshot was changed.

Advancement and batch-release reviews now return focus to their trigger on cancellation. Successful advancement focuses its receipt; verified batch release focuses its result region. Entering a release review focuses the cohort region. An uncertain advancement clears the old confirmation and selection, refreshes current state and asks the operator to inspect the Speed Dating roster before another review.

Advancement now has a15-second full-response deadline. It accepts only a receipt for the selected cohort count with an actual round ID and nonnegative integer assignment/notification counts. It no longer invents two new assignments per applicant when a response is malformed. Existing server authorization, atomic staffing, enrollment and duplicate protection are unchanged; an unknown acknowledgement is not treated as non-commit.

Batch-release review supports applicant-code search, eligibility and outcome filters, full-cohort outcome totals, a bounded scroll region and an action area before the list. The view explicitly explains that filtering does not change the release cohort. The writer still sends `releaseSnapshot(review)` for the complete reviewed set, not the filtered rows. A mixed500-outcome browser case verifies333eligible/167blocked, a42-row filtered view, cancellation/reopening and a full500-item snapshot submitted from a blocked-only view. Result focus and the733-check Node baseline also pass.

`EVIDENCE_NOT_READY` guidance now distinguishes collecting evidence while grading is open from owner escalation when a required round is closed. It points to the existing applicant dossier/round results instead of promising that closed grading can reopen. The current reason code does not identify the affected round itself; this remains conditional guidance rather than a new round-specific diagnostic contract. Release safeguards and grading policy remain unchanged.

Verification: **35/35** browser checks passed across the five configurations, including mixed large-cohort filters, advancement/release cancellation and receipt focus, malformed/lost/stalled advancement responses, and release acknowledgement recovery. Raw log: `evidence/operator-review-browser.log`. Node helper coverage confirms unchanged snapshots, valid actual counts, rejected malformed receipts and closed-round escalation copy. TypeScript, lint and production build pass.

The initial14-check run had12passes and two label-locator failures. Investigation found that the nested select labels included option text in their accessible names. Explicit unique IDs and separate labels corrected the component; the full35-check run then passed. The earlier log is retained. All cohorts, identities and network responses in this browser evidence are synthetic; no advancement, release, email or hosted record was changed.
