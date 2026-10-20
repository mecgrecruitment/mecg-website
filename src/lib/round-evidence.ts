import { aggregateRound, scoreEvaluation, type CriterionInput } from "./evaluation.js";

type EvaluationEvidence = {
  id: string;
  status: string;
  rubric_id: string;
  version: number;
  voided_at: string | null;
  criterion_ratings: Array<{ criterion_id: string; score: number | null }>;
};
type AssignmentEvidence = {
  round_id: string;
  evaluator_id: string;
  evaluations: EvaluationEvidence[];
};
type RoundRubric = {
  id: string;
  minimum_observed_criteria: number;
  rubric_criteria: CriterionInput[];
};

/** One latest nonvoid observation per independent evaluator, using the frozen rubric contract. */
export function roundEvidence({ roundId, rubric, assignments }: {
  roundId: string;
  rubric: RoundRubric | undefined;
  assignments: AssignmentEvidence[];
}) {
  const latestByEvaluator = new Map<string, EvaluationEvidence>();
  for (const assignment of assignments) {
    if (assignment.round_id !== roundId) continue;
    const latest = assignment.evaluations.filter((evaluation) => evaluation.voided_at === null)
      .reduce<EvaluationEvidence | undefined>((current, evaluation) =>
        !current || evaluation.version > current.version ? evaluation : current, undefined);
    if (!latest) continue;
    const existing = latestByEvaluator.get(assignment.evaluator_id);
    // The database enforces one assignment per evaluator; grouping here also
    // keeps duplicate transport rows from manufacturing independent evidence.
    if (!existing || latest.version > existing.version) latestByEvaluator.set(assignment.evaluator_id, latest);
  }
  const scored = [];
  let lockedEvaluations = 0;
  for (const evaluation of latestByEvaluator.values()) {
    if (!rubric || evaluation.rubric_id !== rubric.id || !["SUBMITTED", "LOCKED"].includes(evaluation.status)) continue;
    const result = scoreEvaluation(rubric.rubric_criteria,
      evaluation.criterion_ratings.map((rating) => ({ criterionId: rating.criterion_id, score: rating.score })),
      rubric.minimum_observed_criteria);
    scored.push(result);
    if (evaluation.status === "LOCKED" && result.valid) lockedEvaluations += 1;
  }
  return { aggregate: aggregateRound(scored), lockedEvaluations };
}
