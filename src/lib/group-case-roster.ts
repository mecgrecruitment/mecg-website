export type GroupCaseSpeedDating = { adjusted: number | null; mean: number | null; count: number };

export type GroupCaseApplicant = {
  applicationId: string;
  name: string;
  assignmentId: string | null;
  assignmentStatus: "ASSIGNED" | "IN_PROGRESS" | "SUBMITTED" | "LOCKED" | "RECUSED" | "MISSED" | null;
  // Present only for Board roles; null for everyone else or when no Speed Dating round exists.
  speedDating: GroupCaseSpeedDating | null;
};

export type GroupCaseGroup = { groupId: string | null; groupName: string; applicants: GroupCaseApplicant[] };

export type GroupCaseRoster = {
  roundId: string;
  roundName: string;
  roundStatus: "DRAFT" | "PUBLISHED" | "ACTIVE" | "FROZEN" | "FINALIZED" | "ARCHIVED";
  canSeeSpeedDating: boolean;
  groups: GroupCaseGroup[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNullableNumber(value: unknown) {
  return value === null || typeof value === "number";
}

function isGroupCaseApplicant(value: unknown): value is GroupCaseApplicant {
  return isRecord(value)
    && typeof value.applicationId === "string"
    && typeof value.name === "string"
    && (value.assignmentId === null || typeof value.assignmentId === "string")
    && (value.assignmentStatus === null || typeof value.assignmentStatus === "string")
    && (value.speedDating === null || (isRecord(value.speedDating)
      && isNullableNumber(value.speedDating.adjusted)
      && isNullableNumber(value.speedDating.mean)
      && typeof value.speedDating.count === "number"));
}

export function isGroupCaseRoster(value: unknown): value is GroupCaseRoster {
  if (!isRecord(value)) return false;
  if (typeof value.roundId !== "string" || typeof value.roundName !== "string") return false;
  if (!["DRAFT", "PUBLISHED", "ACTIVE", "FROZEN", "FINALIZED", "ARCHIVED"].includes(String(value.roundStatus))) return false;
  if (typeof value.canSeeSpeedDating !== "boolean") return false;
  return Array.isArray(value.groups) && value.groups.every((group) =>
    isRecord(group)
    && (group.groupId === null || typeof group.groupId === "string")
    && typeof group.groupName === "string"
    && Array.isArray(group.applicants)
    && group.applicants.every(isGroupCaseApplicant));
}
