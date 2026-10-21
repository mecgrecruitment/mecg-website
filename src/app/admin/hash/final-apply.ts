import { hashOutcome } from "@/lib/hash-tally";
import { decisionOutcomeLabel } from "@/lib/labels";

export type FinalApplyRow = {
  id: string;
  displayName: string;
  tally: { quorum: number; yes_count: number; no_count: number; total_votes: number } | undefined;
  ready: boolean;
  hasDecision: boolean;
  declaredConflict: boolean;
};

export type FinalApplyItem = { id: string; displayName: string; outcome: "OFFER" | "REJECT" };
export type FinalApplyPlan = { items: FinalApplyItem[]; conflictSkipped: number };
export type FinalApplyFailure = { id: string; displayName: string; error: string };
export type FinalApplyChange = { id: string; displayName: string; planned: FinalApplyItem["outcome"]; applied: string };
export type FinalApplyReport = { applied: number; failures: FinalApplyFailure[]; changes: FinalApplyChange[] };

// Only an evidence-ready applicant with no decision yet and a vote at quorum is
// applied in bulk. apply_hash_result re-checks all of it and recomputes the
// tally under a row lock, so this list only decides what to ask for. It also
// refuses anyone the caller declared a conflict on, so those are counted, not sent.
export function finalApplyPlan(rows: FinalApplyRow[]): FinalApplyPlan {
  const decided = rows.flatMap((row) => {
    if (!row.ready || row.hasDecision || !row.tally) return [];
    const outcome = hashOutcome(row.tally.quorum, row.tally.yes_count, row.tally.no_count, row.tally.total_votes);
    return outcome === "PENDING" ? [] : [{ row, item: { id: row.id, displayName: row.displayName, outcome } }];
  });
  return {
    items: decided.filter(({ row }) => !row.declaredConflict).map(({ item }) => item),
    conflictSkipped: decided.filter(({ row }) => row.declaredConflict).length,
  };
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

export function finalApplyConfirmMessage({ items, conflictSkipped }: FinalApplyPlan) {
  const offers = items.filter((item) => item.outcome === "OFFER").length;
  const skipped = conflictSkipped ? ` ${conflictSkipped} skipped: you declared a conflict.` : "";
  return `Apply ${plural(items.length, "decided vote", "decided votes")}? ${plural(offers, "offer", "offers")}, ${plural(items.length - offers, "no offer", "no offers")}.${skipped} Each outcome is recorded and locked. Nothing reaches applicants until you release it.`;
}

const VOTE_OUTCOME_LABEL: Record<string, string> = { OFFER: "Offer", REJECT: "No offer" };

export function finalApplyChangeMessage(change: FinalApplyChange) {
  return `${change.displayName}: now ${VOTE_OUTCOME_LABEL[change.applied] ?? decisionOutcomeLabel(change.applied)} (changed since this page loaded)`;
}

// One at a time, so a failure for one applicant never stops the rest. The
// server call is idempotent: a second apply returns the existing decision.
// The server recomputes each outcome, so any that differ from the plan are reported.
export async function applyFinalPlan(
  items: FinalApplyItem[],
  applyOne: (applicationId: string) => Promise<{ ok: true; outcome: string | null } | { ok: false; error: string }>,
  onProgress: (done: number) => void = () => {},
): Promise<FinalApplyReport> {
  const failures: FinalApplyFailure[] = [];
  const changes: FinalApplyChange[] = [];
  for (const [index, item] of items.entries()) {
    const result = await applyOne(item.id);
    if (!result.ok) failures.push({ id: item.id, displayName: item.displayName, error: result.error });
    else if (result.outcome && result.outcome !== item.outcome) changes.push({ id: item.id, displayName: item.displayName, planned: item.outcome, applied: result.outcome });
    onProgress(index + 1);
  }
  return { applied: items.length - failures.length, failures, changes };
}
