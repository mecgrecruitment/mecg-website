import test from "node:test";
import assert from "node:assert/strict";
import { assessMember, DEFAULT_THRESHOLDS, parseStanding, parseThresholdInput, sortForReview, summarize, type StandingMember } from "./model";

const member = (overrides: Partial<StandingMember> = {}): StandingMember => ({
  userId: "00000000-0000-4000-8000-000000000001",
  name: "Avery",
  roles: ["MEMBER"],
  eventsAttended: 3,
  eventsHeld: 4,
  projects: 1,
  onboardingDone: 5,
  onboardingTotal: 5,
  ...overrides,
});

test("a member meeting every threshold is active", () => {
  assert.deepEqual(assessMember(member(), DEFAULT_THRESHOLDS), { status: "ACTIVE", reasons: [], attendancePct: 75 });
});

test("each missed threshold is a separate reason", () => {
  const result = assessMember(member({ eventsAttended: 1, projects: 0, onboardingDone: 2 }), DEFAULT_THRESHOLDS);
  assert.equal(result.status, "AT_RISK");
  assert.deepEqual(result.reasons, ["ATTENDANCE", "PROJECTS", "ONBOARDING"]);
  assert.equal(result.attendancePct, 25);
});

test("attendance exactly at the threshold passes", () => {
  assert.equal(assessMember(member({ eventsAttended: 2, eventsHeld: 4 }), DEFAULT_THRESHOLDS).status, "ACTIVE");
});

test("attendance is not judged before any event has been held", () => {
  const result = assessMember(member({ eventsAttended: 0, eventsHeld: 0 }), DEFAULT_THRESHOLDS);
  assert.deepEqual(result, { status: "ACTIVE", reasons: [], attendancePct: null });
});

test("members with no onboarding record are not flagged for onboarding", () => {
  const result = assessMember(member({ onboardingDone: null, onboardingTotal: null }), DEFAULT_THRESHOLDS);
  assert.equal(result.status, "ACTIVE");
});

test("thresholds set to zero or off never flag", () => {
  const off = { ...DEFAULT_THRESHOLDS, minAttendancePct: 0, minProjects: 0, requireOnboarding: false };
  assert.equal(assessMember(member({ eventsAttended: 0, projects: 0, onboardingDone: 0 }), off).status, "ACTIVE");
});

test("review order puts at-risk members first, then by name", () => {
  const rows = [member({ name: "Zed" }), member({ name: "Bea", projects: 0 }), member({ name: "Amy" })];
  assert.deepEqual(sortForReview(rows, DEFAULT_THRESHOLDS).map((row) => row.name), ["Bea", "Amy", "Zed"]);
});

test("summary counts active, at-risk and each reason", () => {
  const rows = [member(), member({ projects: 0 }), member({ projects: 0, eventsAttended: 0 })];
  assert.deepEqual(summarize(rows, DEFAULT_THRESHOLDS), { total: 3, active: 1, atRisk: 2, reasons: { ATTENDANCE: 1, PROJECTS: 2, ONBOARDING: 0 } });
});

const payload = {
  cycleId: "fall",
  thresholds: { minAttendancePct: 60, minProjects: 0, requireOnboarding: false, revision: 2, updatedAt: "2026-11-18T07:00:00Z", configured: true },
  members: [{ userId: member().userId, name: "Avery", roles: ["MEMBER", "BOARD"], eventsAttended: 1, eventsHeld: 2, projects: 0, onboardingDone: null, onboardingTotal: null }],
};

test("a well-formed payload parses", () => {
  const parsed = parseStanding(payload);
  assert.ok(parsed);
  assert.equal(parsed.thresholds.minAttendancePct, 60);
  assert.equal(parsed.thresholds.configured, true);
  assert.equal(parsed.members[0]?.onboardingTotal, null);
});

test("malformed payloads are refused instead of rendering partial data", () => {
  for (const bad of [
    null,
    [],
    { ...payload, members: "x" },
    { ...payload, thresholds: { ...payload.thresholds, minAttendancePct: 120 } },
    { ...payload, members: [{ ...payload.members[0], eventsAttended: 3, eventsHeld: 2 }] },
    { ...payload, members: [{ ...payload.members[0], onboardingDone: 1, onboardingTotal: null }] },
    { ...payload, members: [{ ...payload.members[0], name: 7 }] },
    { ...payload, members: [{ ...payload.members[0], projects: -1 }] },
  ]) assert.equal(parseStanding(bad), null, JSON.stringify(bad));
});

test("threshold input is validated and normalised", () => {
  assert.deepEqual(parseThresholdInput({ minAttendancePct: 50, minProjects: 1, requireOnboarding: true }), {
    ok: true, value: { minAttendancePct: 50, minProjects: 1, requireOnboarding: true },
  });
  for (const bad of [
    { minAttendancePct: 101, minProjects: 1, requireOnboarding: true },
    { minAttendancePct: 50.5, minProjects: 1, requireOnboarding: true },
    { minAttendancePct: 50, minProjects: 11, requireOnboarding: true },
    { minAttendancePct: 50, minProjects: 1, requireOnboarding: "yes" },
    { minAttendancePct: 50, minProjects: 1, requireOnboarding: true, extra: 1 },
    "x",
  ]) assert.equal(parseThresholdInput(bad).ok, false, JSON.stringify(bad));
});
