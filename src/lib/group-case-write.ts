import { isGroupCaseQuality, isGroupCaseScores, type GroupCaseApplicant, type GroupCaseQuality, type GroupCaseScores } from "./group-case-roster";
import { parseOffsetDateTime } from "./date-time";

export function isGroupCaseRevision(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
export type GroupCaseWriteRequest = { roundId: string; applicationId: string; scores: GroupCaseScores; note: string; expectedRevision: string | null; mutationId: string };
export type GroupCaseWriteSnapshot = Pick<GroupCaseApplicant, "applicationId" | "scores" | "note" | "savedAt" | "quality"> & { revision: string | null };
export type GroupCaseWriteResult =
  | ({ kind: "saved"; revision: string; mutationId: string; savedAt: string; quality: GroupCaseQuality } & GroupCaseWriteSnapshot)
  | { kind: "conflict"; snapshot: GroupCaseWriteSnapshot };
function record(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
export function parseGroupCaseWriteRequest(value: unknown): GroupCaseWriteRequest | null {
  if (!record(value)) return null;
  const { roundId, applicationId, scores, note, expectedRevision, mutationId } = value;
  if (typeof roundId !== "string" || !roundId || roundId.length > 200 || typeof applicationId !== "string" || !applicationId || applicationId.length > 200
    || !isGroupCaseScores(scores) || Object.keys(scores).length < 1 || Object.keys(scores).length > 20 || Object.keys(scores).some((key) => !key || key.length > 200)
    || typeof note !== "string" || note.length > 4000 || !(expectedRevision === null || isGroupCaseRevision(expectedRevision)) || !isGroupCaseRevision(mutationId)) return null;
  return { roundId, applicationId, scores, note, expectedRevision, mutationId };
}
function snapshot(value: unknown): GroupCaseWriteSnapshot | null {
  if (!record(value)) return null;
  const { applicationId, scores, note, savedAt, quality, revision } = value;
  if (typeof applicationId !== "string" || !applicationId || !isGroupCaseScores(scores) || typeof note !== "string"
    || !(savedAt === null || (typeof savedAt === "string" && parseOffsetDateTime(savedAt)))
    || !(revision === null || isGroupCaseRevision(revision)) || !(quality === null || isGroupCaseQuality(quality))) return null;
  return { applicationId, scores, note, savedAt, quality, revision };
}
export function parseGroupCaseWriteResult(value: unknown): GroupCaseWriteResult | null {
  if (!record(value)) return null;
  if (value.kind === "conflict") {
    const current = snapshot(value.snapshot);
    return current ? { kind: "conflict", snapshot: current } : null;
  }
  const current = snapshot(value);
  if (value.kind !== "saved" || !current || !current.revision || !current.savedAt || !current.quality || !isGroupCaseRevision(value.mutationId)) return null;
  return { ...current, kind: "saved", revision: current.revision, savedAt: current.savedAt, quality: current.quality, mutationId: value.mutationId };
}
