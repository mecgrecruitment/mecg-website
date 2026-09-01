export function scoreEvaluation(
  criteria,
  ratings,
  minimumObservedCriteria = Math.min(3, criteria.length),
) {
  const ratingByCriterion = new Map(
    ratings.map((rating) => [rating.criterionId, rating.score]),
  );
  const totalWeight = criteria.reduce((sum, criterion) => sum + criterion.weight, 0);
  const observed = criteria.filter((criterion) => {
    const score = ratingByCriterion.get(criterion.id);
    return Number.isInteger(score) && score >= 1 && score <= 5;
  });
  const observedWeight = observed.reduce((sum, criterion) => sum + criterion.weight, 0);
  const missingRequired = criteria.some(
    (criterion) => criterion.required && !observed.includes(criterion),
  );
  const coverage = totalWeight === 0 ? 0 : observedWeight / totalWeight;
  if (
    coverage < 0.75
    || missingRequired
    || observed.length < minimumObservedCriteria
  ) {
    return { valid: false, score: null, coverage };
  }
  const weighted = observed.reduce(
    (sum, criterion) =>
      sum + criterion.weight * ((ratingByCriterion.get(criterion.id) - 1) / 4),
    0,
  );
  return {
    valid: true,
    score: (100 * weighted) / observedWeight,
    coverage,
  };
}

export function aggregateRound(evaluations) {
  const valid = evaluations.filter(
    (evaluation) => evaluation.valid && typeof evaluation.score === "number",
  );
  if (valid.length < 2) {
    return { status: "PENDING", score: null, count: valid.length, spread: null };
  }
  const scores = valid.map((evaluation) => evaluation.score);
  const score = scores.reduce((sum, value) => sum + value, 0) / scores.length;
  const spread = Math.max(...scores) - Math.min(...scores);
  return {
    status: spread >= 25 ? "REVIEW" : "COMPLETE",
    score,
    count: scores.length,
    spread,
  };
}

export function combineRoundScores(rounds) {
  const scored = rounds.filter((round) => round.weight > 0);
  const complete = scored.filter((round) => typeof round.score === "number");
  if (complete.length !== scored.length || complete.length === 0) return null;
  const weight = complete.reduce((sum, round) => sum + round.weight, 0);
  return complete.reduce((sum, round) => sum + round.score * round.weight, 0) / weight;
}
