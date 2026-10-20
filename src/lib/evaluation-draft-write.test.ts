import test from "node:test";
import assert from "node:assert/strict";
import { parseEvaluationDraftSnapshot, parseEvaluationDraftWrite, parseEvaluationDraftWriteResult } from "./evaluation-draft-write";
const revision = "10000000-0000-4000-8000-000000000001";
const mutationId = "20000000-0000-4000-8000-000000000002";
const draft = { ratings: [{ criterionId: "analysis", score: "3", note: "Observed" }], evidence: "Exact evidence", updatedAt: "2026-10-16T20:00:00Z" };
test("draft writes require explicit revision and replay identity, including first save", () => {
  assert.equal(parseEvaluationDraftWrite(draft), null);
  assert.equal(parseEvaluationDraftWrite({ ...draft, expectedRevision: null, mutationId: "invalid" }), null);
  assert.deepEqual(parseEvaluationDraftWrite({ ...draft, expectedRevision: null, mutationId }), { ratings: draft.ratings, evidence: draft.evidence, expectedRevision: null, mutationId });
  assert.equal(parseEvaluationDraftWrite({ ...draft, expectedRevision: revision, mutationId })?.expectedRevision, revision);
});
test("snapshot distinguishes no-row from an existing hidden old-rubric revision", () => {
  assert.deepEqual(parseEvaluationDraftSnapshot({ assignmentId: "a", revision: null, draft: null }), { assignmentId: "a", revision: null, draft: null });
  assert.equal(parseEvaluationDraftSnapshot({ assignmentId: "a", revision, draft: null })?.revision, revision);
  assert.equal(parseEvaluationDraftSnapshot({ assignmentId: "a", draft: null }), null);
  assert.equal(parseEvaluationDraftSnapshot({ assignmentId: "a", revision: null, draft }), null);
});
test("saved draft receipts require valid content timestamp revision and mutation", () => {
  const saved = { kind: "saved", assignmentId: "a", revision, mutationId, draft };
  assert.deepEqual(parseEvaluationDraftWriteResult(saved), saved);
  assert.equal(parseEvaluationDraftWriteResult({ ...saved, draft: { ...draft, updatedAt: "yesterday" } }), null);
  assert.equal(parseEvaluationDraftWriteResult({ ...saved, revision: null }), null);
  assert.equal(parseEvaluationDraftWriteResult({ ...saved, mutationId: null }), null);
  assert.equal(parseEvaluationDraftWriteResult({ savedAt: draft.updatedAt }), null);
});
test("conflicts preserve the authoritative content or absent-draft snapshot", () => {
  const conflict = { kind: "conflict", snapshot: { assignmentId: "a", revision, draft } };
  assert.deepEqual(parseEvaluationDraftWriteResult(conflict), conflict);
  assert.equal(parseEvaluationDraftWriteResult({ ...conflict, snapshot: { assignmentId: "a", revision: "bad", draft } }), null);
  assert.equal(parseEvaluationDraftWriteResult({ kind: "conflict", snapshot: { assignmentId: "a", revision: null, draft: null } })?.kind, "conflict");
});
