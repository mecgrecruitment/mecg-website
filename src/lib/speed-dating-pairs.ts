export type SpeedDatingPairMember = {
  applicationId: string;
  name: string;
  position: 1 | 2;
};

export type SpeedDatingPair = {
  id: string;
  label: string;
  claimed: boolean;
  members: [SpeedDatingPairMember, SpeedDatingPairMember];
};

export type SpeedDatingPairQueue = {
  roundId: string;
  roundName: string;
  roundStatus: "DRAFT" | "PUBLISHED" | "ACTIVE" | "FROZEN" | "FINALIZED" | "ARCHIVED";
  pairs: SpeedDatingPair[];
};

function searchable(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().trim();
}

export function searchSpeedDatingPairs(pairs: SpeedDatingPair[], query: string) {
  const needle = searchable(query);
  if (!needle) return [];
  return pairs.filter((pair) => pair.members.some((member) => searchable(member.name).includes(needle)));
}

export function isSpeedDatingPairQueue(value: unknown): value is SpeedDatingPairQueue {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const queue = value as Record<string, unknown>;
  if (typeof queue.roundId !== "string" || typeof queue.roundName !== "string") return false;
  if (!["DRAFT", "PUBLISHED", "ACTIVE", "FROZEN", "FINALIZED", "ARCHIVED"].includes(String(queue.roundStatus))) return false;
  if (!Array.isArray(queue.pairs)) return false;
  return queue.pairs.every((candidate) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return false;
    const pair = candidate as Record<string, unknown>;
    if (typeof pair.id !== "string" || typeof pair.label !== "string" || typeof pair.claimed !== "boolean") return false;
    if (!Array.isArray(pair.members) || pair.members.length !== 2) return false;
    return pair.members.every((candidateMember, index) => {
      if (!candidateMember || typeof candidateMember !== "object" || Array.isArray(candidateMember)) return false;
      const member = candidateMember as Record<string, unknown>;
      return typeof member.applicationId === "string"
        && typeof member.name === "string"
        && member.position === index + 1;
    });
  });
}
