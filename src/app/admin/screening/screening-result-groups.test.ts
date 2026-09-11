import test from "node:test";
import assert from "node:assert/strict";
import { rankScreeningResults, type ScreeningResult } from "./screening-result-groups";

function review(code: string, score: number, recommendation: ScreeningResult["recommendation"] = "ADVANCE", applicantName?: string): ScreeningResult {
  return { code, applicationId: `id-${code}`, applicantName, classYear: "JUNIOR", major: "Economics", events: ["Mass Meeting", "Career Panel"], recommendation, score, submittedAt: "2026-09-01T00:00:00Z", ratings: [] };
}

test("ranked screening results sort by average score, then name, then code, with dense ranks", () => {
  const ranked = rankScreeningResults([
    review("APP-03", 3, "HOLD", "Zed"),
    review("APP-01", 4, "ADVANCE", "Amy"),
    review("APP-02", 3, "DECLINE", "Bob"),
    review("APP-04", 3, "HOLD", "Bob"),
  ]);
  assert.deepEqual(ranked.map((applicant) => applicant.code), ["APP-01", "APP-02", "APP-04", "APP-03"]);
  assert.deepEqual(ranked.map((applicant) => applicant.rank), [1, 2, 2, 2]);
  assert.deepEqual(ranked[1].recommendationCounts, { DECLINE: 1 });
});

test("z-score is the population z-score of each applicant's average", () => {
  // averages 5, 3, 1: mean 3, population std dev sqrt(8/3)
  const ranked = rankScreeningResults([review("A", 5), review("B", 3), review("C", 1)]);
  const stdDev = Math.sqrt(8 / 3);
  assert.ok(Math.abs((ranked[0].zScore ?? 0) - 2 / stdDev) < 1e-12);
  assert.equal(ranked[1].zScore, 0);
  assert.ok(Math.abs((ranked[2].zScore ?? 0) + 2 / stdDev) < 1e-12);
});

test("z-score is null for a single applicant and when every average is equal", () => {
  assert.equal(rankScreeningResults([review("A", 4), review("A", 2)])[0].zScore, null);
  assert.deepEqual(rankScreeningResults([review("A", 3), review("B", 3)]).map((applicant) => applicant.zScore), [null, null]);
});

test("average is per applicant, not per review", () => {
  const ranked = rankScreeningResults([review("A", 4), review("A", 3), review("A", 2), review("B", 1)]);
  assert.equal(ranked.length, 2);
  assert.equal(ranked[0].code, "A");
  assert.equal(ranked[0].averageScore, 3);
  assert.equal(ranked[0].reviews.length, 3);
  assert.deepEqual(ranked[0].recommendationCounts, { ADVANCE: 3 });
});

test("dense ranking increments by one after a tie", () => {
  const ranked = rankScreeningResults([review("A", 5), review("B", 4), review("C", 4), review("D", 3)]);
  assert.deepEqual(ranked.map((applicant) => [applicant.code, applicant.rank]), [["A", 1], ["B", 2], ["C", 2], ["D", 3]]);
});
