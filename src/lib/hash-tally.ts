export type HashOutcome = "PENDING" | "OFFER" | "REJECT";

// The same rule rush.hash_tally applies, so the UI can label a row without a
// second round trip. The SQL stays the source of truth for a binding tally.
// A tie is a REJECT: a membership needs a majority, not the absence of one.
export function hashOutcome(quorum: number, yes: number, no: number, totalVotes: number): HashOutcome {
  if (totalVotes < quorum) return "PENDING";
  return yes > no ? "OFFER" : "REJECT";
}
