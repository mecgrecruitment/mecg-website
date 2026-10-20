# Separate current-tree round coverage source QA

Coordinator source QA only; not a V1 vote. Inspected admin/round-board.tsx data loading, evidence join, ordering, counts and labels, and admin/group-case-coverage.ts helper.

No actionable defect found in the targeted staffing-versus-validity change by source inspection. Assignment-derived figures are labeled staffing/forms submitted. The attention queue joins canonical Group Case result rows by application ID and uses completionStatus plus roundPrerequisites for evidence explanation. COMPLETE alone clears the attention flag; REVIEW remains a distinct score-spread concern; missing results remain unknown and require attention. Evidence rank precedes staffing rank in ordering. The existing results permission controls the RPC; this revision adds no grant for committee roles.

Limits: did not reproduce browser or SQL checks; no hosted permission/session exercise. Existing result payload assumptions and unrelated cohort selection were not comprehensively re-audited. This narrow source result provides no broader acceptance and leaves every frozen V1 panel report unchanged.
