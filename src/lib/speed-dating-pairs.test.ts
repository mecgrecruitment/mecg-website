import test from "node:test";
import assert from "node:assert/strict";
import {
  isSpeedDatingPairQueue,
  searchSpeedDatingPairs,
  type SpeedDatingPair,
} from "./speed-dating-pairs";

const pairs: SpeedDatingPair[] = [
  {
    id: "pair-1",
    label: "Pair 01",
    claimed: false,
    members: [
      { applicationId: "app-1", name: "Amélie Jones", position: 1 },
      { applicationId: "app-2", name: "Marcus Lee", position: 2 },
    ],
  },
  {
    id: "pair-2",
    label: "Pair 02",
    claimed: true,
    members: [
      { applicationId: "app-3", name: "Priya Shah", position: 1 },
      { applicationId: "app-4", name: "Noah Kim", position: 2 },
    ],
  },
];

test("search finds a pair by either applicant name", () => {
  assert.deepEqual(searchSpeedDatingPairs(pairs, "marcus").map((pair) => pair.id), ["pair-1"]);
  assert.deepEqual(searchSpeedDatingPairs(pairs, "Priya").map((pair) => pair.id), ["pair-2"]);
});

test("search is case, whitespace, and accent insensitive", () => {
  assert.deepEqual(searchSpeedDatingPairs(pairs, "  AMELIE ").map((pair) => pair.id), ["pair-1"]);
});

test("blank search does not expose a wall of applicant names", () => {
  assert.deepEqual(searchSpeedDatingPairs(pairs, " "), []);
});

test("queue validation requires exactly two ordered members", () => {
  assert.equal(isSpeedDatingPairQueue({ roundId: "round-1", roundName: "Speed Dating", roundStatus: "ACTIVE", pairs }), true);
  assert.equal(isSpeedDatingPairQueue({ roundId: "round-1", roundName: "Speed Dating", roundStatus: "ACTIVE", pairs: [{ ...pairs[0], members: [pairs[0].members[0]] }] }), false);
});
