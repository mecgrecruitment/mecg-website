import { roundPrerequisites, type GroupCaseResults } from "@/lib/group-case-results";

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

// Assignment status describes staffing/persistence. Only the canonical results
// contract can establish valid independent evidence or a score-spread review.
export function groupCaseEvidenceState(applicant: GroupCaseResults["applicants"][number] | undefined) {
  if (!applicant) return { state: "unknown", label: "Validity unavailable", detail: "Evidence validity is not available in this view. Ask the Board to check results.", needsAttention: true, rank: 0 } as const;
  if (applicant.completionStatus === "COMPLETE") return { state: "complete", label: "Valid evidence", detail: roundPrerequisites(applicant), needsAttention: false, rank: 3 } as const;
  if (applicant.completionStatus === "REVIEW") return { state: "review", label: "Score spread review", detail: roundPrerequisites(applicant), needsAttention: true, rank: 2 } as const;
  return { state: "incomplete", label: "Evidence incomplete", detail: roundPrerequisites(applicant), needsAttention: true, rank: 1 } as const;
}

export function groupCaseStaffingLabel(coverage: ReturnType<typeof groupCaseCoverageState>) {
  return coverage.state === "SUBMITTED"
    ? "All assigned forms submitted"
    : `${coverage.submitted}/${coverage.assigned} forms submitted · ${coverage.assigned}/${REQUIRED_GROUP_CASE_EVALUATORS} evaluators assigned`;
}
