export type HashOutcome = "PENDING" | "OFFER" | "REJECT";

// The same rule rush.hash_passes applies, so the UI can label a row without a
// second round trip. The SQL stays the source of truth for a binding tally.
// A pass is 60% Yes of everyone who voted; Unsure counts against, like a tie.
export function hashOutcome(quorum: number, yes: number, no: number, totalVotes: number): HashOutcome {
  if (totalVotes < quorum) return "PENDING";
  return totalVotes > 0 && yes * 5 >= totalVotes * 3 ? "OFFER" : "REJECT";
}

export const HASH_STAGES = ["APPLICATION", "SPEED_DATING", "GROUP_CASE"] as const;
export type HashStage = (typeof HASH_STAGES)[number];

// A stage hash moves applicants between pipeline stages before the final vote.
// These mirror the rules in rush.open_hash_stage and rush.apply_stage_hash_result
// so the UI can name the ballot and the next stage; the SQL stays the source of
// truth for who may vote and where a YES actually sends someone.
export const HASH_STAGE_RULES: Record<HashStage, { ballot: readonly string[]; pass: string; voterRoles: readonly string[] }> = {
  APPLICATION: { ballot: ["SUBMITTED", "ELIGIBLE"], pass: "INVITED", voterRoles: ["BOARD", "RECRUITMENT_COMMITTEE", "OWNER"] },
  SPEED_DATING: { ballot: ["INVITED"], pass: "GROUP_CASE", voterRoles: ["MEMBER", "BOARD", "PANEL", "OWNER", "RECRUITMENT_COMMITTEE"] },
  GROUP_CASE: { ballot: ["GROUP_CASE"], pass: "IN_PROCESS", voterRoles: ["MEMBER", "BOARD", "PANEL", "OWNER", "RECRUITMENT_COMMITTEE"] },
};

// An open stage wins over the cycle status; DECISION_LOCK without one is the
// final vote; anything else means no ballot is open.
export function currentHashStage(cycle: { hash_stage: string | null; status: string }): HashStage | "FINAL" | null {
  if (cycle.status === "DECISION_LOCK") return "FINAL";
  return cycle.hash_stage && HASH_STAGES.some((stage) => stage === cycle.hash_stage) ? (cycle.hash_stage as HashStage) : null;
}

export function canVoteInStage(role: string, stage: HashStage | "FINAL") {
  return stage === "FINAL" || HASH_STAGE_RULES[stage].voterRoles.includes(role);
}
