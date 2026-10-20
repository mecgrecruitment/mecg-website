import assert from "node:assert/strict";
import test from "node:test";
import { parseRoundCloseSummary } from "./round-close-summary";

const valid = { roundId: "round", roundStatus: "ACTIVE", checkedAt: "2026-10-16T12:00:00Z", applicants: 3, applicantsReady: 1, applicantsIncomplete: 2, submittedEvaluations: 5, validEvaluations: 3, openAssignments: 2 };
test("round close boundary retains submitted versus valid counts", () => {
  assert.deepEqual(parseRoundCloseSummary(valid), valid);
});
test("round close boundary accepts an explicitly empty cohort", () => {
  assert.ok(parseRoundCloseSummary({ ...valid, applicants: 0, applicantsReady: 0, applicantsIncomplete: 0, submittedEvaluations: 0, validEvaluations: 0, openAssignments: 0 }));
});
test("round close boundary refuses missing, invalid and contradictory counts", () => {
  for (const candidate of [null, [], {}, { ...valid, applicants: null }, { ...valid, openAssignments: -1 }, { ...valid, validEvaluations: 6 }, { ...valid, applicantsReady: 3 }, { ...valid, validEvaluations: 1 }, { ...valid, submittedEvaluations: 1.2 }, { ...valid, roundStatus: "BROKEN" }, { ...valid, checkedAt: "unknown" }]) assert.equal(parseRoundCloseSummary(candidate), null);
});
