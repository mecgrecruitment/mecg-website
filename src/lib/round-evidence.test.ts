import assert from "node:assert/strict";
import test from "node:test";
import { roundEvidence } from "./round-evidence.ts";

const rubric = { id: "rubric", minimum_observed_criteria: 2, rubric_criteria: [
  { id: "required", weight: 75, required: true }, { id: "other", weight: 25, required: false },
] };
function observation(overrides = {}) {
  return { id: "evaluation", rubric_id: "rubric", version: 1, status: "LOCKED", voided_at: null,
    criterion_ratings: [{ criterion_id: "required", score: 4 }, { criterion_id: "other", score: 4 }], ...overrides };
}
function assignment(evaluator_id: string, evaluations = [observation()]) {
  return { round_id: "round", evaluator_id, evaluations };
}
const args = { roundId: "round", rubric };

test("two independent valid locked evaluations establish evidence but not decision authority", () => {
  const result = roundEvidence({ ...args, assignments: [assignment("one"), assignment("two")] });
  assert.equal(result.lockedEvaluations, 2);
  assert.deepEqual(result.aggregate, { status: "COMPLETE", score: 75, count: 2, spread: 0 });
});
test("multiple versions and duplicate rows from one evaluator cannot manufacture independence", () => {
  const result = roundEvidence({ ...args, assignments: [assignment("one", [observation(), observation({ id: "new", version: 2 })]), assignment("one")] });
  assert.equal(result.aggregate.count, 1);
  assert.equal(result.aggregate.score, null);
  assert.equal(result.lockedEvaluations, 1);
});
test("voided and superseded rows never count as valid locked evaluations", () => {
  const result = roundEvidence({ ...args, assignments: [assignment("one", [observation({ voided_at: "2026-10-16" })]), assignment("two", [observation({ status: "SUPERSEDED" })])] });
  assert.equal(result.aggregate.count, 0);
  assert.equal(result.lockedEvaluations, 0);
});
test("a newer draft cannot fall back to an older submitted version", () => {
  const result = roundEvidence({ ...args, assignments: [assignment("one", [observation(), observation({ version: 2, status: "DRAFT" })])] });
  assert.equal(result.aggregate.count, 0);
});
test("a rubric minimum remains independent of meeting 75 percent weighted coverage", () => {
  const result = roundEvidence({ ...args, assignments: [assignment("one", [observation({ criterion_ratings: [{ criterion_id: "required", score: 5 }] })])] });
  assert.equal(result.aggregate.count, 0);
  assert.equal(result.lockedEvaluations, 0);
});
test("a missing required criterion and note-only save remain pending", () => {
  const result = roundEvidence({ ...args, assignments: [assignment("one", [observation({ criterion_ratings: [] })]), assignment("two", [observation({ criterion_ratings: [{ criterion_id: "other", score: 5 }] })])] });
  assert.equal(result.aggregate.status, "PENDING");
  assert.equal(result.aggregate.score, null);
});
test("submitted valid evidence can score but cannot count as locked evidence", () => {
  const result = roundEvidence({ ...args, assignments: [assignment("one", [observation({ status: "SUBMITTED" })]), assignment("two")] });
  assert.equal(result.aggregate.count, 2);
  assert.equal(result.lockedEvaluations, 1);
});
test("mismatched rounds and rubric versions do not count", () => {
  const result = roundEvidence({ ...args, assignments: [{ ...assignment("one"), round_id: "elsewhere" }, assignment("two", [observation({ rubric_id: "old-rubric" })])] });
  assert.equal(result.aggregate.count, 0);
});
