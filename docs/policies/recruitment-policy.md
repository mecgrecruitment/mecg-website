# MECG recruitment policy

Status: Board approval required
Drafted: 2026-09-01
Effective cycle: not assigned

This document separates rules the application enforces today from decisions the Board must approve. The current behavior is not Board approval.

## Current enforced defaults

The application currently enforces these rules:

- Speed Dating has weight 40.
- Group Case has weight 60.
- Hash does not add a numeric score.
- A rating uses 1 through 5 or `N/O`.
- A required criterion cannot use `N/O`.
- An evaluation needs at least 75 percent observed rubric weight.
- A round score needs two valid independent evaluations.
- A score spread of 25 points or more enters review.
- Attendance does not affect merit scores.
- Submitted evaluations are immutable.
- Conflicted users cannot evaluate, view protected evidence, approve, or release the affected applicant.
- Two distinct conflict-free approvals lock a decision.
- An applicant sees an outcome only after release.

## Decisions that block policy approval

The Board must complete this table.

| Decision | Current default | Board decision | Approver | Approval date |
| --- | --- | --- | --- | --- |
| Meaning of Hash | Blind evidence deliberation with no score | Unresolved | Board | Unresolved |
| Decision-panel roles | `PANEL` and authorized owners | Unresolved | Board | Unresolved |
| Approval quorum | Two conflict-free approvers | Unresolved | Board | Unresolved |
| Member access to released aggregates | No access | Unresolved | Board | Unresolved |
| Applicant feedback | Outcome message only | Unresolved | Board | Unresolved |
| Excused missed-round assessment | No approved alternate | Unresolved | Board | Unresolved |
| Late evaluation handling | Hard rejection after freeze | Unresolved | Board | Unresolved |
| Evaluation correction | No complete Board workflow | Unresolved | Board | Unresolved |
| Decision correction | Superseding record proposed | Unresolved | Board | Unresolved |
| Applicant and resume retention | No approved period | Unresolved | Board and privacy owner | Unresolved |
| Evaluation and decision retention | No approved period | Unresolved | Board and privacy owner | Unresolved |

## Approval procedure

1. The VP Recruitment proposes each unresolved value.
2. The privacy owner reviews retention and applicant-communication rules.
3. The Board votes on the complete policy.
4. The secretary records the vote in meeting minutes.
5. The engineering owner assigns a version and effective cycle.
6. Engineering implements missing controls and tests.
7. The Board runs acceptance testing in staging.
8. The Board President signs the release record.

## Change control

- Approve policy changes before the affected cycle opens.
- Do not change weights, rubrics, evidence requirements, or quorum after live evaluation starts.
- If an emergency requires a change, record the reason, affected applicants, approvers, and remediation.
- Keep each superseded policy version with its effective cycles.
