import test from "node:test";
import assert from "node:assert/strict";
import {
  isSpeedDatingPairQueue,
  isSpeedDatingPairSetup,
  parseSpeedDatingPairRatings,
  searchSpeedDatingApplicants,
  searchSpeedDatingPairs,
  type SpeedDatingApplicant,
  type SpeedDatingPair,
} from "./speed-dating-pairs";

const pairs: SpeedDatingPair[] = [
  {
    id: "pair-1",
    label: "Session 1 · Pair 01",
    session: 1,
    claimed: false,
    submittedAt: null,
    members: [
      { applicationId: "app-1", name: "Amélie Jones", position: 1, assignmentId: null, assignmentStatus: null },
      { applicationId: "app-2", name: "Marcus Lee", position: 2, assignmentId: null, assignmentStatus: null },
    ],
  },
  {
    id: "pair-2",
    label: "Session 1 · Pair 02",
    session: 1,
    claimed: true,
    submittedAt: null,
    members: [
      { applicationId: "app-3", name: "Priya Shah", position: 1, assignmentId: "assignment-3", assignmentStatus: "ASSIGNED" },
      { applicationId: "app-4", name: "Noah Kim", position: 2, assignmentId: "assignment-4", assignmentStatus: "ASSIGNED" },
      { applicationId: "app-5", name: "Sam Lee", position: 3, assignmentId: "assignment-5", assignmentStatus: "ASSIGNED" },
    ],
  },
];

const applicants: SpeedDatingApplicant[] = [
  { applicationId: "app-1", name: "Amélie Jones", scored: false },
  { applicationId: "app-2", name: "Marcus Lee", scored: true },
];

const setupPair = {
  id: "pair-1",
  label: "Group 01",
  session: 1,
  status: "PUBLISHED",
  applicationIds: ["app-1", "app-2"],
  createdBy: "member-1",
  evaluatorName: "Judge One",
  submittedAt: null,
  claimEvaluatorIds: ["member-1"],
};

test("search finds a pair by either applicant name", () => {
  assert.deepEqual(searchSpeedDatingPairs(pairs, "marcus").map((pair) => pair.id), ["pair-1"]);
  assert.deepEqual(searchSpeedDatingPairs(pairs, "Priya").map((pair) => pair.id), ["pair-2"]);
});

test("pair setup validation keeps the Board payload group-shaped", () => {
  const setup = {
    roundId: "round-1",
    roundStatus: "ACTIVE",
    participants: [{ applicationId: "app-1", name: "Alex Kim" }, { applicationId: "app-2", name: "Sam Lee" }],
    pairs: [setupPair],
  };
  assert.equal(isSpeedDatingPairSetup(setup), true);
  assert.equal(isSpeedDatingPairSetup({ ...setup, pairs: [{ ...setupPair, applicationIds: ["app-1", "app-2", "app-3"], submittedAt: "2026-09-13T15:00:00Z" }] }), true);
  assert.equal(isSpeedDatingPairSetup({ ...setup, pairs: [{ ...setupPair, applicationIds: ["app-1"] }] }), false);
  assert.equal(isSpeedDatingPairSetup({ ...setup, pairs: [{ ...setupPair, applicationIds: ["app-1", "app-2", "app-3", "app-4"] }] }), false);
  const { evaluatorName: _evaluatorName, ...withoutEvaluator } = setupPair;
  void _evaluatorName;
  assert.equal(isSpeedDatingPairSetup({ ...setup, pairs: [withoutEvaluator] }), false);
});

test("applicant search matches names the same way pair search does", () => {
  assert.deepEqual(searchSpeedDatingApplicants(applicants, "  AMELIE ").map((applicant) => applicant.applicationId), ["app-1"]);
  assert.deepEqual(searchSpeedDatingApplicants(applicants, "lee").map((applicant) => applicant.applicationId), ["app-2"]);
  assert.deepEqual(searchSpeedDatingApplicants(applicants, " "), []);
});

test("search is case, whitespace, and accent insensitive", () => {
  assert.deepEqual(searchSpeedDatingPairs(pairs, "  AMELIE ").map((pair) => pair.id), ["pair-1"]);
});

test("blank search does not expose a wall of applicant names", () => {
  assert.deepEqual(searchSpeedDatingPairs(pairs, " "), []);
});

test("queue validation requires two or three ordered members", () => {
  const queue = { roundId: "round-1", roundName: "Speed Dating", roundStatus: "ACTIVE", calibrated: true, rubricReady: true, criterion: { id: "criterion-1", name: "Overall", description: "Overall assessment" }, applicants, pairs };
  assert.equal(isSpeedDatingPairQueue(queue), true);
  assert.equal(isSpeedDatingPairQueue({ ...queue, pairs: [{ ...pairs[0], members: [pairs[0].members[0]] }] }), false);
  const fourth = { applicationId: "app-6", name: "Jo Park", position: 4, assignmentId: null, assignmentStatus: null };
  assert.equal(isSpeedDatingPairQueue({ ...queue, pairs: [{ ...pairs[1], members: [...pairs[1].members, fourth] }] }), false);
});

test("queue validation requires the applicant list", () => {
  const queue = { roundId: "round-1", roundName: "Speed Dating", roundStatus: "ACTIVE", calibrated: true, rubricReady: true, criterion: null, pairs: [] };
  assert.equal(isSpeedDatingPairQueue(queue), false);
  assert.equal(isSpeedDatingPairQueue({ ...queue, applicants: [] }), true);
  assert.equal(isSpeedDatingPairQueue({ ...queue, applicants: [{ applicationId: "app-1", name: "Amélie Jones" }] }), false);
});

test("queue and setup validation require a session on every pair", () => {
  const { session: _session, ...pairWithoutSession } = pairs[0];
  void _session;
  const queue = { roundId: "round-1", roundName: "Speed Dating", roundStatus: "ACTIVE", calibrated: true, rubricReady: true, criterion: null, applicants: [], pairs: [pairWithoutSession] };
  assert.equal(isSpeedDatingPairQueue(queue), false);
  assert.equal(isSpeedDatingPairQueue({ ...queue, pairs: [{ ...pairWithoutSession, session: 0 }] }), false);
  assert.equal(isSpeedDatingPairQueue({ ...queue, pairs: [{ ...pairWithoutSession, session: 2 }] }), true);
  assert.equal(isSpeedDatingPairSetup({
    roundId: "round-1",
    roundStatus: "DRAFT",
    participants: [],
    pairs: [{ ...setupPair, session: undefined }],
  }), false);
});

test("pair ratings require two or three distinct applicants and evidence for 1, 2, and 5", () => {
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
  assert.equal(parseSpeedDatingPairRatings([
    { applicationId: "app-1", score: 3, note: "" },
    { applicationId: "app-2", score: 4, note: "" },
    { applicationId: "app-3", score: 3, note: "" },
  ])?.length, 3);
  assert.equal(parseSpeedDatingPairRatings([{ applicationId: "app-1", score: 3, note: "" }]), null);
  assert.equal(parseSpeedDatingPairRatings([
    { applicationId: "app-1", score: 3, note: "" },
    { applicationId: "app-2", score: 4, note: "" },
    { applicationId: "app-3", score: 3, note: "" },
    { applicationId: "app-4", score: 3, note: "" },
  ]), null);
});
