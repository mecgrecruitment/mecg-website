const VALID_DRAFT_SCORES = new Set(["", "1", "2", "3", "4", "5", "NO"]);
const MAX_RATINGS = 50;
const MAX_NOTE_LENGTH = 2000;
const MAX_EVIDENCE_LENGTH = 4000;

export type EvaluationDraftPayload = {
  ratings: Array<{ criterionId: string; score: string; note: string }>;
  evidence: string;
};

export function parseEvaluationDraftPayload(value: unknown): EvaluationDraftPayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const { ratings: rawRatings, evidence: rawEvidence } = value as Record<string, unknown>;
  if (!Array.isArray(rawRatings) || rawRatings.length === 0 || rawRatings.length > MAX_RATINGS) return null;
  if (typeof rawEvidence !== "string" || rawEvidence.length > MAX_EVIDENCE_LENGTH) return null;

  const ratings: EvaluationDraftPayload["ratings"] = [];
  for (const entry of rawRatings) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
    const { criterionId, score, note } = entry as Record<string, unknown>;
    if (
      typeof criterionId !== "string"
      || !criterionId
      || criterionId.length > 200
      || typeof score !== "string"
      || !VALID_DRAFT_SCORES.has(score)
      || typeof note !== "string"
      || note.length > MAX_NOTE_LENGTH
    ) return null;
    ratings.push({ criterionId, score, note });
  }
  if (new Set(ratings.map((rating) => rating.criterionId)).size !== ratings.length) return null;
  return { ratings, evidence: rawEvidence };
}
