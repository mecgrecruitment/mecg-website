import { parseEvaluationDraftPayload, type EvaluationDraftPayload } from "@/app/api/member/evaluations/evaluation-draft-payload";
import { parseOffsetDateTime } from "./date-time";

function record(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
export function isEvaluationDraftRevision(value: unknown): value is string { return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value); }
export type EvaluationDraftSnapshot = { assignmentId: string; revision: string | null; draft: (EvaluationDraftPayload & { updatedAt: string }) | null };
export type EvaluationDraftWrite = EvaluationDraftPayload & { expectedRevision: string | null; mutationId: string };
export type EvaluationDraftWriteResult =
  | { kind: "saved"; assignmentId: string; revision: string; mutationId: string; draft: EvaluationDraftPayload & { updatedAt: string } }
  | { kind: "conflict"; snapshot: EvaluationDraftSnapshot };
export function parseEvaluationDraftWrite(value: unknown): EvaluationDraftWrite | null {
  const payload = parseEvaluationDraftPayload(value);
  if (!payload || !record(value) || !(value.expectedRevision === null || isEvaluationDraftRevision(value.expectedRevision)) || !isEvaluationDraftRevision(value.mutationId)) return null;
  return { ...payload, expectedRevision: value.expectedRevision, mutationId: value.mutationId };
}
export function parseEvaluationDraftSnapshot(value: unknown): EvaluationDraftSnapshot | null {
  if (!record(value) || typeof value.assignmentId !== "string" || !value.assignmentId || !(value.revision === null || isEvaluationDraftRevision(value.revision))) return null;
  if (value.draft === null) return { assignmentId: value.assignmentId, revision: value.revision, draft: null };
  if (value.revision === null) return null;
  const payload = parseEvaluationDraftPayload(value.draft);
  if (!payload || !record(value.draft) || typeof value.draft.updatedAt !== "string" || !parseOffsetDateTime(value.draft.updatedAt)) return null;
  return { assignmentId: value.assignmentId, revision: value.revision, draft: { ...payload, updatedAt: value.draft.updatedAt } };
}
export function parseEvaluationDraftWriteResult(value: unknown): EvaluationDraftWriteResult | null {
  if (!record(value)) return null;
  if (value.kind === "conflict") { const snapshot = parseEvaluationDraftSnapshot(value.snapshot); return snapshot ? { kind: "conflict", snapshot } : null; }
  const snapshot = parseEvaluationDraftSnapshot(value);
  if (value.kind !== "saved" || !snapshot?.draft || !snapshot.revision || !isEvaluationDraftRevision(value.mutationId)) return null;
  return { kind: "saved", assignmentId: snapshot.assignmentId, revision: snapshot.revision, mutationId: value.mutationId, draft: snapshot.draft };
}
