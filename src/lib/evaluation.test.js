import test from "node:test";
import assert from "node:assert/strict";
import { aggregateRound, combineRoundScores, scoreEvaluation } from "./evaluation.js";

const criteria = [
  { id: "required", weight: 40, required: true },
  { id: "second", weight: 35, required: false },
  { id: "third", weight: 25, required: false },
];

test("scoreEvaluation converts anchored ratings to a weighted 0-100 score", () => {
  const result = scoreEvaluation(criteria, [
    { criterionId: "required", score: 5 },
    { criterionId: "second", score: 3 },
    { criterionId: "third", score: 1 },
  ]);
  assert.equal(result.valid, true);
  assert.equal(result.score, 57.5);
  assert.equal(result.coverage, 1);
});

test("scoreEvaluation rejects missing required criteria and low coverage", () => {
  assert.equal(
    scoreEvaluation(criteria, [
      { criterionId: "second", score: 4 },
      { criterionId: "third", score: 4 },
    ]).valid,
    false,
  );
  assert.equal(
    scoreEvaluation(criteria, [{ criterionId: "required", score: 4 }]).valid,
    false,
  );
});

test("scoreEvaluation enforces observed criterion count independently of weight", () => {
  const topHeavyCriteria = [
    { id: "required", weight: 80, required: true },
    { id: "second", weight: 10, required: false },
    { id: "third", weight: 10, required: false },
  ];
  const result = scoreEvaluation(
    topHeavyCriteria,
    [{ criterionId: "required", score: 4 }],
    2,
  );

  assert.equal(result.coverage, 0.8);
  assert.equal(result.valid, false);
  assert.equal(result.score, null);
});

test("scoreEvaluation uses the rubric's explicit observed criterion minimum", () => {
  const result = scoreEvaluation(criteria, [
    { criterionId: "required", score: 4 },
    { criterionId: "second", score: 4 },
  ], 2);

  assert.equal(result.coverage, 0.75);
  assert.equal(result.valid, true);
});

test("aggregateRound keeps a single evaluation pending and flags wide disagreement", () => {
  assert.equal(aggregateRound([{ valid: true, score: 70 }]).status, "PENDING");
  const aggregate = aggregateRound([
    { valid: true, score: 50 },
    { valid: true, score: 80 },
  ]);
  assert.equal(aggregate.status, "REVIEW");
  assert.equal(aggregate.score, 65);
  assert.equal(aggregate.spread, 30);
});

test("combineRoundScores requires every configured round", () => {
  assert.equal(
    combineRoundScores([
      { score: 75, weight: 40 },
      { score: 85, weight: 60 },
    ]),
    81,
  );
  assert.equal(
    combineRoundScores([
      { score: 75, weight: 40 },
      { score: null, weight: 60 },
    ]),
    null,
  );
});

test("aggregateRound treats a 25-point spread as disagreement and nothing narrower", () => {
  assert.equal(
    aggregateRound([
      { valid: true, score: 50 },
      { valid: true, score: 75 },
    ]).status,
    "REVIEW",
  );
  assert.equal(
    aggregateRound([
      { valid: true, score: 50 },
      { valid: true, score: 74 },
    ]).status,
    "COMPLETE",
  );
  assert.deepEqual(aggregateRound([]), {
    status: "PENDING",
    score: null,
    count: 0,
    spread: null,
  });
});

test("combineRoundScores ignores weight-0 rounds such as blind screening", () => {
  assert.equal(
    combineRoundScores([
      { score: 75, weight: 40 },
      { score: 85, weight: 60 },
      { score: null, weight: 0 },
    ]),
    81,
  );
  assert.equal(
    combineRoundScores([
      { score: 75, weight: 40 },
      { score: 85, weight: 60 },
      { score: 10, weight: 0 },
    ]),
    81,
  );
  assert.equal(
    combineRoundScores([
      { score: 75, weight: 40 },
      { score: null, weight: 60 },
      { score: 90, weight: 0 },
    ]),
    null,
  );
  assert.equal(combineRoundScores([{ score: 90, weight: 0 }]), null);
  assert.equal(combineRoundScores([]), null);
});
