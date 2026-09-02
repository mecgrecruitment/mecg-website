export type DecisionRoundEvidence = {
  id: string;
  name: string;
  status: string;
  weight: number;
  lockedEvaluations: number;
  aggregateStatus?: string;
  spread?: number | null;
};

export type DecisionReadinessIssue = {
  key: string;
  kind: "blocker" | "review";
  label: string;
};

const CLOSED_ROUND_STATUSES = new Set(["FROZEN", "FINALIZED"]);

export function cycleReadinessIssues(cycleStatus: string, rounds: DecisionRoundEvidence[]) {
  const issues: DecisionReadinessIssue[] = [];
  const weightedRounds = rounds.filter((round) => round.weight > 0);

  if (cycleStatus !== "DECISION_LOCK") {
    issues.push({ key: "cycle", kind: "blocker", label: "Move the cycle to voting and decisions." });
  }
  if (!weightedRounds.length) {
    issues.push({ key: "rounds", kind: "blocker", label: "Add at least one weighted review round." });
  }
  for (const round of weightedRounds) {
    if (!CLOSED_ROUND_STATUSES.has(round.status)) {
      issues.push({ key: `round-${round.id}`, kind: "blocker", label: `Freeze ${round.name}.` });
    }
  }

  return issues;
}

export function applicantReadinessIssues(
  rounds: DecisionRoundEvidence[],
  canonicalReady?: boolean,
) {
  const issues: DecisionReadinessIssue[] = [];
  const weightedRounds = rounds.filter((round) => round.weight > 0);

  if (!weightedRounds.length) {
    issues.push({ key: "rounds", kind: "blocker", label: "No weighted review round." });
  }
  for (const round of weightedRounds) {
    if (!CLOSED_ROUND_STATUSES.has(round.status)) {
      issues.push({ key: `round-${round.id}`, kind: "blocker", label: `${round.name} is not frozen.` });
    }
    if (round.lockedEvaluations < 2) {
      issues.push({
        key: `coverage-${round.id}`,
        kind: "blocker",
        label: `${round.name} needs ${2 - round.lockedEvaluations} more locked evaluation${round.lockedEvaluations === 1 ? "" : "s"}.`,
      });
    }
    if (round.aggregateStatus === "REVIEW") {
      issues.push({
        key: `spread-${round.id}`,
        kind: "review",
        label: `${round.name} has a wide score spread${round.spread == null ? "" : ` (${round.spread.toFixed(0)})`}.`,
      });
    }
  }

  const locallyReady = weightedRounds.length > 0
    && weightedRounds.every((round) => CLOSED_ROUND_STATUSES.has(round.status) && round.lockedEvaluations >= 2);
  if (canonicalReady === false && locallyReady) {
    issues.push({ key: "canonical", kind: "blocker", label: "The decision evidence check is not yet satisfied." });
  }

  return {
    ready: canonicalReady ?? locallyReady,
    issues,
  };
}
