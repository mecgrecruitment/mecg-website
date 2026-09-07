import test from "node:test";
import assert from "node:assert/strict";
import { speedDatingCoverageRank, speedDatingPairCoverage } from "./speed-dating-coverage";

const pair = ["app-1", "app-2"] as const;

test("pair coverage completes only when the same evaluator submits both applicants", () => {
  const coverage = speedDatingPairCoverage(pair, [
    { applicationId: "app-1", evaluatorId: "judge-1", evaluatorName: "Judge One", status: "SUBMITTED" },
    { applicationId: "app-2", evaluatorId: "judge-1", evaluatorName: "Judge One", status: "SUBMITTED" },
    { applicationId: "app-1", evaluatorId: "judge-2", evaluatorName: "Judge Two", status: "SUBMITTED" },
    { applicationId: "app-2", evaluatorId: "judge-2", evaluatorName: "Judge Two", status: "ASSIGNED" },
  ]);
  assert.equal(coverage.completeEvaluators, 1);
  assert.deepEqual(coverage.evaluators.map((evaluator) => evaluator.state), ["STARTED", "COMPLETE"]);
  assert.equal(speedDatingCoverageRank(coverage), 1);
});

test("a one-sided assignment is flagged before ordinary incomplete coverage", () => {
  const coverage = speedDatingPairCoverage(pair, [
    { applicationId: "app-1", evaluatorId: "judge-1", evaluatorName: "Judge One", status: "ASSIGNED" },
  ]);
  assert.equal(coverage.hasBrokenAssignment, true);
  assert.equal(coverage.evaluators[0]?.state, "BROKEN");
  assert.equal(speedDatingCoverageRank(coverage), 0);
});

test("recused and missed halves do not masquerade as pair progress", () => {
  const coverage = speedDatingPairCoverage(pair, [
    { applicationId: "app-1", evaluatorId: "judge-1", evaluatorName: "Judge One", status: "RECUSED" },
    { applicationId: "app-2", evaluatorId: "judge-1", evaluatorName: "Judge One", status: "MISSED" },
  ]);
  assert.equal(coverage.evaluators.length, 0);
  assert.equal(coverage.completeEvaluators, 0);
});
