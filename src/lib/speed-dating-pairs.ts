export type SpeedDatingPairMember = {
  applicationId: string;
  name: string;
  position: 1 | 2 | 3;
  assignmentId: string | null;
  assignmentStatus: "ASSIGNED" | "IN_PROGRESS" | "SUBMITTED" | "LOCKED" | "RECUSED" | "MISSED" | null;
};

export const SPEED_DATING_SESSIONS = [1, 2] as const;
export type SpeedDatingSession = typeof SPEED_DATING_SESSIONS[number];

export const SPEED_DATING_GROUP_SIZES = { min: 2, max: 3 } as const;

export type SpeedDatingPair = {
  id: string;
  label: string;
  session: number;
  claimed: boolean;
  submittedAt: string | null;
  members: SpeedDatingPairMember[];
};

export type SpeedDatingApplicant = { applicationId: string; name: string; scored: boolean };

export type SpeedDatingPairQueue = {
  roundId: string;
  roundName: string;
  roundStatus: "DRAFT" | "PUBLISHED" | "ACTIVE" | "FROZEN" | "FINALIZED" | "ARCHIVED";
  calibrated: boolean;
  rubricReady: boolean;
  criterion: { id: string; name: string; description: string } | null;
  applicants: SpeedDatingApplicant[];
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

export function searchSpeedDatingApplicants(applicants: SpeedDatingApplicant[], query: string) {
  const needle = searchable(query);
  if (!needle) return [];
  return applicants.filter((applicant) => searchable(applicant.name).includes(needle));
}

function isGroupSized(value: unknown[]) {
  return value.length >= SPEED_DATING_GROUP_SIZES.min && value.length <= SPEED_DATING_GROUP_SIZES.max;
}

export function isSpeedDatingPairQueue(value: unknown): value is SpeedDatingPairQueue {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const queue = value as Record<string, unknown>;
  if (typeof queue.roundId !== "string" || typeof queue.roundName !== "string") return false;
  if (!["DRAFT", "PUBLISHED", "ACTIVE", "FROZEN", "FINALIZED", "ARCHIVED"].includes(String(queue.roundStatus))) return false;
  if (!Array.isArray(queue.pairs) || !Array.isArray(queue.applicants)) return false;
  if (!queue.applicants.every((applicant) => isRecord(applicant)
    && typeof applicant.applicationId === "string"
    && typeof applicant.name === "string"
    && typeof applicant.scored === "boolean")) return false;
  return queue.pairs.every((candidate) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return false;
    const pair = candidate as Record<string, unknown>;
    if (typeof pair.id !== "string" || typeof pair.label !== "string" || typeof pair.claimed !== "boolean") return false;
    if (!isSession(pair.session)) return false;
    if (pair.submittedAt !== null && typeof pair.submittedAt !== "string") return false;
    if (!Array.isArray(pair.members) || !isGroupSized(pair.members)) return false;
    return pair.members.every((candidateMember, index) => {
      if (!candidateMember || typeof candidateMember !== "object" || Array.isArray(candidateMember)) return false;
      const member = candidateMember as Record<string, unknown>;
      return typeof member.applicationId === "string"
        && typeof member.name === "string"
        && member.position === index + 1
        && (member.assignmentId === null || typeof member.assignmentId === "string")
        && (member.assignmentStatus === null || ["ASSIGNED", "IN_PROGRESS", "SUBMITTED", "LOCKED", "RECUSED", "MISSED"].includes(String(member.assignmentStatus)));
    });
  }) && typeof queue.calibrated === "boolean"
    && typeof queue.rubricReady === "boolean"
    && (queue.criterion === null || (
      isRecord(queue.criterion)
      && typeof queue.criterion.id === "string"
      && typeof queue.criterion.name === "string"
      && typeof queue.criterion.description === "string"
    ));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isSession(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1;
}

export type SpeedDatingPairRating = {
  applicationId: string;
  score: number;
  note: string;
};

export type SpeedDatingPairSetup = {
  roundId: string;
  roundStatus: SpeedDatingPairQueue["roundStatus"];
  participants: Array<{ applicationId: string; name: string }>;
  pairs: Array<{
    id: string;
    label: string;
    session: number;
    status: "DRAFT" | "PUBLISHED";
    applicationIds: string[];
    createdBy: string;
    evaluatorName: string;
    submittedAt: string | null;
    claimEvaluatorIds: string[];
  }>;
};

export function isSpeedDatingPairSetup(value: unknown): value is SpeedDatingPairSetup {
  if (!isRecord(value) || typeof value.roundId !== "string") return false;
  if (!["DRAFT", "PUBLISHED", "ACTIVE", "FROZEN", "FINALIZED", "ARCHIVED"].includes(String(value.roundStatus))) return false;
  if (!Array.isArray(value.participants) || !value.participants.every((participant) =>
    isRecord(participant) && typeof participant.applicationId === "string" && typeof participant.name === "string")) return false;
  if (!Array.isArray(value.pairs)) return false;
  return value.pairs.every((pair) => isRecord(pair)
    && typeof pair.id === "string"
    && typeof pair.label === "string"
    && isSession(pair.session)
    && ["DRAFT", "PUBLISHED"].includes(String(pair.status))
    && Array.isArray(pair.applicationIds)
    && isGroupSized(pair.applicationIds)
    && pair.applicationIds.every((applicationId) => typeof applicationId === "string")
    && typeof pair.createdBy === "string"
    && typeof pair.evaluatorName === "string"
    && (pair.submittedAt === null || typeof pair.submittedAt === "string")
    && Array.isArray(pair.claimEvaluatorIds)
    && pair.claimEvaluatorIds.every((evaluatorId) => typeof evaluatorId === "string"));
}

export function parseSpeedDatingPairRatings(value: unknown): SpeedDatingPairRating[] | null {
  if (!Array.isArray(value) || !isGroupSized(value)) return null;
  const ratings: SpeedDatingPairRating[] = [];
  for (const candidate of value) {
    if (!isRecord(candidate)) return null;
    const applicationId = candidate.applicationId;
    const score = candidate.score;
    const note = candidate.note ?? "";
    if (typeof applicationId !== "string" || !applicationId || applicationId.length > 200) return null;
    if (typeof score !== "number" || !Number.isInteger(score) || score < 1 || score > 5) return null;
    if (typeof note !== "string" || note.length > 2000) return null;
    if ([1, 2, 5].includes(score) && !note.trim()) return null;
    ratings.push({ applicationId, score, note });
  }
  if (new Set(ratings.map((rating) => rating.applicationId)).size !== ratings.length) return null;
  return ratings;
}
