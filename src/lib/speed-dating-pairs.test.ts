import test from "node:test";
import assert from "node:assert/strict";
import {
  isSpeedDatingPairQueue,
  isSpeedDatingPairSetup,
  searchSpeedDatingPairs,
  type SpeedDatingPair,
} from "./speed-dating-pairs";

const pairs: SpeedDatingPair[] = [
  {
    id: "pair-1",
    label: "Pair 01",
    claimed: false,
    submittedAt: null,
    members: [
      { applicationId: "app-1", name: "Amélie Jones", position: 1, assignmentId: null, assignmentStatus: null },
      { applicationId: "app-2", name: "Marcus Lee", position: 2, assignmentId: null, assignmentStatus: null },
    ],
  },
  {
    id: "pair-2",
    label: "Pair 02",
    claimed: true,
    submittedAt: null,
    members: [
      { applicationId: "app-3", name: "Priya Shah", position: 1, assignmentId: "assignment-3", assignmentStatus: "ASSIGNED" },
      { applicationId: "app-4", name: "Noah Kim", position: 2, assignmentId: "assignment-4", assignmentStatus: "ASSIGNED" },
    ],
  },
];

test("search finds a pair by either applicant name", () => {
  assert.deepEqual(searchSpeedDatingPairs(pairs, "marcus").map((pair) => pair.id), ["pair-1"]);
  assert.deepEqual(searchSpeedDatingPairs(pairs, "Priya").map((pair) => pair.id), ["pair-2"]);
});

test("pair setup validation keeps the Board payload pair-shaped", () => {
  assert.equal(isSpeedDatingPairSetup({
    roundId: "round-1",
    roundStatus: "DRAFT",
    participants: [{ applicationId: "app-1", name: "Alex Kim" }, { applicationId: "app-2", name: "Sam Lee" }],
    pairs: [{ id: "pair-1", label: "Pair 01", status: "DRAFT", applicationIds: ["app-1", "app-2"] }],
  }), true);
  assert.equal(isSpeedDatingPairSetup({
    roundId: "round-1",
    roundStatus: "DRAFT",
    participants: [],
    pairs: [{ id: "pair-1", label: "Pair 01", status: "DRAFT", applicationIds: ["app-1"] }],
  }), false);
});

test("search is case, whitespace, and accent insensitive", () => {
  assert.deepEqual(searchSpeedDatingPairs(pairs, "  AMELIE ").map((pair) => pair.id), ["pair-1"]);
});

test("blank search does not expose a wall of applicant names", () => {
  assert.deepEqual(searchSpeedDatingPairs(pairs, " "), []);
});

test("queue validation requires exactly two ordered members", () => {
  const queue = { roundId: "round-1", roundName: "Speed Dating", roundStatus: "ACTIVE", calibrated: true, rubricReady: true, criterion: { id: "criterion-1", name: "Overall", description: "Overall assessment" }, pairs };
  assert.equal(isSpeedDatingPairQueue(queue), true);
  assert.equal(isSpeedDatingPairQueue({ ...queue, pairs: [{ ...pairs[0], members: [pairs[0].members[0]] }] }), false);
});

test("pair ratings require two distinct applicants and evidence for 1, 2, and 5", async () => {
  const { parseSpeedDatingPairRatings } = await import("./speed-dating-pairs");
  assert.deepEqual(parseSpeedDatingPairRatings([
    { applicationId: "app-1", score: 3, note: "" },
    { applicationId: "app-2", score: 5, note: "Strong listening" },
  ]), [
    { applicationId: "app-1", score: 3, note: "" },
    { applicationId: "app-2", score: 5, note: "Strong listening" },
  ]);
  assert.equal(parseSpeedDatingPairRatings([
    { applicationId: "app-1", score: 1, note: "" },
    { applicationId: "app-2", score: 3, note: "" },
  ]), null);
  assert.equal(parseSpeedDatingPairRatings([
    { applicationId: "app-1", score: 3, note: "" },
    { applicationId: "app-1", score: 4, note: "" },
  ]), null);
});
