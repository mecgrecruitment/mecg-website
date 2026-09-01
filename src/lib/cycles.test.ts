import test from "node:test";
import assert from "node:assert/strict";
import { selectAuthorizedCycleId } from "./cycles.ts";

const memberships = [
  { cycleId: "older", role: "BOARD", active: true, cycle: { status: "OPEN" as const, createdAt: new Date("2026-01-01") } },
  { cycleId: "newer", role: "MEMBER", active: true, cycle: { status: "DRAFT" as const, createdAt: new Date("2026-02-01") } },
  { cycleId: "committee", role: "RECRUITMENT_COMMITTEE", active: true, cycle: { status: "OPEN" as const, createdAt: new Date("2026-03-01") } },
];

test("cycle selection chooses the highest-priority authorized cycle", () => {
  assert.equal(selectAuthorizedCycleId(memberships, "MANAGE_CYCLE"), "older");
  assert.equal(selectAuthorizedCycleId(memberships, "WORKSPACE_ACCESS"), "committee");
  assert.equal(selectAuthorizedCycleId(memberships, "RECRUITMENT_OPERATIONS"), "committee");
});

test("cycle selection never lets a newer draft hide a live cycle", () => {
  const ownerMemberships = [
    { cycleId: "live", role: "OWNER", active: true, cycle: { status: "IN_PROCESS" as const, createdAt: new Date("2026-01-01") } },
    { cycleId: "draft", role: "OWNER", active: true, cycle: { status: "DRAFT" as const, createdAt: new Date("2026-09-01") } },
  ];

  assert.equal(selectAuthorizedCycleId(ownerMemberships, "MANAGE_CYCLE"), "live");
  assert.equal(selectAuthorizedCycleId(ownerMemberships, "MANAGE_CYCLE", "draft"), "draft");
});

test("cycle selection uses recency only to break a status tie", () => {
  const closedMemberships = [
    { cycleId: "older", role: "OWNER", active: true, cycle: { status: "CLOSED" as const, createdAt: new Date("2025-01-01") } },
    { cycleId: "newer", role: "OWNER", active: true, cycle: { status: "CLOSED" as const, createdAt: new Date("2026-01-01") } },
  ];

  assert.equal(selectAuthorizedCycleId(closedMemberships, "MANAGE_CYCLE"), "newer");
});

test("an explicitly requested unauthorized cycle is rejected", () => {
  assert.equal(selectAuthorizedCycleId(memberships, "MANAGE_CYCLE", "newer"), null);
  assert.equal(selectAuthorizedCycleId(memberships, "MANAGE_CYCLE", "older"), "older");
});
