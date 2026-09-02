const VALID_SCORES = new Set(["", "1", "2", "3", "4", "5"]);
const RECOMMENDATIONS = new Set(["", "ADVANCE", "HOLD", "DECLINE"]);

export type ScreeningDraft = {
  ratings: Array<{ criterionId: string; score: string; note: string }>;
  evidence: string;
  recommendation: string;
};

export function parseScreeningDraft(value: unknown): ScreeningDraft | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const { ratings: rawRatings, evidence, recommendation } = value as Record<string, unknown>;
  if (!Array.isArray(rawRatings) || rawRatings.length === 0 || rawRatings.length > 50) return null;
  if (typeof evidence !== "string" || evidence.length > 6000) return null;
  if (typeof recommendation !== "string" || !RECOMMENDATIONS.has(recommendation)) return null;
  const ratings: ScreeningDraft["ratings"] = [];
  for (const item of rawRatings) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const { criterionId, score, note } = item as Record<string, unknown>;
    if (
      typeof criterionId !== "string"
      || !criterionId
      || criterionId.length > 200
      || typeof score !== "string"
      || !VALID_SCORES.has(score)
      || typeof note !== "string"
      || note.length > 2000
    ) return null;
    ratings.push({ criterionId, score, note });
  }
  if (new Set(ratings.map((rating) => rating.criterionId)).size !== ratings.length) return null;
  return { ratings, evidence, recommendation };
}

export type ScreeningProgress = {
  completed: number;
  total: number;
  deadline: string | null;
  publishedAt: string | null;
};

export function parseScreeningProgress(value: unknown): ScreeningProgress | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (
    typeof input.completed !== "number"
    || !Number.isInteger(input.completed)
    || input.completed < 0
    || typeof input.total !== "number"
    || !Number.isInteger(input.total)
    || input.total < input.completed
    || (input.deadline !== null && typeof input.deadline !== "string")
    || (input.publishedAt !== null && typeof input.publishedAt !== "string")
  ) return null;
  return {
    completed: input.completed,
    total: input.total,
    deadline: input.deadline as string | null,
    publishedAt: input.publishedAt as string | null,
  };
}

export function screeningDeadlineLabel(deadline: string | null) {
  if (!deadline) return "No deadline is set";
  const date = new Date(deadline);
  if (Number.isNaN(date.getTime())) return "Deadline unavailable";
  return `Due ${new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date)}`;
}
