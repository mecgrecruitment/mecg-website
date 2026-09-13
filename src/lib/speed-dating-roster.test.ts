import test from "node:test";
import assert from "node:assert/strict";
import { compareResults, isSpeedDatingRoster, matchesApplicantName, matchesNote, type SpeedDatingRoster } from "./speed-dating-roster";

const roster: SpeedDatingRoster = {
  roundId: "round-1",
  roundName: "Speed Dating",
  roundStatus: "ACTIVE",
  criterion: { id: "crit-1", name: "Fit", description: "Overall impression" },
  rubricReady: true,
  progress: { scored: 1, total: 2 },
  applicants: [
    { applicationId: "app-1", name: "Amélie Jones", score: 4, note: "Sharp", session: 1, savedAt: "2026-09-13T20:00:00Z" },
    { applicationId: "app-2", name: "Marcus Lee", score: null, note: "", session: null, savedAt: null },
  ],
};

test("isSpeedDatingRoster accepts the RPC shape", () => {
  assert.equal(isSpeedDatingRoster(roster), true);
  assert.equal(isSpeedDatingRoster({ ...roster, criterion: null }), true);
});

test("isSpeedDatingRoster rejects malformed applicants and statuses", () => {
  assert.equal(isSpeedDatingRoster({ ...roster, roundStatus: "OPEN" }), false);
  assert.equal(isSpeedDatingRoster({ ...roster, applicants: [{ ...roster.applicants[0], score: 6 }] }), false);
  assert.equal(isSpeedDatingRoster({ ...roster, applicants: [{ ...roster.applicants[0], note: null }] }), false);
  assert.equal(isSpeedDatingRoster({ ...roster, progress: { scored: "1", total: 2 } }), false);
  assert.equal(isSpeedDatingRoster(null), false);
});

test("matchesApplicantName ignores diacritics and case, and matches everyone on an empty query", () => {
  assert.equal(matchesApplicantName("Amélie Jones", "amelie"), true);
  assert.equal(matchesApplicantName("Amelie Jones", "AMÉLIE"), true);
  assert.equal(matchesApplicantName("Marcus Lee", "  lee "), true);
  assert.equal(matchesApplicantName("Marcus Lee", "shah"), false);
  assert.equal(matchesApplicantName("Marcus Lee", ""), true);
});

test("matchesNote is a case-insensitive includes that never matches an empty query", () => {
  assert.equal(matchesNote("Great listener, sharp follow-ups", "SHARP"), true);
  assert.equal(matchesNote("Great listener", "quiet"), false);
  assert.equal(matchesNote("Great listener", "  "), false);
});

test("compareResults keeps ungraded rows last and nulls after values in either direction", () => {
  const rows = [
    { name: "Ungraded", count: 0, adjusted: null, mean: null, stddev: null },
    { name: "Low", count: 9, adjusted: 2.4, mean: 2.5, stddev: 0.5 },
    { name: "High", count: 12, adjusted: 4.1, mean: 4, stddev: 0.8 },
    { name: "Pending", count: 3, adjusted: null, mean: 3, stddev: null },
  ];
  const names = (key: "adjusted" | "mean" | "count" | "stddev", direction: "desc" | "asc") =>
    [...rows].sort((a, b) => compareResults(a, b, key, direction)).map((row) => row.name);
  assert.deepEqual(names("adjusted", "desc"), ["High", "Low", "Pending", "Ungraded"]);
  assert.deepEqual(names("adjusted", "asc"), ["Low", "High", "Pending", "Ungraded"]);
  assert.deepEqual(names("count", "asc"), ["Pending", "Low", "High", "Ungraded"]);
});
