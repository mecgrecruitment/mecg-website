export const REQUIRED_GROUP_CASE_EVALUATORS = 2;

const ACTIVE_ASSIGNMENT_STATUSES = new Set(["ASSIGNED", "IN_PROGRESS", "SUBMITTED", "LOCKED"]);
const SUBMITTED_ASSIGNMENT_STATUSES = new Set(["SUBMITTED", "LOCKED"]);

export type GroupCaseCoverageState = "UNASSIGNED" | "PARTIAL" | "IN_PROGRESS" | "SUBMITTED";

export function countsTowardCoverage(status: string) {
  return ACTIVE_ASSIGNMENT_STATUSES.has(status);
}

export function groupCaseCoverageState(
  statuses: readonly string[],
  requiredEvaluators = REQUIRED_GROUP_CASE_EVALUATORS,
): { assigned: number; submitted: number; state: GroupCaseCoverageState } {
  const activeStatuses = statuses.filter(countsTowardCoverage);
  const assigned = activeStatuses.length;
  const submitted = activeStatuses.filter((status) => SUBMITTED_ASSIGNMENT_STATUSES.has(status)).length;
  const state = assigned === 0
    ? "UNASSIGNED"
    : assigned < requiredEvaluators
      ? "PARTIAL"
      : submitted >= requiredEvaluators && submitted === assigned
        ? "SUBMITTED"
        : "IN_PROGRESS";
  return { assigned, submitted, state };
}

export function groupCaseCoverageRank(state: GroupCaseCoverageState) {
  return { UNASSIGNED: 0, PARTIAL: 1, IN_PROGRESS: 2, SUBMITTED: 3 }[state];
}
