# Operator evidence attention — later than V1

Panel081/082 found a real disagreement between assignment coverage and canonical Group Case quality: two submitted partial observations could appear Complete on the attention board while results and close-summary data correctly remained incomplete.

The board now keeps these measures separate. Staffing says how many evaluators are assigned and how many forms were submitted; a status-only receipt says “All assigned forms submitted.” Canonical `group_case_results` supplies evidence completion, valid independent evaluator count and rubric blockers. Incomplete, unknown and score-spread-review states stay in the attention count and precede valid evidence in ordering. Only canonical COMPLETE removes evidence from that queue. Valid evidence still explicitly retains freeze and decision checks.

This uses the existing validated and permission-scoped results read. Recruitment Committee accounts do not gain score access: their view reports validity unavailable and keeps attention visible, asking the Board to check results. No new database grant, SQL mutation, grading threshold or service-role read was added.

Eight coverage regressions pass, including two submitted forms with zero valid evaluations and missing required/weighted coverage, score-spread attention, restricted evidence, and valid completion. The combined Node suite passes722 checks; TypeScript, lint and production build pass. Independent bounded source QA is in `panel-100/post-v1-round-coverage-review.md`. No live operator observation or hosted close/release was performed. The historical V1 reports and votes remain unchanged.
