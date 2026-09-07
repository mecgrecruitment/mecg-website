import assert from "node:assert/strict";
import test from "node:test";
import { countsTowardCoverage, groupCaseCoverageRank, groupCaseCoverageState } from "./group-case-coverage";

test("recused and missed assignments do not count as Group Case coverage", () => {
  assert.equal(countsTowardCoverage("RECUSED"), false);
  assert.equal(countsTowardCoverage("MISSED"), false);
  assert.deepEqual(groupCaseCoverageState(["RECUSED", "MISSED"]), {
    assigned: 0,
    submitted: 0,
    state: "UNASSIGNED",
  });
});

test("one usable assignment is partial and two open assignments are in progress", () => {
  assert.equal(groupCaseCoverageState(["ASSIGNED"]).state, "PARTIAL");
  assert.deepEqual(groupCaseCoverageState(["ASSIGNED", "IN_PROGRESS"]), {
    assigned: 2,
    submitted: 0,
    state: "IN_PROGRESS",
  });
});

test("coverage completes only after both required evaluations submit", () => {
  assert.deepEqual(groupCaseCoverageState(["SUBMITTED", "LOCKED", "RECUSED"]), {
    assigned: 2,
    submitted: 2,
    state: "SUBMITTED",
  });
  assert.equal(groupCaseCoverageState(["SUBMITTED", "LOCKED", "ASSIGNED"]).state, "IN_PROGRESS");
});

test("coverage ranking puts applicants needing assignment first", () => {
  assert.deepEqual(
    ["SUBMITTED", "IN_PROGRESS", "UNASSIGNED", "PARTIAL"].sort((a, b) =>
      groupCaseCoverageRank(a as Parameters<typeof groupCaseCoverageRank>[0])
      - groupCaseCoverageRank(b as Parameters<typeof groupCaseCoverageRank>[0])),
    ["UNASSIGNED", "PARTIAL", "IN_PROGRESS", "SUBMITTED"],
  );
});
