# 100-agent acceptance panel

The user explicitly clarified on 2026-10-16: “Create agents that act as the pannel.” This is an AI review panel. Agents are not real designers/users, Apple employees, clients or research participants. The earlier real-participant study remains optional historical preparation. Never present these reviews as human endorsement, usability observation or consensus outside their actual inspected scope.

## Question and scope

Independently assess the identified local MECG revision: “Considering the design, clarity, accessibility, information, application, grading and operator workflows you reviewed, do you consider this revision a world-class website for its purpose?” Return **agree**, **disagree**, or **unproven** with reasons and exact evidence. There is no preferred answer. Conditional approval, a good score, no finding or lack of evidence is not an unqualified agree. Do not claim uninspected behavior works. Missing hosted or user evidence remains missing; decide its consequence honestly rather than inventing a result.

Every panel seat is one separately spawned agent with a unique task name and independent report. One agent writing multiple personas does not count. Prior implementation agents and earlier source reviews do not count toward these 100 seats. A coordinator manages the manifest and aggregate but is not a voter. There are 50 design/expert lenses and 50 intended-user lenses, with separate focal tasks, not claims of personal credentials. The seats file assigns a lens and concrete task. Reviewers see no other votes before their own verdict.

## Read the current evidence

Review only the frozen snapshot named in the coordinator prompt, not concurrent implementation files. Its content manifest identifies the exact package. Read `docs/PRODUCT.md`, `docs/DESIGN.md`, `docs/reviews/2026-10-redesign/implementation-receipt.md`, `release-open-items.md` and relevant actual source/tests. The receipt is a report; confirm what its checks actually cover from the supplied logs/tests. Existing audit reports are historical snapshots, not current defects or vote guidance. Earlier “ship” reviews are scope-limited and do not establish your verdict.

Public surfaces: `src/app/(marketing)/{home,work,join,team,contact}`, shared header/footer and engagement instrument. Private surfaces: application form/recovery and applicant status; evaluation entry and readiness; round evidence/results and operator controls; decision release snapshot; owner provisioning incidents. Migrations 1900 through 1950 contain the new database contracts. Tests and `evidence/` contain the actual local proof. `captures/` contains public desktop/mobile and synthetic operator modal captures; source/SSR reviews are the available evidence for other private screens. Do not imply a screenshot came from live authenticated data.

Inspect at least the main public proposition, one actual user journey, the factual/privacy boundaries, and your seat's focal surface. Read original source around any finding; do not repeat stale audit line numbers or another agent's unsupported claim. Open supplied relevant captures when assessing visual craft. If evidence is insufficient for a broad verdict, say so. Static source review is not observed task success.

The established identity is Precision Instrument. Do not demand a new palette or loaded font contrary to DESIGN.md; judge its coherence and legibility in context. Case-study outcomes and project artifacts require client approval and must not be fabricated. Original resume access is an existing disclosed Board policy; do not call filenames or streaming anonymization. Local API mocks do not prove Clerk/Supabase/storage/email integration. The user says no staging environment exists; there has been no deployment or hosted acceptance test. No conversion/SEO multiplier or measured human usability gain is claimed.

## Deliverable

Write only your own JSON report to the path specified by the coordinator; do not modify implementation, snapshot, other reports or the aggregate. Do not launch agents, send messages externally, write accounts, mutate a database, run the whole test suite or navigate a shared browser. Relevant source, test/log reads and supplied image inspection are permitted. No web research is required; Awwwards references and source limitations are already recorded.

Report schema:

- `seatId`, `lens`, `snapshotId`
- `worldClassAgreement`: `agree` / `disagree` / `unproven`
- `releaseRecommendation`: `ship` / `hold` / `unproven`
- `reason`: short plain-language rationale, including meaningful scope/limits
- `inspected`: actual snapshot-relative files, captures and evidence read
- `findings`: at most three actionable findings, each `{severity, file, evidence, userImpact, suggestedFix}`. No invented defects merely to fill the list.
- `notVerified`: explicit important unknowns

Keep each report around 300–600 words. Cite exact file/function/line or artifact evidence for findings. Your final response should state the verdict and report path. Missing/failed reports are not votes. The parent must fix material findings and seek a new independent review of the resulting snapshot; old votes are historical, not current approval of changed code. Never coerce unanimity by changing verdict labels, discarding dissenters or silently narrowing the question.
