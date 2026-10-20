import { parseScreeningDraft, type ScreeningDraft } from "@/app/member/screening/screening-draft";
import { parseOffsetDateTime } from "./date-time";

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
export function isScreeningRevision(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
export type ScreeningDraftSnapshot = { assignmentId: string; revision: string | null; draft: (ScreeningDraft & { updatedAt: string }) | null };
export type ScreeningDraftWrite = ScreeningDraft & { expectedRevision: string | null; mutationId: string };
export type ScreeningDraftWriteResult =
  | { kind: "saved"; assignmentId: string; revision: string; mutationId: string; draft: ScreeningDraft & { updatedAt: string } }
  | { kind: "conflict"; snapshot: ScreeningDraftSnapshot };
export type ScreeningActionResult =
  | { kind: "submitted"; assignmentId: string; reviewId: string; score: number }
  | { kind: "recused"; assignmentId: string };

export function sameScreeningDraft(left: ScreeningDraft, right: ScreeningDraft): boolean {
  return left.evidence === right.evidence && left.recommendation === right.recommendation && left.ratings.length === right.ratings.length
    && left.ratings.every((rating) => right.ratings.some((other) => rating.criterionId === other.criterionId && rating.score === other.score && rating.note === other.note));
}

export function parseScreeningDraftWrite(value: unknown): ScreeningDraftWrite | null {
  const draft = parseScreeningDraft(value);
  if (!draft || !record(value) || !(value.expectedRevision === null || isScreeningRevision(value.expectedRevision)) || !isScreeningRevision(value.mutationId)) return null;
  return { ...draft, expectedRevision: value.expectedRevision, mutationId: value.mutationId };
}
export function parseScreeningDraftSnapshot(value: unknown): ScreeningDraftSnapshot | null {
  if (!record(value) || typeof value.assignmentId !== "string" || !value.assignmentId || !(value.revision === null || isScreeningRevision(value.revision))) return null;
  if (value.draft === null) return { assignmentId: value.assignmentId, revision: value.revision, draft: null };
  const draft = parseScreeningDraft(value.draft);
  if (!value.revision || !draft || !record(value.draft) || typeof value.draft.updatedAt !== "string" || !parseOffsetDateTime(value.draft.updatedAt)) return null;
  return { assignmentId: value.assignmentId, revision: value.revision, draft: { ...draft, updatedAt: value.draft.updatedAt } };
}
export function parseScreeningDraftWriteResult(value: unknown): ScreeningDraftWriteResult | null {
  if (!record(value)) return null;
  if (value.kind === "conflict") {
    const snapshot = parseScreeningDraftSnapshot(value.snapshot);
    return snapshot ? { kind: "conflict", snapshot } : null;
  }
  const snapshot = parseScreeningDraftSnapshot(value);
  if (value.kind !== "saved" || !snapshot?.draft || !snapshot.revision || !isScreeningRevision(value.mutationId)) return null;
  return { kind: "saved", assignmentId: snapshot.assignmentId, revision: snapshot.revision, mutationId: value.mutationId, draft: snapshot.draft };
}
export function parseScreeningActionResult(value: unknown): ScreeningActionResult | null {
  if (!record(value) || typeof value.assignmentId !== "string" || !value.assignmentId) return null;
  if (value.kind === "recused") return { kind: "recused", assignmentId: value.assignmentId };
  if (value.kind !== "submitted" || typeof value.reviewId !== "string" || !value.reviewId.trim() || typeof value.score !== "number" || !Number.isFinite(value.score) || value.score < 0 || value.score > 100) return null;
  return { kind: "submitted", assignmentId: value.assignmentId, reviewId: value.reviewId, score: value.score };
}
