import test from "node:test";
import assert from "node:assert/strict";
import { screeningRecommendationWarning, screeningReviewBlocker } from "./screening-review-readiness";

const criteria = [{ id: "motivation", name: "Motivation" }, { id: "impact", name: "Impact" }];

test("screeningReviewBlocker requires an evidence note for ratings 1 and 5 only", () => {
  const base = { scores: { motivation: "4", impact: "3" }, notes: {}, evidence: "Specific written evidence supports this decision.", recommendation: "HOLD" };
  assert.equal(screeningReviewBlocker(criteria, base), null);
  assert.equal(screeningReviewBlocker(criteria, { ...base, scores: { ...base.scores, motivation: "2" } }), null);
  for (const score of ["1", "5"]) {
    assert.deepEqual(screeningReviewBlocker(criteria, { ...base, scores: { ...base.scores, motivation: score } }), {
      field: "note",
      criterionId: "motivation",
      message: `Add a brief evidence note for the ${score} rating on Motivation.`,
    });
  }
});

test("screeningReviewBlocker permits extreme ratings when their evidence note is present", () => {
  const blocker = screeningReviewBlocker(criteria, {
    scores: { motivation: "1", impact: "5" },
    notes: { motivation: "Response does not address the prompt.", impact: "Names a specific, measurable result." },
    evidence: "The recommendation follows from the evidence above.",
    recommendation: "HOLD",
  });
  assert.equal(blocker, null);
});

test("screeningRecommendationWarning flags recommendations that run against the ratings", () => {
  assert.match(screeningRecommendationWarning({ a: "1", b: "2" }, "ADVANCE") ?? "", /average criterion rating is below 3/);
  assert.match(screeningRecommendationWarning({ a: "4", b: "5" }, "DECLINE") ?? "", /average criterion rating is above 3/);
  assert.equal(screeningRecommendationWarning({ a: "3", b: "4" }, "ADVANCE"), null);
});
