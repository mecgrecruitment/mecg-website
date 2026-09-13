import test from "node:test";
import assert from "node:assert/strict";
import { SPEED_DATING_SCORE_ANCHORS, SPEED_DATING_SCORE_LABELS, starsFromScore } from "./rubrics.ts";

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
