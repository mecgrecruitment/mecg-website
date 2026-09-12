import test from "node:test";
import assert from "node:assert/strict";
import { calibrateScreeningResults } from "./reader-calibration";
import type { ScreeningResult } from "./screening-result-groups";

function review(code: string, score: number, reviewerId?: string, reviewerName?: string, recommendation: ScreeningResult["recommendation"] = "ADVANCE"): ScreeningResult {
  return { code, applicationId: `id-${code}`, applicantName: code, classYear: "JUNIOR", major: "Economics", events: [], recommendation, score, submittedAt: "2026-09-01T00:00:00Z", ratings: [], reviewerId, reviewerName };
}

const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} !== ${expected}`);

test("a reader who always scores 10 below a co-reader gets a -5 lean and the co-reader +5", () => {
  const { readers, applicants } = calibrateScreeningResults([
    review("A", 80, "X", "Xena"), review("A", 70, "Y", "Yuri"),
    review("B", 60, "X", "Xena"), review("B", 50, "Y", "Yuri"),
    review("C", 90, "X", "Xena"), review("C", 80, "Y", "Yuri"),
  ]);
  const byId = Object.fromEntries(readers.map((reader) => [reader.id, reader]));
  close(byId.X.effect, 5);
  close(byId.Y.effect, -5);
  assert.equal(readers[0].id, "X");
  assert.equal(byId.Y.name, "Yuri");
  assert.equal(byId.Y.reads, 3);
  for (const applicant of applicants) close(applicant.adjustedScore, applicant.averageScore);
});

test("adjusting for reader lean can flip the ranking", () => {
  // True values A 80, B 75, C 70, D 70. Harsh readers H1/H2 score 10 low, lenient L1/L2 score 10 high.
  const { applicants } = calibrateScreeningResults([
    review("A", 70, "H1"), review("A", 70, "H2"),
    review("B", 85, "L1"), review("B", 85, "L2"),
    review("C", 60, "H1"), review("C", 80, "L1"),
    review("D", 60, "H2"), review("D", 80, "L2"),
  ]);
  const byCode = Object.fromEntries(applicants.map((applicant) => [applicant.code, applicant]));
  assert.equal(byCode.B.rawRank, 1);
  assert.equal(byCode.A.rawRank, 2);
  assert.equal(byCode.A.adjustedRank, 1);
  assert.equal(byCode.B.adjustedRank, 2);
  close(byCode.A.adjustedScore, 80);
  close(byCode.B.adjustedScore, 75);
  assert.deepEqual(applicants.map((applicant) => [applicant.code, applicant.adjustedRank]), [["A", 1], ["B", 2], ["C", 3], ["D", 3]]);
  close(byCode.A.adjustedReviews[0].adjusted, 80);
  close(byCode.A.adjustedReviews[0].effect, -10);
});

test("reader effects average to zero, and reviews without a reviewer share one effect", () => {
  const { readers } = calibrateScreeningResults([
    review("A", 90, "X"), review("A", 40),
    review("B", 70, "X"), review("B", 65, "Z"),
    review("C", 55), review("C", 75, "Z"),
  ]);
  close(readers.reduce((sum, reader) => sum + reader.effect, 0), 0);
  assert.equal(readers.find((reader) => reader.id === "?")?.reads, 2);
});

test("empty input returns empty arrays", () => {
  assert.deepEqual(calibrateScreeningResults([]), { readers: [], applicants: [] });
});
