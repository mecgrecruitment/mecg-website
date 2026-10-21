import assert from "node:assert/strict";
import test from "node:test";
import { firstToRate, holdsOpenRow, keyRating, nextApplicantId, showsWhenUnstartedOnly, unstartedIds } from "./grading-flow";

test("Next opens the following applicant in the shown order, and nothing after the last", () => {
  const order = ["a", "b", "c"];
  assert.equal(nextApplicantId(order, "a"), "b");
  assert.equal(nextApplicantId(order, "c"), null);
  assert.equal(nextApplicantId(order, "gone"), "a", "a row filtered out of view restarts at the top");
  assert.equal(nextApplicantId([], "a"), null);
});

test("unstarted means no score and nothing saved, notes included", () => {
  const rows = {
    fresh: { scores: { x: null, y: null }, savedAt: null },
    rated: { scores: { x: 3, y: null }, savedAt: null },
    noteOnly: { scores: { x: null }, savedAt: "2026-10-20T10:00:00Z" },
  };
  assert.deepEqual([...unstartedIds(rows)], ["fresh"]);
});

test("unstarted filter keeps a row the grader rates after turning it on", () => {
  const snapshot = unstartedIds({ a: { scores: {}, savedAt: null }, b: { scores: { x: 2 }, savedAt: "t" } });
  assert.equal(showsWhenUnstartedOnly("a", snapshot, { scores: { x: 4 }, savedAt: "t" }), true);
  assert.equal(showsWhenUnstartedOnly("b", snapshot, { scores: { x: 2 }, savedAt: "t" }), false);
  assert.equal(showsWhenUnstartedOnly("b", snapshot, { scores: { x: null }, savedAt: null }), true, "a row unstarted now is never hidden");
  assert.equal(showsWhenUnstartedOnly("b", null, { scores: { x: 2 }, savedAt: "t" }), true, "filter off shows everyone");
});

const criterionIds = ["lead", "think", "talk"];

test("a digit rates the focused criterion and moves on to the next", () => {
  assert.deepEqual(keyRating("4", { criterionIds, scores: { lead: 2 }, focusedId: "lead" }), { criterionId: "lead", score: 4, focusNextId: "think" });
  assert.deepEqual(keyRating("1", { criterionIds, scores: {}, focusedId: "talk" }), { criterionId: "talk", score: 1, focusNextId: null });
});

test("without a focused criterion a digit rates the first unscored one", () => {
  assert.deepEqual(keyRating("5", { criterionIds, scores: { lead: 3, think: null }, focusedId: null }), { criterionId: "think", score: 5, focusNextId: "talk" });
  assert.equal(keyRating("5", { criterionIds, scores: { lead: 3, think: 2, talk: 1 }, focusedId: null }), null, "a fully rated row ignores digits");
});

test("other keys and an unchanged score do nothing", () => {
  for (const key of ["0", "6", "a", "Enter", "12"]) assert.equal(keyRating(key, { criterionIds, scores: {}, focusedId: "lead" }), null, key);
  assert.equal(keyRating("3", { criterionIds, scores: { lead: 3 }, focusedId: "lead" }), null);
});

test("Next holds a row open while its save failed, is unconfirmed, or conflicts", () => {
  for (const kind of ["error", "unknown", "conflict"]) assert.equal(holdsOpenRow({ kind }), true, kind);
  for (const kind of ["saving", "saved", "hint"]) assert.equal(holdsOpenRow({ kind }), false, kind);
  assert.equal(holdsOpenRow(undefined), false);
});

test("opening an applicant focuses the first dimension still unrated", () => {
  const ids = ["a", "b", "c"];
  assert.equal(firstToRate(ids, { a: 4, b: null, c: null }), "b");
  assert.equal(firstToRate(ids, { a: 4, c: 2 }), "b", "a missing score counts as unrated");
  assert.equal(firstToRate(ids, { a: 4, b: 3, c: 2 }), "a", "all rated falls back to the first");
  assert.equal(firstToRate([], {}), null);
});
