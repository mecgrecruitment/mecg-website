import { isInRoundCohort } from "@/lib/round-cohort";
import { countsTowardCoverage, groupCaseCoverageState, REQUIRED_GROUP_CASE_EVALUATORS } from "../group-case-coverage";

type Application = { id: string; status: string };
type Assignment = { application_id: string; status: string };

// Staffing and persistence only. Neither assignment state nor a submitted form
// proves the rubric/quorum/independence gates that canonical results evaluate.
export function roundStaffingSummary({ roundKind, applications, assignments }: {
  roundKind: string;
  applications: readonly Application[];
  assignments: readonly Assignment[];
}) {
  const cohort = applications.filter((application) => isInRoundCohort(roundKind, application.status));
  const cohortIds = new Set(cohort.map((application) => application.id));
  const eligibleAssignments = assignments.filter((assignment) => cohortIds.has(assignment.application_id) && countsTowardCoverage(assignment.status));
  const statusesByApplication = new Map<string, string[]>();
  for (const assignment of eligibleAssignments) {
    const statuses = statusesByApplication.get(assignment.application_id) ?? [];
    statuses.push(assignment.status);
    statusesByApplication.set(assignment.application_id, statuses);
  }
  const coverage = cohort.map((application) => groupCaseCoverageState(statusesByApplication.get(application.id) ?? []));
  return {
    cohortSize: cohort.length,
    staffedTwice: coverage.filter((row) => row.assigned >= REQUIRED_GROUP_CASE_EVALUATORS).length,
    assignedForms: eligibleAssignments.length,
    submittedForms: coverage.reduce((count, row) => count + row.submitted, 0),
  };
}
