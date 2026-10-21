import type { GroupCaseScores } from "@/lib/group-case-roster";

type GradedRow = { scores: GroupCaseScores; savedAt: string | null };

// The applicant after `currentId` in the order the grader sees; null at the end of the list.
export function nextApplicantId(order: readonly string[], currentId: string): string | null {
  const index = order.indexOf(currentId);
  return index === -1 ? order[0] ?? null : order[index + 1] ?? null;
}

export function isUnstarted(row: GradedRow) {
  return row.savedAt === null && Object.values(row.scores).every((score) => score === null);
}

export function unstartedIds(rows: Record<string, GradedRow>): Set<string> {
  return new Set(Object.entries(rows).filter(([, row]) => isUnstarted(row)).map(([id]) => id));
}

// `snapshot` is the set that was unstarted when the filter went on, so a row stays put
// after the grader rates it. A row unstarted now always shows, so the count never hides one.
export function showsWhenUnstartedOnly(id: string, snapshot: ReadonlySet<string> | null, row: GradedRow) {
  return !snapshot || snapshot.has(id) || isUnstarted(row);
}

// Keys 1-5 rate the criterion that has focus, else the first unscored one, then hand
// focus to the following criterion. An unchanged score is ignored, because rating the
// same score again clears it.
export function keyRating(
  key: string,
  { criterionIds, scores, focusedId }: { criterionIds: readonly string[]; scores: GroupCaseScores; focusedId: string | null },
): { criterionId: string; score: number; focusNextId: string | null } | null {
  if (!/^[1-5]$/.test(key)) return null;
  const score = Number(key);
  const criterionId = focusedId !== null && criterionIds.includes(focusedId)
    ? focusedId
    : criterionIds.find((id) => (scores[id] ?? null) === null);
  if (criterionId === undefined || scores[criterionId] === score) return null;
  return { criterionId, score, focusNextId: criterionIds[criterionIds.indexOf(criterionId) + 1] ?? null };
}

// A row whose save failed, is unconfirmed, or conflicts holds its Retry and Download
// controls, so Next keeps it open instead of collapsing them out of reach.
export function holdsOpenRow(status: { kind: string } | undefined) {
  return status?.kind === "error" || status?.kind === "unknown" || status?.kind === "conflict";
}

// Opening an applicant lands on the first dimension still to rate, else the first one.
export function firstToRate(criterionIds: readonly string[], scores: GroupCaseScores): string | null {
  return criterionIds.find((id) => (scores[id] ?? null) === null) ?? criterionIds[0] ?? null;
}
