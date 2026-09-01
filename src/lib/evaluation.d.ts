export type CriterionInput = { id: string; weight: number; required: boolean };
export type RatingInput = { criterionId: string; score: number | null };
export type ScoredEvaluation = { valid: boolean; score: number | null; coverage: number };
export type RoundAggregate = {
  status: "PENDING" | "REVIEW" | "COMPLETE";
  score: number | null;
  count: number;
  spread: number | null;
};

export function scoreEvaluation(
  criteria: CriterionInput[],
  ratings: RatingInput[],
  minimumObservedCriteria?: number,
): ScoredEvaluation;
export function aggregateRound(evaluations: ScoredEvaluation[]): RoundAggregate;
export function combineRoundScores(
  rounds: { score: number | null; weight: number }[],
): number | null;
