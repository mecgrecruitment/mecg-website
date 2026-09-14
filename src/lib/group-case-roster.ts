export type GroupCaseSpeedDating = { adjusted: number | null; mean: number | null; count: number };

export type GroupCaseCriterion = { id: string; name: string; description: string; weight: number; required: boolean };

// criterionId -> 1..5, or null when the member marked it not observed.
export type GroupCaseScores = Record<string, number | null>;

export type GroupCaseApplicant = {
  applicationId: string;
  name: string;
  scores: GroupCaseScores;
  note: string;
  savedAt: string | null;
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
    && typeof value.name === "string"
    && isGroupCaseScores(value.scores)
    && typeof value.note === "string"
    && (value.savedAt === null || typeof value.savedAt === "string")
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
