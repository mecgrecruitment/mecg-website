import test from "node:test";
import assert from "node:assert/strict";
import { sameScreeningDraft, parseScreeningActionResult, parseScreeningDraftSnapshot, parseScreeningDraftWrite, parseScreeningDraftWriteResult } from "./screening-draft-write";
const revision = "10000000-0000-4000-8000-000000000001";
const mutationId = "20000000-0000-4000-8000-000000000002";
const draft = { ratings: [{ criterionId: "analysis", score: "2", note: "" }], evidence: "Private observations", recommendation: "HOLD", updatedAt: "2026-10-16T20:00:00Z" };
test("screening draft writes require explicit revision and mutation identity on the first save", () => {
  assert.equal(parseScreeningDraftWrite(draft), null);
  assert.equal(parseScreeningDraftWrite({ ...draft, mutationId }), null);
  assert.equal(parseScreeningDraftWrite({ ...draft, expectedRevision: null, mutationId: "bad" }), null);
  assert.deepEqual(parseScreeningDraftWrite({ ...draft, expectedRevision: null, mutationId }), { ratings: draft.ratings, evidence: draft.evidence, recommendation: draft.recommendation, expectedRevision: null, mutationId });
});
test("screening snapshots distinguish no stored draft from a hidden old-rubric revision", () => {
  assert.deepEqual(parseScreeningDraftSnapshot({ assignmentId: "a", revision: null, draft: null }), { assignmentId: "a", revision: null, draft: null });
  assert.deepEqual(parseScreeningDraftSnapshot({ assignmentId: "a", revision, draft: null }), { assignmentId: "a", revision, draft: null });
  assert.equal(parseScreeningDraftSnapshot({ assignmentId: "a", draft: null }), null);
  assert.equal(parseScreeningDraftSnapshot({ assignmentId: "a", revision: null, draft }), null);
});
test("malformed nonempty screening content fails closed instead of becoming an empty draft", () => {
  for (const broken of [
    { ...draft, ratings: [{ criterionId: "analysis", score: 2, note: "" }] },
    { ...draft, ratings: [draft.ratings[0], draft.ratings[0]] },
    { ...draft, evidence: null }, { ...draft, recommendation: "OFFER" },
    { ...draft, updatedAt: "2026-10-16" }, { ...draft, updatedAt: "yesterday" },
  ]) assert.equal(parseScreeningDraftSnapshot({ assignmentId: "a", revision, draft: broken }), null);
});
test("screening saved receipts need assignment, revision, mutation, current content and timestamp", () => {
  const saved = { kind: "saved", assignmentId: "a", revision, mutationId, draft };
  assert.deepEqual(parseScreeningDraftWriteResult(saved), saved);
  for (const broken of [{ ...saved, assignmentId: "" }, { ...saved, revision: null }, { ...saved, mutationId: null }, { ...saved, draft: null }, { savedAt: draft.updatedAt }]) assert.equal(parseScreeningDraftWriteResult(broken), null);
  const conflict = { kind: "conflict", snapshot: { assignmentId: "a", revision, draft } };
  assert.deepEqual(parseScreeningDraftWriteResult(conflict), conflict);
  assert.equal(parseScreeningDraftWriteResult({ ...conflict, snapshot: { assignmentId: "a", draft: null } }), null);
});
test("screening action receipts are explicit and bound, with a finite score and real review identifier", () => {
  const submitted = { kind: "submitted", assignmentId: "a", reviewId: "review-1", score: 75 };
  assert.deepEqual(parseScreeningActionResult(submitted), submitted);
  assert.deepEqual(parseScreeningActionResult({ kind: "recused", assignmentId: "a" }), { kind: "recused", assignmentId: "a" });
  for (const broken of [null, 75, {}, { kind: "submitted", assignmentId: "a" }, { ...submitted, reviewId: " " }, { ...submitted, score: NaN }, { ...submitted, score: Infinity }, { ...submitted, score: -1 }, { ...submitted, score: 101 }, { ...submitted, assignmentId: "" }, { kind: "recused" }]) assert.equal(parseScreeningActionResult(broken), null);
});

test("screening draft confirmation binds exact observations with criterion order independence", () => {
  const complete = { ...draft, ratings: [...draft.ratings, { criterionId: "clarity", score: "3", note: "Specific note" }] };
  assert.equal(sameScreeningDraft(complete, { ...complete, ratings: [...complete.ratings].reverse() }), true);
  for (const changed of [{ ...complete, evidence: "Different observations" }, { ...complete, recommendation: "ADVANCE" }, { ...complete, ratings: [{ criterionId: "analysis", score: "3", note: "" }, complete.ratings[1]] }, { ...complete, ratings: [complete.ratings[0], { criterionId: "clarity", score: "3", note: "Changed note" }] }]) assert.equal(sameScreeningDraft(complete, changed), false);
});
