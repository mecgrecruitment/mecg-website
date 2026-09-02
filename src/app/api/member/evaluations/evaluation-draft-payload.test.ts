import assert from "node:assert/strict";
import test from "node:test";
import { parseEvaluationDraftPayload } from "./evaluation-draft-payload";

const validPayload = {
  ratings: [
    { criterionId: "judgment", score: "5", note: "Specific evidence" },
    { criterionId: "teamwork", score: "", note: "" },
  ],
  evidence: "Observed during the case.",
};

test("accepts complete and partially scored evaluation drafts", () => {
  assert.deepEqual(parseEvaluationDraftPayload(validPayload), validPayload);
  assert.equal(parseEvaluationDraftPayload({
    ...validPayload,
    ratings: validPayload.ratings.map((rating) => ({ ...rating, score: "NO" })),
  })?.ratings[0].score, "NO");
});

test("rejects duplicate criteria and invalid score values", () => {
  assert.equal(parseEvaluationDraftPayload({
    ...validPayload,
    ratings: [validPayload.ratings[0], validPayload.ratings[0]],
  }), null);
  assert.equal(parseEvaluationDraftPayload({
    ...validPayload,
    ratings: [{ criterionId: "judgment", score: "6", note: "" }],
  }), null);
});

test("rejects missing and overlong draft fields", () => {
  assert.equal(parseEvaluationDraftPayload({ ratings: validPayload.ratings }), null);
  assert.equal(parseEvaluationDraftPayload({
    ...validPayload,
    evidence: "e".repeat(4001),
  }), null);
  assert.equal(parseEvaluationDraftPayload({
    ...validPayload,
    ratings: [{ criterionId: "judgment", score: "4", note: "n".repeat(2001) }],
  }), null);
});
