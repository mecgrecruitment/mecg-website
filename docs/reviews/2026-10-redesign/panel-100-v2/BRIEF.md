# V2: independent 100-agent acceptance panel

The user clarified “Create agents that act as the pannel.” This is an AI panel with simulated designer/expert and intended-user lenses. Agents are not real participants, Apple employees, clients or credentialed human experts. The coordinator is not a voter. Do not imply human endorsement, observed usability or statistical population agreement.

## Unchanged acceptance question

Independently assess the exact frozen V2 revision: **“Considering the design, clarity, accessibility, information, application, grading and operator workflows you reviewed, do you consider this revision a world-class website for its purpose?”** Return `agree`, `disagree` or `unproven`. There is no preferred answer, required score or unanimity target. Do not narrow the question to “did the implementation fix its bugs,” “is it shippable locally,” or “does it look polished.” Conditional approval, missing evidence, a good lab score, no finding or a ship recommendation is not an unqualified agree. Explain how the inspected evidence and important unknowns determine your own answer.

The original brief is included verbatim in ORIGINAL-BRIEF.md and in each materialized delegation prompt. It remains the original task context; V2 updates its snapshot/evidence locations and the following review-round mechanics. Earlier V1 report verdicts do not transfer to V2. Do not seek or infer other V2 seat votes before writing your own.

## Review a real revision, not an implementation response

Use only the final frozen path and snapshotId provided in the delegation prompt. Never review mutable working-tree source. Read PRODUCT.md, DESIGN.md, the final implementation-receipt.md, release-open-items.md, the V2 final evidence index, relevant original source/tests/logs and supplied captures. Read original source around claims; historical line numbers can be stale. The snapshot content manifest must identify the exact inspected package. Treat implementation receipts and nonvoting source QAs as claims to check, not acceptance votes.

Read prior-findings-and-responses.json, RESPONSES.md and UNRESOLVED.md from the frozen V2 package. Every original objection remains available, including dissent and design tradeoffs. Independently recheck the prior objections relevant to your lens/journey, verify the actual implementation response, and inspect for new regressions. A fix claim may be valid, incomplete, superseded, inapplicable or unverified; none prescribes your verdict. You need not invent a defect, repeat a stale defect, or treat every past suggestion as mandatory. Give exact current evidence for any finding.

Inspect at least the main public proposition, factual/privacy boundaries, one actual user journey and your assigned focal surface. Open relevant supplied captures when assessing visual craft. Public surfaces include Home/Work/Join/Team/Contact, header/footer and the engagement instrument. Private surfaces include application recovery/status, evaluator observations and validity, My Work continuity, round attention/closure, release diagnostics/review, owner provisioning and cohort navigation. New database contracts extend through migrations20261016201000; inspect relevant SQL and supplied runtime proof when judging these boundaries.

A supplied screenshot may be public, synthetic/private or a capture with a disclosed screenshot-only adjustment. Do not imply a synthetic harness is a live authenticated account or a screenshot is observed task success. Local intercepted APIs do not prove Clerk/Supabase/storage/Resend integration. Linux WebKit is not physical iPhone or macOS Safari. Lighthouse is a local lab, not field speed, ranking, conversion, accessibility certification or comprehension evidence.

## Identity, content and limits

Precision Instrument in DESIGN.md remains authoritative. Assess hierarchy, legibility, restraint, task feedback, useful motion and evidence honestly within that identity. Do not require a replacement palette/font or invent client outcomes to make a proof section feel complete. Original resume access is an explicitly disclosed current Board policy; neither filenames nor proxy streaming anonymize a PDF. An unresolved policy is not permission to alter a grading/access rule.

Known external gaps remain part of this broad question: the user says no staging exists; no hosted end-to-end acceptance has been supplied; approved project artifacts and current membership-workload facts are absent; Board decisions about policy/retention/remediation remain outstanding. Do not erase these gaps or automatically substitute fabricated evidence. Their consequence for world-class agreement is your independent judgment, stated plainly. Missing human evidence does not turn AI reviewers into human participants.

## Boundaries and report

Write only your own JSON report to the assigned V2 path. Do not modify implementation, frozen files, V1 records, other seats or the aggregate. Do not spawn agents, message externally, navigate a shared browser, write accounts, mutate databases, deploy or run full test suites. Relevant file/test/log reads and supplied image inspection are allowed; no web research is required.

Report schema:

- `seatId`, `lens`, `snapshotId` exactly identifying the assigned V2 seat/package.
- `worldClassAgreement`: `agree` / `disagree` / `unproven`.
- `releaseRecommendation`: `ship` / `hold` / `unproven`, distinct from world-class agreement.
- `reason`: concise rationale including inspected strengths, material limitations and how they affect your answer.
- `inspected`: actual snapshot-relative files, captures and logs read, including prior objections/responses and relevant current evidence.
- `findings`: at most three actionable findings, each `{severity, file, evidence, userImpact, suggestedFix}`. Include exact current source/function/line or supplied artifact evidence. Empty is permitted; evidence gaps can be explicit limitations instead of invented defects.
- `notVerified`: important unknowns, including externally dependent scope where relevant.

Aim for300–600words. Final response: verdict and report path. Missing/failed reports do not count as votes. Each seat is a fresh independently instantiated agent with its own actual task handle; no reused V1 child threads or multiple personas per agent count. Subsequent implementation invalidates this revision's approval as current acceptance; retain the historical votes and review the next identified snapshot independently. Never relabel dissent, discard objections or lower the criterion to manufacture100% agreement.
