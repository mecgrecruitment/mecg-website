# Pilot evidence protocol — proposed, not observed

Default to public/synthetic data. Owner, independent evaluator, baseline operator, maintainer and successor must accept roles before an operational pilot. Costs, review hours, deployment and client processing need actual task authority; no fictional approval is recorded here.

## Freeze before measuring

For each selected tool record: decision/task, scope and exclusions, dataset hash and licence, independent ground-truth author, clean/control cases, defect classes, severity, exact class denominators, tool/model/prompt revision, baseline operator skill, scoring rubric, operator order, total cost, review-hour ceiling, workload unit/ceiling, and stop rule. Keep development and sealed holdout distinct. If independence is infeasible, disclose it; do not make an independent-performance claim.

Preselect the strongest baseline through a documented configure-first bakeoff on development cases: manual template, generic AI with a good fixed prompt, and an eligible configured specialist. Give equal corpus, access and preparation allowance. Counterbalance operator/task order. Record preparation, review, corrections and export time, not just generation. Add amortized build/maintenance/training effort and model costs; report break-even uses. Do not silently select a weak baseline after seeing holdout results.

## Proposed statistical decision rule

For an operational quality claim, choose per-class sample counts before unsealing data. Do not score a tool against its own generated answer key. Proposed starting design: at least 100 positive examples per claimed defect class and 100 negative controls, across at least three independently prepared packs; expand if the intended lower-bound target cannot be established. Repeated runs of the same case are variation observations, not independent extra cases. Cluster/report by document when defects share context. Current implementation reports 95% Wilson intervals, raw hits/misses and no automatic pass; this differs from the initial review's exact-binomial suggestion and must be disclosed.

Proposed gate for claims described as at least 90% recall/precision: one-sided claim must be supported by the lower end of the reported 95% interval, not merely its point estimate. For a 95% claim use a 95% lower-bound threshold. If the interval fails, either obtain a new preregistered independent confirmation sample or narrow the claim; never tune on the sealed set then reuse it as confirmation. No missed predefined release blocker, unauthorized disclosure, fabricated evidence or material calculation error is acceptable in released work. Exact calculation/quote tests should be exhaustive on the finite supported input grammar as far as practical, with limits stated.

Efficiency feasibility gate is proposed 20% lower median total effort, no loss of substantive quality, and the fixed review ceiling met on every pack. Report each pack and uncertainty. Three packs alone do not establish generalized savings. Maintenance amortization may eliminate apparent benefit; stop custom work if the strongest practical baseline is equally useful. For larger-scope claims test an independently enlarged workload at fixed analyst/reviewer hours, retain raw coverage and serious-defect counts, and advertise only that observed envelope.

Tool-specific additions: research freshness and contradiction flags need precision and recall, including time/definition near-misses; feedback needs a stable human-human coding agreement rule, theme precision/recall by segment and severe-minority recall; process maps need stage/resource/edge/rework completeness against independently authored known maps, not merely correct arithmetic. Scope template acceptance requires a second PM to reconstruct all confirmed/tentative items and exercise a contradiction/change request. Handoff needs a truly fresh operator, not the author posing as one. Reviewer evaluation must include extraction omissions, natural errors if permissioned, false-alert ceiling, correlated source/model blind spots, and seeded misleading output caught by the human reviewer.

## Scale envelope to measure

| Workflow | Scale unit | Human bottleneck / limit to freeze | Stop / red line |
|---|---|---|---|
| Research | sources, decision questions, claims | semantic-review minutes, source discovery and licence checks | unverifiable decision-critical claims or unsupported comprehensive coverage |
| Feedback | records, themes, segments | adjudication and minority-theme review minutes | unknown denominators, untested languages, identity inference |
| Knowledge | passages, questions, revisions | corpus authority review and abstention review | confidential retrieval or access claims without enforced ACL lifecycle |
| Process | stages, resources, edges | process-owner observation and qualified map review | causal/simulation claim without measured data and expertise |
| Reporting | input rows, metrics, periods | exception reconciliation and metric-owner review | unexplained control difference or regulated assurance |
| Proposal | requirements, capabilities, items | real staffing and authorized commitment review | invented credentials, prices, dates or client-reference permission |
| Discovery | notes, requirements, decisions | source attribution and client-confirmation cycle | tentative requests silently becoming confirmed scope |
| Deliverable review | words, table cells, claims, requirements | original-file inspection and false-alert disposition minutes | uninspected visuals presented as verified; known material error released |
| Handoff | operator tasks, dependencies | fresh-recipient training and maintenance hours | unowned cost/access, critical task failure or indefinite support |

Input guards (300 rows per register, 600 KB imports) are not measured student capacity. Actual operational limits stay unclaimed until the named team completes the test. Regulated/highly sensitive personal data and client-dependent production operation remain outside this sandbox. Do not convert a successful synthetic exercise into authority to use real client data.
