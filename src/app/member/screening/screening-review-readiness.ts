export type ScreeningCriterionInput = { id: string; name: string };

export type ScreeningReviewDraft = {
  scores: Record<string, string>;
  notes: Record<string, string>;
  evidence: string;
  recommendation: string;
};

export type ScreeningReviewBlocker =
  | { field: "score"; criterionId: string; message: string }
  | { field: "note"; criterionId: string; message: string }
  | { field: "evidence"; message: string }
  | { field: "recommendation"; message: string };

export function screeningReviewBlocker(
  criteria: ScreeningCriterionInput[],
  draft: ScreeningReviewDraft,
  minimumEvidenceLength = 20,
): ScreeningReviewBlocker | null {
  for (const criterion of criteria) {
    const score = Number(draft.scores[criterion.id]);
    if (!Number.isInteger(score) || score < 1 || score > 5) {
      return { field: "score", criterionId: criterion.id, message: `Choose a rating for ${criterion.name}.` };
    }
    if ((score === 1 || score === 2 || score === 5) && !(draft.notes[criterion.id] ?? "").trim()) {
      return {
        field: "note",
        criterionId: criterion.id,
        message: `Add a brief evidence note for the ${score} rating on ${criterion.name}.`,
      };
    }
  }
  if (draft.evidence.trim().length < minimumEvidenceLength) {
    return { field: "evidence", message: `Recommendation rationale must be at least ${minimumEvidenceLength} characters.` };
  }
  if (!draft.recommendation) return { field: "recommendation", message: "Choose a recommendation." };
  return null;
}

export function screeningRecommendationWarning(scores: Record<string, string>, recommendation: string) {
  const numericScores = Object.values(scores).map(Number).filter((score) => Number.isInteger(score) && score >= 1 && score <= 5);
  if (!numericScores.length) return null;
  const average = numericScores.reduce((sum, score) => sum + score, 0) / numericScores.length;
  if (recommendation === "ADVANCE" && average < 3) {
    return "Your recommendation is Advance, while the average criterion rating is below 3. Confirm that the written rationale explains why.";
  }
  if (recommendation === "DECLINE" && average > 3) {
    return "Your recommendation is Do not advance, while the average criterion rating is above 3. Confirm that the written rationale explains why.";
  }
  return null;
}
