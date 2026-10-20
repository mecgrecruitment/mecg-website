// Match the round workspace's current active-stage cohort. Progressed applicants
// remain in earlier interview rounds; withdrawn/terminal applicants do not.
// This is a routing/staffing cohort rule, never an evaluation-validity rule.
export function isInRoundCohort(roundKind: string, applicationStatus: string) {
  if (roundKind === "SPEED_DATING") return ["INVITED", "GROUP_CASE", "IN_PROCESS", "FINAL_REVIEW"].includes(applicationStatus);
  if (roundKind === "GROUP_CASE") return ["GROUP_CASE", "IN_PROCESS", "FINAL_REVIEW"].includes(applicationStatus);
  return !["DRAFT", "WITHDRAWN", "REJECTED", "WAITLISTED", "OFFERED"].includes(applicationStatus);
}
