import { matchesApplicantName } from "@/lib/speed-dating-roster";

// The rows the main list shows.
// `pinnedId` is the applicant already rendered in the Now presenting card.
// `keepId` is a pinned applicant whose list row the member was inside when the
// board moved to them; that row stays so focus and the phone keyboard survive.
// `unvotedSnapshot` is the set that was unvoted when the filter went on, so a
// row stays put after the member votes on it instead of vanishing mid-tap.
// `unvotedNow` adds any row that is unvoted now, such as one whose vote failed
// to save, so the filter never hides a row its count includes.
export function ballotList<T extends { id: string; name: string }>(
  applicants: T[],
  { query, pinnedId, keepId = null, unvotedSnapshot, unvotedNow }: {
    query: string;
    pinnedId: string | null;
    keepId?: string | null;
    unvotedSnapshot: ReadonlySet<string> | null;
    unvotedNow: ReadonlySet<string>;
  },
): T[] {
  return applicants.filter((applicant) =>
    (applicant.id !== pinnedId || applicant.id === keepId)
    && (!unvotedSnapshot || unvotedSnapshot.has(applicant.id) || unvotedNow.has(applicant.id))
    && matchesApplicantName(applicant.name, query));
}

export function unvotedIds(rows: Record<string, { vote: string }>): Set<string> {
  return new Set(Object.entries(rows).filter(([, row]) => !row.vote).map(([id]) => id));
}

// A member near the top, or with the card already on screen, is following the
// room and gets scrolled to it. One who has scrolled down the list stays put.
const NEAR_TOP_PX = 160;
export function shouldScrollToPresenting(card: { top: number; bottom: number }, viewportHeight: number, scrollY: number) {
  return scrollY <= NEAR_TOP_PX || (card.bottom > 0 && card.top < viewportHeight);
}
