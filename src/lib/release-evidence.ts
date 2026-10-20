import { Constants, type Database } from "@/lib/supabase/database.types";

type RoundBlocker = "ROUND_NOT_CLOSED" | "VALID_LOCKED_EVALUATIONS_MISSING";
type ApplicationBlocker = "NO_REQUIRED_ROUNDS" | "APPLICATION_INELIGIBLE";
export type ReleaseEvidenceRound = {
  roundId: string; roundName: string; kind: string;
  status: Database["rush"]["Enums"]["round_status"];
  validLockedEvaluations: number; requiredEvaluations: 2;
  missingRequiredCriteria: string[]; blockers: RoundBlocker[];
};
export type ReleaseEvidenceReport = {
  applicationId: string; applicationStatus: Database["rush"]["Enums"]["application_status"];
  ready: boolean; blockers: ApplicationBlocker[]; rounds: ReleaseEvidenceRound[];
};
function strings(value: unknown): string[] | null {
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : null;
}
function applicationBlocker(value: string): value is ApplicationBlocker {
  return value === "NO_REQUIRED_ROUNDS" || value === "APPLICATION_INELIGIBLE";
}
function roundBlocker(value: string): value is RoundBlocker {
  return value === "ROUND_NOT_CLOSED" || value === "VALID_LOCKED_EVALUATIONS_MISSING";
}
export function parseReleaseEvidence(value: unknown): ReleaseEvidenceReport | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (!("applicationId" in value) || typeof value.applicationId !== "string" || !value.applicationId
    || !("applicationStatus" in value) || !("ready" in value) || typeof value.ready !== "boolean"
    || !("blockers" in value) || !("rounds" in value) || !Array.isArray(value.rounds)) return null;
  const applicationStatus = Constants.rush.Enums.application_status.find((status) => status === value.applicationStatus);
  const blockers = strings(value.blockers);
  if (!applicationStatus || !blockers || !blockers.every(applicationBlocker) || new Set(blockers).size !== blockers.length) return null;
  const rounds: ReleaseEvidenceRound[] = [];
  const ids = new Set<string>();
  for (const row of value.rounds) {
    if (!row || typeof row !== "object" || Array.isArray(row)) return null;
    const { roundId, roundName, kind, status, validLockedEvaluations, requiredEvaluations, missingRequiredCriteria, blockers: rawBlockers } = row;
    const roundStatus = Constants.rush.Enums.round_status.find((candidate) => candidate === status);
    const names = strings(missingRequiredCriteria);
    const roundBlockers = strings(rawBlockers);
    if (typeof roundId !== "string" || !roundId || ids.has(roundId) || typeof roundName !== "string" || typeof kind !== "string"
      || !roundStatus || typeof validLockedEvaluations !== "number" || !Number.isSafeInteger(validLockedEvaluations) || validLockedEvaluations < 0
      || requiredEvaluations !== 2 || !names || !roundBlockers || !roundBlockers.every(roundBlocker) || new Set(roundBlockers).size !== roundBlockers.length) return null;
    const closed = roundStatus === "FROZEN" || roundStatus === "FINALIZED";
    if (roundBlockers.includes("ROUND_NOT_CLOSED") === closed
      || roundBlockers.includes("VALID_LOCKED_EVALUATIONS_MISSING") !== (validLockedEvaluations < 2)) return null;
    rounds.push({ roundId, roundName, kind, status: roundStatus, validLockedEvaluations, requiredEvaluations, missingRequiredCriteria: names, blockers: roundBlockers });
    ids.add(roundId);
  }
  const ineligible = applicationStatus === "DRAFT" || applicationStatus === "WITHDRAWN";
  if (blockers.includes("APPLICATION_INELIGIBLE") !== ineligible || blockers.includes("NO_REQUIRED_ROUNDS") !== (rounds.length === 0)
    || value.ready !== (blockers.length === 0 && rounds.every((round) => round.blockers.length === 0))) return null;
  return { applicationId: value.applicationId, applicationStatus, ready: value.ready, blockers, rounds };
}

export function releaseEvidenceHref(applicationId: string, cycleId: string) {
  return `/admin/applications/${encodeURIComponent(applicationId)}/release-evidence?cycleId=${encodeURIComponent(cycleId)}`;
}
