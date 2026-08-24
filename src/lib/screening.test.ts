import test from "node:test";
import assert from "node:assert/strict";
import { distributeScreeningReviews } from "./screening.ts";

test("screening distribution gives every packet three distinct balanced reviewers", () => {
  const reviewerIds = ["r1", "r2", "r3", "r4", "r5", "r6"];
  const result = distributeScreeningReviews({
    packets: Array.from({ length: 8 }, (_, index) => ({ packetId: `p${index}`, eligibleReviewerIds: reviewerIds })),
    reviewers: reviewerIds.map((reviewerId) => ({ reviewerId })),
    seed: "cycle-one",
  });
  assert.equal(result.feasible, true);
  for (let index = 0; index < 8; index += 1) {
    const assigned = result.assignments.filter((assignment) => assignment.packetId === `p${index}`);
    assert.equal(assigned.length, 3);
    assert.equal(new Set(assigned.map((assignment) => assignment.reviewerId)).size, 3);
  }
  const loads = Object.values(result.loads);
  assert.ok(Math.max(...loads) - Math.min(...loads) <= 1);
});

test("screening distribution excludes conflicts and reports impossible coverage", () => {
  const result = distributeScreeningReviews({
    packets: [
      { packetId: "possible", eligibleReviewerIds: ["r1", "r2", "r3"] },
      { packetId: "blocked", eligibleReviewerIds: ["r1", "r2"] },
    ],
    reviewers: ["r1", "r2", "r3", "r4"].map((reviewerId) => ({ reviewerId, capacity: 3 })),
    seed: "conflicts",
  });
  assert.equal(result.feasible, false);
  assert.deepEqual(result.shortages, ["blocked"]);
  assert.equal(result.assignments.some((item) => item.packetId === "blocked" && item.reviewerId === "r3"), false);
});

test("screening distribution is reproducible for the same seed", () => {
  const input = {
    packets: ["p1", "p2"].map((packetId) => ({ packetId, eligibleReviewerIds: ["r1", "r2", "r3", "r4"] })),
    reviewers: ["r1", "r2", "r3", "r4"].map((reviewerId) => ({ reviewerId })),
    seed: "repeatable",
  };
  assert.deepEqual(distributeScreeningReviews(input), distributeScreeningReviews(input));
});

test("screening distribution respects a low reviewer capacity without overloading peers unnecessarily", () => {
  const result = distributeScreeningReviews({
    packets: ["p1", "p2"].map((packetId) => ({ packetId, eligibleReviewerIds: ["r1", "r2", "r3", "r4"] })),
    reviewers: [{ reviewerId: "r1", capacity: 0 }, { reviewerId: "r2" }, { reviewerId: "r3" }, { reviewerId: "r4" }],
    seed: "capacity",
  });
  assert.equal(result.feasible, true);
  assert.equal(result.loads.r1, 0);
  assert.deepEqual([result.loads.r2, result.loads.r3, result.loads.r4].sort(), [2, 2, 2]);
});
