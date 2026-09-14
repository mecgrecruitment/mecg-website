import test from "node:test";
import assert from "node:assert/strict";
import { ROUND_DEFINITIONS, SPEED_DATING_SCORE_ANCHORS, SPEED_DATING_SCORE_LABELS, groupCaseTotal, starsFromScore } from "./rubrics.ts";

test("starsFromScore maps the 0..100 round score back onto 1..5 stars", () => {
  assert.equal(starsFromScore(0), 1);
  assert.equal(starsFromScore(82.5), 4.3);
  assert.equal(starsFromScore(100), 5);
});

test("speed dating labels and anchors cover scores 1 through 5", () => {
  for (const score of [1, 2, 3, 4, 5]) {
    assert.ok(SPEED_DATING_SCORE_LABELS[score]);
    assert.ok(SPEED_DATING_SCORE_ANCHORS[score]);
  }
  assert.deepEqual(Object.keys(SPEED_DATING_SCORE_LABELS), ["1", "2", "3", "4", "5"]);
  assert.deepEqual(Object.keys(SPEED_DATING_SCORE_ANCHORS), ["1", "2", "3", "4", "5"]);
});

test("groupCaseTotal rescales weighted stars onto the guide's 6..40 range", () => {
  const criteria = ROUND_DEFINITIONS[1].criteria.map(([id, , weight]) => ({ id, weight }));
  const all = (score: number) => Object.fromEntries(criteria.map(({ id }) => [id, score]));
  assert.deepEqual(groupCaseTotal(all(5), criteria), { total: 40, band: "Yes, should already be in MECG" });
  assert.deepEqual(groupCaseTotal(all(3), criteria), { total: 24, band: "Average" });
  assert.equal(groupCaseTotal({ ...all(3), composure: null }, criteria), null);
  assert.deepEqual(groupCaseTotal({ ...all(3), collaboration: 5 }, criteria), { total: 28, band: "Leaning yes" });
});
