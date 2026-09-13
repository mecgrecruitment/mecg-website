import test from "node:test";
import assert from "node:assert/strict";
import { isSpeedDatingRoster, matchesApplicantName, type SpeedDatingRoster } from "./speed-dating-roster";

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
