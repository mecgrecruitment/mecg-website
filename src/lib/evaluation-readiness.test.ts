import test from "node:test";
import assert from "node:assert/strict";
import { evaluationReadiness } from "./evaluation-readiness";
import { scoreEvaluation } from "./evaluation.js";

const criteria = [
  { id: "a", name: "Collaboration", weight: 40, required: true },
  { id: "b", name: "Reasoning", weight: 35, required: false },
  { id: "c", name: "Presentation", weight: 25, required: false },
];

test("readiness separates explicit not observed from unanswered and malformed ratings", () => {
  for (const value of ["", "0", "6", "3.5", "03", "NaN"]) {
    const result = evaluationReadiness({ criteria, scores: { a: "3", b: "3", c: value }, notes: {}, minimumObservedCriteria: 2 });
    assert.equal(result.ready, false);
    assert.equal(result.observedCount, 2);
    assert.equal(result.blockers[0]?.criterionId, "c");
  }
  const result = evaluationReadiness({ criteria, scores: { a: "3", b: "3", c: "NO" }, notes: {}, minimumObservedCriteria: 2 });
  assert.equal(result.ready, true);
  assert.equal(result.coverage, 0.75);
  assert.equal(result.observedCount, 2);
});

test("readiness honors the rubric minimum even when observed weight exceeds 75%", () => {
  const result = evaluationReadiness({
    criteria: criteria.map((criterion, i) => ({ ...criterion, weight: i === 0 ? 80 : 10 })),
    scores: { a: "3", b: "NO", c: "NO" }, notes: {}, minimumObservedCriteria: 3,
  });
  assert.equal(result.coverage, 0.8);
  assert.equal(result.ready, false);
  assert.match(result.blockers[0]?.message ?? "", /at least 3 criteria/);
});

test("readiness explains required observations even with sufficient count and weight", () => {
  const result = evaluationReadiness({
    criteria: criteria.map((criterion, i) => ({ ...criterion, weight: i === 0 ? 20 : 40 })),
    scores: { a: "NO", b: "3", c: "4" }, notes: {}, minimumObservedCriteria: 2,
  });
  assert.equal(result.ready, false);
  assert.equal(result.coverage, 0.8);
  assert.match(result.blockers[0]?.message ?? "", /Collaboration is required/);
});

test("readiness requires nonblank evidence for interview ratings 1, 2, and 5", () => {
  for (const rating of ["1", "2", "5"]) {
    const draft = { criteria, scores: { a: rating, b: "3", c: "4" }, notes: { a: " \n " }, minimumObservedCriteria: 3 };
    const result = evaluationReadiness(draft);
    assert.equal(result.ready, false);
    assert.deepEqual(result.blockers[0], { field: "note", criterionId: "a", message: "Add an evidence note for Collaboration." });
    assert.equal(evaluationReadiness({ ...draft, notes: { a: "Invited a quiet teammate to explain their approach." } }).ready, true);
  }
});

test("readiness rejects empty rubrics and ignores scores outside the active rubric", () => {
  assert.equal(evaluationReadiness({ criteria: [], scores: {}, notes: {}, minimumObservedCriteria: 1 }).ready, false);
  const result = evaluationReadiness({ criteria, scores: { a: "3", b: "NO", c: "NO", foreign: "5" }, notes: {}, minimumObservedCriteria: 2 });
  assert.equal(result.observedCount, 1);
  assert.equal(result.coverage, 0.4);
  assert.equal(result.ready, false);
});

test("readiness matches existing scoring validity for every completed three-criterion rubric", () => {
  const choices = ["1", "2", "3", "4", "5", "NO"];
  for (const minimumObservedCriteria of [1, 2, 3]) {
    for (const a of choices) for (const b of choices) for (const c of choices) {
      const scores: Record<string, string> = { a, b, c };
      const ready = evaluationReadiness({ criteria, scores, notes: { a: "Evidence", b: "Evidence", c: "Evidence" }, minimumObservedCriteria });
      const scored = scoreEvaluation(criteria, criteria.map(({ id }) => ({ criterionId: id, score: scores[id] === "NO" ? null : Number(scores[id]) })), minimumObservedCriteria);
      assert.equal(ready.ready, scored.valid, JSON.stringify({ scores, minimumObservedCriteria }));
      assert.equal(ready.coverage, scored.coverage);
    }
  }
});
