import test from "node:test";
import assert from "node:assert/strict";
import { groupScreeningResults } from "./screening-result-groups";

test("screening results group independent reviews under one applicant summary", () => {
  const groups = groupScreeningResults([
    { code: "APP-01", applicantName: "Applicant", recommendation: "ADVANCE", score: 4, evidence: "A" },
    { code: "APP-01", applicantName: "Applicant", recommendation: "HOLD", score: 3, evidence: "B" },
    { code: "APP-02", applicantName: "Other", recommendation: "DECLINE", score: 2, evidence: "C" },
  ]);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].reviews.length, 2);
  assert.equal(groups[0].averageScore, 3.5);
  assert.deepEqual(groups[0].recommendationCounts, { ADVANCE: 1, HOLD: 1 });
});
