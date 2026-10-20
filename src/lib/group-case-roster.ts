export type GroupCaseSpeedDating = { adjusted: number | null; mean: number | null; count: number };

export type GroupCaseCriterion = { id: string; name: string; description: string; weight: number; required: boolean };

// criterionId -> 1..5, or null when the member marked it not observed.
export type GroupCaseScores = Record<string, number | null>;

export type GroupCaseQuality = {
  valid: boolean;
  coverage: number;
  observedCount: number;
  criteriaCount: number;
  minimumObserved: number;
  missingRequired: string[];
};

export type GroupCaseRatingResult = {
  applicationId: string;
  scores: GroupCaseScores;
  note: string;
  savedAt: string;
  // Absent with an older database; never infer validity from the score count.
  quality?: GroupCaseQuality | null;
};

export type GroupCaseApplicant = {
  revision: string | null;
  applicationId: string;
  name: string;
  scores: GroupCaseScores;
  note: string;
  savedAt: string | null;
  quality?: GroupCaseQuality | null;
  // Present only for Board roles; null for everyone else or when no Speed Dating round exists.
  speedDating: GroupCaseSpeedDating | null;
};

export type GroupCaseGroup = { groupId: string | null; groupName: string; applicants: GroupCaseApplicant[] };

export type GroupCaseRoster = {
  roundId: string;
  roundName: string;
  roundStatus: "DRAFT" | "PUBLISHED" | "ACTIVE" | "FROZEN" | "FINALIZED" | "ARCHIVED";
  canSeeSpeedDating: boolean;
  criteria: GroupCaseCriterion[];
  progress: { scored: number; total: number };
  groups: GroupCaseGroup[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNullableNumber(value: unknown) {
  return value === null || typeof value === "number";
}

export function isGroupCaseScores(value: unknown): value is GroupCaseScores {
  return isRecord(value) && Object.values(value).every((score) =>
    score === null || (Number.isInteger(score) && (score as number) >= 1 && (score as number) <= 5));
}

function isGroupCaseApplicant(value: unknown): value is GroupCaseApplicant {
  return isRecord(value)
    && typeof value.applicationId === "string"
    && (value.revision === null || (typeof value.revision === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.revision)))
    && typeof value.name === "string"
    && isGroupCaseScores(value.scores)
    && typeof value.note === "string"
    && (value.savedAt === null || typeof value.savedAt === "string")
    && (value.quality === undefined || value.quality === null || isGroupCaseQuality(value.quality))
    && (value.speedDating === null || (isRecord(value.speedDating)
      && isNullableNumber(value.speedDating.adjusted)
      && isNullableNumber(value.speedDating.mean)
      && typeof value.speedDating.count === "number"));
}

function isGroupCaseCriterion(value: unknown): value is GroupCaseCriterion {
  return isRecord(value)
    && typeof value.id === "string"
    && typeof value.name === "string"
    && typeof value.description === "string"
    && typeof value.weight === "number"
    && typeof value.required === "boolean";
}

export function isGroupCaseRoster(value: unknown): value is GroupCaseRoster {
  if (!isRecord(value)) return false;
  if (typeof value.roundId !== "string" || typeof value.roundName !== "string") return false;
  if (!["DRAFT", "PUBLISHED", "ACTIVE", "FROZEN", "FINALIZED", "ARCHIVED"].includes(String(value.roundStatus))) return false;
  if (typeof value.canSeeSpeedDating !== "boolean") return false;
  if (!Array.isArray(value.criteria) || !value.criteria.every(isGroupCaseCriterion)) return false;
  if (!isRecord(value.progress) || typeof value.progress.scored !== "number" || typeof value.progress.total !== "number") return false;
  return Array.isArray(value.groups) && value.groups.every((group) =>
    isRecord(group)
    && (group.groupId === null || typeof group.groupId === "string")
    && typeof group.groupName === "string"
    && Array.isArray(group.applicants)
    && group.applicants.every(isGroupCaseApplicant));
}

export function isGroupCaseQuality(value: unknown): value is GroupCaseQuality {
  return isRecord(value)
    && typeof value.valid === "boolean"
    && typeof value.coverage === "number" && Number.isFinite(value.coverage) && value.coverage >= 0 && value.coverage <= 1
    && [value.observedCount, value.criteriaCount, value.minimumObserved].every((count) => typeof count === "number" && Number.isInteger(count) && count >= 0)
    && Array.isArray(value.missingRequired) && value.missingRequired.every((name) => typeof name === "string");
}

export function isGroupCaseRatingResult(value: unknown): value is GroupCaseRatingResult {
  return isRecord(value) && typeof value.applicationId === "string" && isGroupCaseScores(value.scores)
    && typeof value.note === "string" && typeof value.savedAt === "string"
    && (value.quality === undefined || value.quality === null || isGroupCaseQuality(value.quality));
}

// Present the server verdict and its blockers; this does not calculate validity.
export function groupCaseQualityMessage(quality: GroupCaseQuality | null | undefined): string {
  if (!quality) return "Review quality unavailable. Saved evidence does not confirm a qualifying review.";
  if (quality.valid) return "Your review meets the grading requirements.";
  const blockers = [];
  if (quality.observedCount < quality.minimumObserved) blockers.push(`${quality.observedCount} of ${quality.minimumObserved} minimum observations`);
  if (quality.missingRequired.length) blockers.push(`required: ${quality.missingRequired.join(", ")}`);
  if (quality.coverage < 0.75) blockers.push(`${Math.floor(quality.coverage * 100)}% weighted coverage; 75% needed`);
  return `Saved evidence does not yet count as a qualifying review${blockers.length ? ` — ${blockers.join("; ")}` : "."}`;
}
