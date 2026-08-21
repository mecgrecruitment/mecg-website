const CYCLE_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["OPEN"],
  OPEN: ["IN_PROCESS"],
  IN_PROCESS: ["DECISION_LOCK"],
  DECISION_LOCK: ["CLOSED"],
  CLOSED: ["ARCHIVED"],
  ARCHIVED: [],
};

const ROUND_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["PUBLISHED"],
  PUBLISHED: ["ACTIVE"],
  ACTIVE: ["FROZEN"],
  FROZEN: ["FINALIZED"],
  FINALIZED: [],
};

export function canTransitionCycle(from: string, to: string) {
  return from === to || (CYCLE_TRANSITIONS[from]?.includes(to) ?? false);
}

export function canTransitionRound(from: string, to: string) {
  return from === to || (ROUND_TRANSITIONS[from]?.includes(to) ?? false);
}

export function normalizePersonInput(nameValue: unknown, contactValue: unknown) {
  const name = typeof nameValue === "string" ? nameValue.trim() : "";
  const contact = typeof contactValue === "string" ? contactValue.trim().toLowerCase() : "";
  if (!name || name.length > 120 || !contact || contact.length > 254) return null;
  return { name, contact };
}

export function hasExactCriterionSet(
  expectedIds: string[],
  submittedIds: string[],
) {
  if (expectedIds.length !== submittedIds.length) return false;
  const submitted = new Set(submittedIds);
  return submitted.size === expectedIds.length && expectedIds.every((id) => submitted.has(id));
}
