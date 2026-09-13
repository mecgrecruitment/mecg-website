import test from "node:test";
import assert from "node:assert/strict";
import { SPEED_DATING_SCORE_ANCHORS, SPEED_DATING_SCORE_LABELS } from "./rubrics.ts";

test("speed dating labels and anchors cover scores 1 through 5", () => {
  for (const score of [1, 2, 3, 4, 5]) {
    assert.ok(SPEED_DATING_SCORE_LABELS[score]);
    assert.ok(SPEED_DATING_SCORE_ANCHORS[score]);
  }
  assert.deepEqual(Object.keys(SPEED_DATING_SCORE_LABELS), ["1", "2", "3", "4", "5"]);
  assert.deepEqual(Object.keys(SPEED_DATING_SCORE_ANCHORS), ["1", "2", "3", "4", "5"]);
});
