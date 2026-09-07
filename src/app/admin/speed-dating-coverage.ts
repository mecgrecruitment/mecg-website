export type SpeedDatingCoverageAssignment = {
  applicationId: string;
  evaluatorId: string;
  evaluatorName: string;
  status: string;
};

export type SpeedDatingEvaluatorProgress = {
  evaluatorId: string;
  evaluatorName: string;
  submitted: number;
  assigned: number;
  state: "STARTED" | "COMPLETE" | "BROKEN";
};

export function speedDatingPairCoverage(
  applicationIds: readonly [string, string],
  assignments: readonly SpeedDatingCoverageAssignment[],
) {
  const allowed = new Set(applicationIds);
  const byEvaluator = new Map<string, SpeedDatingCoverageAssignment[]>();
  for (const assignment of assignments) {
    if (!allowed.has(assignment.applicationId) || ["RECUSED", "MISSED"].includes(assignment.status)) continue;
    const entries = byEvaluator.get(assignment.evaluatorId) ?? [];
    entries.push(assignment);
    byEvaluator.set(assignment.evaluatorId, entries);
  }

  const evaluators: SpeedDatingEvaluatorProgress[] = Array.from(byEvaluator.entries()).map(([evaluatorId, entries]) => {
    const assignedApplications = new Set(entries.map((entry) => entry.applicationId));
    const submitted = entries.filter((entry) => ["SUBMITTED", "LOCKED"].includes(entry.status)).length;
    const assigned = assignedApplications.size;
    const state: SpeedDatingEvaluatorProgress["state"] = assigned !== 2 ? "BROKEN" : submitted === 2 ? "COMPLETE" : "STARTED";
    return {
      evaluatorId,
      evaluatorName: entries[0]?.evaluatorName ?? "Unknown evaluator",
      submitted,
      assigned,
      state,
    };
  }).sort((a, b) => {
    const rank = (state: SpeedDatingEvaluatorProgress["state"]) => state === "BROKEN" ? 0 : state === "STARTED" ? 1 : 2;
    return rank(a.state) - rank(b.state) || a.evaluatorName.localeCompare(b.evaluatorName);
  });

  return {
    evaluators,
    completeEvaluators: evaluators.filter((evaluator) => evaluator.state === "COMPLETE").length,
    hasBrokenAssignment: evaluators.some((evaluator) => evaluator.state === "BROKEN"),
  };
}

export function speedDatingCoverageRank(coverage: ReturnType<typeof speedDatingPairCoverage>) {
  if (coverage.hasBrokenAssignment) return 0;
  if (coverage.completeEvaluators < 2) return 1;
  return 2;
}
