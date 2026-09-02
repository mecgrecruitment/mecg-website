export type RecruitmentAnalytics = {
  available: boolean;
  minimumCohort: number;
  advisoryOnly: boolean;
  funnel: Array<{ key: string; label: string; count: number }>;
  rounds: Array<{ roundName: string; assigned: number; completed: number; applicantCount: number; completionRate: number | null }>;
  workload: {
    suppressed: boolean;
    evaluatorCount: number;
    minimumCohort?: number;
    medianAssignments?: number;
    buckets?: Array<{ label: string; evaluatorCount: number }>;
  };
  criteria: Array<{
    roundName: string;
    criterionName: string;
    ratingCount: number;
    suppressed: boolean;
    average: number | null;
    spread: number | null;
  }>;
  evaluatorSignals: {
    suppressed: boolean;
    evaluatorCount: number;
    minimumCohort?: number;
    medianConsistency?: number;
    medianAbsoluteDrift?: number;
    highVarianceCount?: number;
    highDriftCount?: number;
  };
};

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function number(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function optionalNumber(value: unknown) {
  return value == null ? null : number(value);
}

function parseSuppressedBlock(value: unknown) {
  const row = record(value);
  const evaluatorCount = number(row?.evaluatorCount);
  if (!row || typeof row.suppressed !== "boolean" || evaluatorCount === null) return null;
  return { row, evaluatorCount };
}

export function parseRecruitmentAnalytics(value: unknown): RecruitmentAnalytics | null {
  const root = record(value);
  const minimumCohort = number(root?.minimumCohort);
  if (!root || typeof root.available !== "boolean" || minimumCohort === null) return null;
  if (!root.available) {
    return {
      available: false,
      minimumCohort,
      advisoryOnly: true,
      funnel: [],
      rounds: [],
      workload: { suppressed: true, evaluatorCount: 0, minimumCohort },
      criteria: [],
      evaluatorSignals: { suppressed: true, evaluatorCount: 0, minimumCohort },
    };
  }
  if (root.advisoryOnly !== true || !Array.isArray(root.funnel) || !Array.isArray(root.rounds) || !Array.isArray(root.criteria)) return null;

  const funnel = root.funnel.flatMap((value) => {
    const row = record(value);
    const count = number(row?.count);
    return row && typeof row.key === "string" && typeof row.label === "string" && count !== null
      ? [{ key: row.key, label: row.label, count }]
      : [];
  });
  const rounds = root.rounds.flatMap((value) => {
    const row = record(value);
    const assigned = number(row?.assigned);
    const completed = number(row?.completed);
    const applicantCount = number(row?.applicantCount);
    const completionRate = optionalNumber(row?.completionRate);
    return row && typeof row.roundName === "string" && assigned !== null && completed !== null && applicantCount !== null && (row.completionRate == null || completionRate !== null)
      ? [{ roundName: row.roundName, assigned, completed, applicantCount, completionRate }]
      : [];
  });
  const criteria = root.criteria.flatMap((value) => {
    const row = record(value);
    const ratingCount = number(row?.ratingCount);
    const average = optionalNumber(row?.average);
    const spread = optionalNumber(row?.spread);
    return row && typeof row.roundName === "string" && typeof row.criterionName === "string"
      && typeof row.suppressed === "boolean" && ratingCount !== null
      && (row.average == null || average !== null) && (row.spread == null || spread !== null)
      && (row.suppressed || average !== null)
      ? [{ roundName: row.roundName, criterionName: row.criterionName, ratingCount, suppressed: row.suppressed, average, spread }]
      : [];
  });
  if (funnel.length !== root.funnel.length || rounds.length !== root.rounds.length || criteria.length !== root.criteria.length) return null;

  const workloadBlock = parseSuppressedBlock(root.workload);
  const signalBlock = parseSuppressedBlock(root.evaluatorSignals);
  if (!workloadBlock || !signalBlock) return null;
  const workloadBuckets = Array.isArray(workloadBlock.row.buckets)
    ? workloadBlock.row.buckets.flatMap((value) => {
        const row = record(value);
        const evaluatorCount = number(row?.evaluatorCount);
        return row && typeof row.label === "string" && evaluatorCount !== null ? [{ label: row.label, evaluatorCount }] : [];
      })
    : undefined;
  if (Array.isArray(workloadBlock.row.buckets) && workloadBuckets?.length !== workloadBlock.row.buckets.length) return null;
  const medianAssignments = number(workloadBlock.row.medianAssignments);
  if (!workloadBlock.row.suppressed && (medianAssignments === null || !workloadBuckets)) return null;
  const medianConsistency = number(signalBlock.row.medianConsistency);
  const medianAbsoluteDrift = number(signalBlock.row.medianAbsoluteDrift);
  const highVarianceCount = number(signalBlock.row.highVarianceCount);
  const highDriftCount = number(signalBlock.row.highDriftCount);
  if (!signalBlock.row.suppressed && (medianConsistency === null || medianAbsoluteDrift === null || highVarianceCount === null || highDriftCount === null)) return null;

  return {
    available: true,
    minimumCohort,
    advisoryOnly: true,
    funnel,
    rounds,
    workload: {
      suppressed: workloadBlock.row.suppressed as boolean,
      evaluatorCount: workloadBlock.evaluatorCount,
      minimumCohort: number(workloadBlock.row.minimumCohort) ?? undefined,
      medianAssignments: medianAssignments ?? undefined,
      buckets: workloadBuckets,
    },
    criteria,
    evaluatorSignals: {
      suppressed: signalBlock.row.suppressed as boolean,
      evaluatorCount: signalBlock.evaluatorCount,
      minimumCohort: number(signalBlock.row.minimumCohort) ?? undefined,
      medianConsistency: medianConsistency ?? undefined,
      medianAbsoluteDrift: medianAbsoluteDrift ?? undefined,
      highVarianceCount: highVarianceCount ?? undefined,
      highDriftCount: highDriftCount ?? undefined,
    },
  };
}
