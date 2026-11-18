import test from "node:test";
import assert from "node:assert/strict";
import {
  loadSignal, matchesSkill, parseAvailabilityInput, parseMyAvailability, parsePlan, parseSkillsText, sortForPlanning, summarizePlan,
  type PlanMember,
} from "./model";

const member = (overrides: Partial<PlanMember> = {}): PlanMember => ({
  userId: "00000000-0000-4000-8000-000000000001",
  name: "Avery",
  roles: ["MEMBER"],
  staffedProjectIds: [],
  submitted: true,
  weeklyHours: 6,
  skills: ["Excel"],
  preferredProjectIds: [],
  notes: "",
  revision: 1,
  updatedAt: "2026-11-18T09:00:00Z",
  ...overrides,
});

test("skills text splits on commas and new lines, trims and drops case-insensitive repeats", () => {
  assert.deepEqual(parseSkillsText(" Excel, modeling\nSQL,,excel , "), ["Excel", "modeling", "SQL"]);
  assert.deepEqual(parseSkillsText(""), []);
});

test("availability input is validated", () => {
  assert.deepEqual(parseAvailabilityInput({ weeklyHours: 8, skills: ["Excel"], preferredProjectIds: ["p1"], notes: " Free Fridays " }), {
    ok: true, value: { weeklyHours: 8, skills: ["Excel"], preferredProjectIds: ["p1"], notes: "Free Fridays" },
  });
  for (const bad of [
    { weeklyHours: 41, skills: [], preferredProjectIds: [], notes: "" },
    { weeklyHours: 2.5, skills: [], preferredProjectIds: [], notes: "" },
    { weeklyHours: 4, skills: Array.from({ length: 13 }, (_, i) => `s${i}`), preferredProjectIds: [], notes: "" },
    { weeklyHours: 4, skills: ["x".repeat(41)], preferredProjectIds: [], notes: "" },
    { weeklyHours: 4, skills: [" "], preferredProjectIds: [], notes: "" },
    { weeklyHours: 4, skills: ["Excel", "excel"], preferredProjectIds: [], notes: "" },
    { weeklyHours: 4, skills: [], preferredProjectIds: ["a", "b", "c", "d"], notes: "" },
    { weeklyHours: 4, skills: [], preferredProjectIds: ["a", "a"], notes: "" },
    { weeklyHours: 4, skills: [], preferredProjectIds: [""], notes: "" },
    { weeklyHours: 4, skills: [], preferredProjectIds: [], notes: "x".repeat(501) },
    { weeklyHours: 4, skills: [], preferredProjectIds: [], notes: "", extra: 1 },
    { weeklyHours: 4, skills: [], preferredProjectIds: [] },
    [],
    null,
  ]) assert.equal(parseAvailabilityInput(bad).ok, false, JSON.stringify(bad));
});

test("load signals name what the board needs to know", () => {
  assert.equal(loadSignal(member({ submitted: false, weeklyHours: null })), "NOT_SUBMITTED");
  assert.equal(loadSignal(member({ weeklyHours: 6, staffedProjectIds: [] })), "OPEN");
  assert.equal(loadSignal(member({ weeklyHours: 0, staffedProjectIds: [] })), "UNAVAILABLE");
  assert.equal(loadSignal(member({ weeklyHours: 0, staffedProjectIds: ["p1"] })), "OVER");
  assert.equal(loadSignal(member({ weeklyHours: 6, staffedProjectIds: ["p1"] })), "STAFFED");
});

test("planning order: open, staffed, no hours, not submitted; then fewer projects, more hours, name", () => {
  const rows = [
    member({ name: "Eve", weeklyHours: 0 }),
    member({ name: "Fay", weeklyHours: 2, staffedProjectIds: ["p1", "p2"] }),
    member({ name: "Zed", submitted: false, weeklyHours: null }),
    member({ name: "Bea", weeklyHours: 4, staffedProjectIds: ["p1"] }),
    member({ name: "Cal", weeklyHours: 10 }),
    member({ name: "Amy", weeklyHours: 4 }),
    member({ name: "Dee", weeklyHours: 10 }),
  ];
  assert.deepEqual(sortForPlanning(rows).map((row) => row.name), ["Cal", "Dee", "Amy", "Bea", "Fay", "Eve", "Zed"]);
});

test("summary counts submissions, hours and open members", () => {
  assert.deepEqual(summarizePlan([
    member({ weeklyHours: 6 }),
    member({ weeklyHours: 4, staffedProjectIds: ["p1"] }),
    member({ submitted: false, weeklyHours: null }),
  ]), { members: 3, submitted: 2, hours: 10, open: 1 });
});

test("skill filter matches case-insensitively on part of a skill", () => {
  assert.equal(matchesSkill(member({ skills: ["Financial modeling"] }), "model"), true);
  assert.equal(matchesSkill(member({ skills: ["Excel"] }), "sql"), false);
  assert.equal(matchesSkill(member({ skills: [] }), ""), true);
});

const availability = { submitted: true, weeklyHours: 8, skills: ["Excel"], preferredProjectIds: ["p1"], notes: "", revision: 1, updatedAt: "2026-11-18T09:00:00Z" };
const empty = { submitted: false, weeklyHours: null, skills: [], preferredProjectIds: [], notes: "", revision: 0, updatedAt: null };

test("a member's own availability parses, including nothing submitted", () => {
  assert.deepEqual(parseMyAvailability({ cycleId: "fall", ...availability }), { cycleId: "fall", ...availability });
  assert.deepEqual(parseMyAvailability({ cycleId: "fall", ...empty }), { cycleId: "fall", ...empty });
  for (const bad of [
    null,
    { ...availability },
    { cycleId: "fall", ...availability, weeklyHours: null },
    { cycleId: "fall", ...empty, weeklyHours: 3 },
    { cycleId: "fall", ...availability, revision: 0 },
    { cycleId: "fall", ...availability, skills: [1] },
  ]) assert.equal(parseMyAvailability(bad), null, JSON.stringify(bad));
});

test("the board plan parses and refuses malformed payloads", () => {
  const plan = {
    cycleId: "fall",
    projects: [{ id: "p1", title: "Pricing study", semester: "Fall 2026", staffCount: 1 }],
    members: [{ userId: "u1", name: "Avery", roles: ["MEMBER"], staffedProjectIds: ["p1"], ...availability }],
  };
  assert.equal(parsePlan(plan)?.members[0]?.weeklyHours, 8);
  for (const bad of [
    null,
    { ...plan, projects: "x" },
    { ...plan, projects: [{ id: "p1", title: 3, semester: "", staffCount: 0 }] },
    { ...plan, members: [{ ...plan.members[0], staffedProjectIds: "p1" }] },
    { ...plan, members: [{ ...plan.members[0], name: null }] },
  ]) assert.equal(parsePlan(bad), null, JSON.stringify(bad));
});
