import test from "node:test";
import assert from "node:assert/strict";
import { selectAuthorizedCycleId } from "./cycles.ts";

const memberships = [
  { cycleId: "older", role: "BOARD", active: true, cycle: { createdAt: new Date("2026-01-01") } },
  { cycleId: "newer", role: "MEMBER", active: true, cycle: { createdAt: new Date("2026-02-01") } },
  { cycleId: "committee", role: "RECRUITMENT_COMMITTEE", active: true, cycle: { createdAt: new Date("2026-03-01") } },
];

test("cycle selection chooses the newest cycle authorized for the action", () => {
  assert.equal(selectAuthorizedCycleId(memberships, "MANAGE_CYCLE"), "older");
  assert.equal(selectAuthorizedCycleId(memberships, "WORKSPACE_ACCESS"), "committee");
  assert.equal(selectAuthorizedCycleId(memberships, "RECRUITMENT_OPERATIONS"), "committee");
});

test("an explicitly requested unauthorized cycle is rejected", () => {
  assert.equal(selectAuthorizedCycleId(memberships, "MANAGE_CYCLE", "newer"), null);
  assert.equal(selectAuthorizedCycleId(memberships, "MANAGE_CYCLE", "older"), "older");
});
