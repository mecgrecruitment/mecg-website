import assert from "node:assert/strict";
import test from "node:test";
import { ballotList, shouldScrollToPresenting, unvotedIds } from "./ballot-list";

const applicants = [
  { id: "a", name: "Ada Lovelace" },
  { id: "b", name: "Grace Hopper" },
  { id: "c", name: "Alan Turing" },
];
const none = new Set<string>();
const ids = (list: { id: string }[]) => list.map((applicant) => applicant.id);

test("shows everyone when nothing narrows the list", () => {
  assert.deepEqual(ids(ballotList(applicants, { query: "", pinnedId: null, unvotedSnapshot: null, unvotedNow: none })), ["a", "b", "c"]);
});

test("the presented applicant is not repeated below the Now presenting card", () => {
  assert.deepEqual(ids(ballotList(applicants, { query: "", pinnedId: "b", unvotedSnapshot: null, unvotedNow: none })), ["a", "c"]);
});

test("a row the member was typing in stays in the list when the board presents that applicant", () => {
  assert.deepEqual(ids(ballotList(applicants, { query: "", pinnedId: "b", keepId: "b", unvotedSnapshot: null, unvotedNow: none })), ["a", "b", "c"]);
  assert.deepEqual(ids(ballotList(applicants, { query: "", pinnedId: "b", keepId: "a", unvotedSnapshot: null, unvotedNow: none })), ["a", "c"], "keeping another row never un-pins the presented one");
});

test("unvoted filter keeps a row the member votes on after turning it on", () => {
  const snapshot = unvotedIds({ a: { vote: "" }, b: { vote: "YES" }, c: { vote: "" } });
  assert.deepEqual([...snapshot].sort(), ["a", "c"]);
  // "a" is voted now, but the snapshot keeps it visible and editable.
  const now = unvotedIds({ a: { vote: "NO" }, b: { vote: "YES" }, c: { vote: "" } });
  assert.deepEqual(ids(ballotList(applicants, { query: "", pinnedId: null, unvotedSnapshot: snapshot, unvotedNow: now })), ["a", "c"]);
});

test("unvoted filter shows a row whose vote failed to save after the filter went on", () => {
  const snapshot = unvotedIds({ a: { vote: "" }, b: { vote: "YES" }, c: { vote: "" } });
  // b's YES was still saving when the filter went on, then failed and reverted.
  const now = unvotedIds({ a: { vote: "" }, b: { vote: "" }, c: { vote: "" } });
  assert.deepEqual(ids(ballotList(applicants, { query: "", pinnedId: null, unvotedSnapshot: snapshot, unvotedNow: now })), ["a", "b", "c"]);
});

test("search combines with the unvoted filter", () => {
  const snapshot = new Set(["a", "c"]);
  assert.deepEqual(ids(ballotList(applicants, { query: "ala", pinnedId: null, unvotedSnapshot: snapshot, unvotedNow: snapshot })), ["c"]);
});

test("a new presenter scrolls a member who is near the top or can see the card", () => {
  assert.equal(shouldScrollToPresenting({ top: -900, bottom: -600 }, 800, 40), true, "near the top of the page");
  assert.equal(shouldScrollToPresenting({ top: -100, bottom: 200 }, 800, 900), true, "card partly on screen");
});

test("a member reading further down the list is not yanked back up", () => {
  assert.equal(shouldScrollToPresenting({ top: -1400, bottom: -1100 }, 800, 1500), false);
});
