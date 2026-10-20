export type GroupCaseResults = {
  roundId: string;
  roundName: string;
  roundStatus: string;
  criteria: Array<{ id: string; key: string; name: string; weight: number; position: number; required: boolean }>;
  summary: { applicants: number; graded: number; graders: number; evaluations: number; saved: number; savedEvaluations: number };
  applicants: Array<{
    applicationId: string;
    name: string;
    status: string;
    groupName: string | null;
    count: number;
    savedCount: number;
    completionStatus: "PENDING" | "REVIEW" | "COMPLETE";
    mean: number | null;
    criterionMeans: Record<string, number | null>;
    evaluations: Array<{
      evaluatorId: string;
      evaluatorName: string;
      weighted: number | null;
      valid: boolean;
      coverage: number;
      minimumObserved: number;
      missingRequired: string[];
      scoredCount: number;
      criteriaCount: number;
      scores: Record<string, number | null>;
      note: string;
      submittedAt: string | null;
    }>;
  }>;
  graders: Array<{ evaluatorId: string; evaluatorName: string; count: number; savedCount: number; mean: number | null; notes: number }>;
};

type Evaluation = GroupCaseResults["applicants"][number]["evaluations"][number];

export function evaluationPrerequisites(evaluation: Evaluation) {
  const facts = [`${evaluation.scoredCount}/${evaluation.criteriaCount} criteria · ${Math.round(evaluation.coverage * 100)}% weighted coverage`];
  if (evaluation.valid) return `${facts[0]} · Valid evaluation`;
  if (evaluation.missingRequired.length) facts.push(`Required: ${evaluation.missingRequired.join(", ")}`);
  if (evaluation.scoredCount < evaluation.minimumObserved) facts.push(`Needs ${evaluation.minimumObserved} observed criteria`);
  if (evaluation.coverage < 0.75) facts.push("Needs 75% weighted coverage");
  return facts.join(" · ");
}

export function roundPrerequisites(applicant: GroupCaseResults["applicants"][number]) {
  if (applicant.savedCount === 0) return "No observations saved · Needs two valid independent evaluators";
  if (applicant.completionStatus === "REVIEW") return "Two valid evaluators reached · Score spread needs review";
  if (applicant.completionStatus === "COMPLETE") return "Two valid evaluators reached · Freeze and decision checks still apply";
  const invalid = applicant.evaluations.filter((evaluation) => !evaluation.valid);
  const missingRequired = [...new Set(invalid.flatMap((evaluation) => evaluation.missingRequired))];
  const facts = [`${applicant.count}/2 valid independent evaluators`];
  if (invalid.some((evaluation) => evaluation.coverage < 0.75)) facts.push("Incomplete weighted coverage");
  if (missingRequired.length) facts.push(`Missing required: ${missingRequired.join(", ")}`);
  if (invalid.some((evaluation) => evaluation.scoredCount < evaluation.minimumObserved)) facts.push("Too few observed criteria");
  return facts.join(" · ");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
function isNullableNumber(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}
function isNumberMap(value: unknown): value is Record<string, number | null> {
  return isRecord(value) && Object.values(value).every(isNullableNumber);
}
function isEvaluation(value: unknown): value is Evaluation {
  return isRecord(value)
    && typeof value.evaluatorId === "string" && typeof value.evaluatorName === "string"
    && typeof value.valid === "boolean" && isNullableNumber(value.weighted)
    && (value.valid ? value.weighted !== null : value.weighted === null)
    && typeof value.coverage === "number" && value.coverage >= 0 && value.coverage <= 1
    && isCount(value.minimumObserved) && isCount(value.scoredCount) && isCount(value.criteriaCount)
    && Array.isArray(value.missingRequired) && value.missingRequired.every((name: unknown) => typeof name === "string")
    && (!value.valid || (value.coverage >= 0.75 && value.scoredCount >= value.minimumObserved && value.missingRequired.length === 0))
    && isNumberMap(value.scores) && typeof value.note === "string"
    && (value.submittedAt === null || typeof value.submittedAt === "string");
}
function isApplicant(value: unknown): value is GroupCaseResults["applicants"][number] {
  if (!isRecord(value) || !isCount(value.count) || !isNullableNumber(value.mean)) return false;
  if (!Array.isArray(value.evaluations) || !value.evaluations.every(isEvaluation)) return false;
  const validEvaluators = new Set(value.evaluations.filter((evaluation) => evaluation.valid).map((evaluation) => evaluation.evaluatorId));
  if (validEvaluators.size !== value.count || value.evaluations.length !== value.savedCount) return false;
  const complete = value.completionStatus === "COMPLETE" || value.completionStatus === "REVIEW";
  return typeof value.applicationId === "string" && typeof value.name === "string" && typeof value.status === "string"
    && (value.groupName === null || typeof value.groupName === "string")
    && isCount(value.savedCount) && value.savedCount >= value.count
    && (complete ? value.count >= 2 && value.mean !== null : value.completionStatus === "PENDING" && value.count < 2 && value.mean === null)
    && isNumberMap(value.criterionMeans) && Array.isArray(value.evaluations) && value.evaluations.every(isEvaluation);
}

/** Validate RPC evidence at the boundary; a shallow shape must not label partial evidence complete. */
export function isGroupCaseResults(value: unknown): value is GroupCaseResults {
  return isRecord(value) && typeof value.roundId === "string" && typeof value.roundName === "string" && typeof value.roundStatus === "string"
    && isRecord(value.summary) && [value.summary.applicants, value.summary.graded, value.summary.graders, value.summary.evaluations, value.summary.saved, value.summary.savedEvaluations].every(isCount)
    && Array.isArray(value.criteria) && value.criteria.every((criterion: unknown) => isRecord(criterion)
      && typeof criterion.id === "string" && typeof criterion.key === "string" && typeof criterion.name === "string"
      && typeof criterion.weight === "number" && criterion.weight > 0 && Number.isFinite(criterion.weight)
      && isCount(criterion.position) && typeof criterion.required === "boolean")
    && Array.isArray(value.applicants) && value.applicants.every(isApplicant)
    && Array.isArray(value.graders) && value.graders.every((grader: unknown) => isRecord(grader)
      && typeof grader.evaluatorId === "string" && typeof grader.evaluatorName === "string"
      && isCount(grader.count) && isCount(grader.savedCount) && isNullableNumber(grader.mean) && isCount(grader.notes));
}
