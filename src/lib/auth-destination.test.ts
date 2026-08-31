import assert from "node:assert/strict";
import test from "node:test";
import { resolveAuthDestination, type AccessRole } from "./auth-destination.ts";

const memberships = (...roles: AccessRole[]) => roles.map((role) => ({ role }));

test("internal roles route to their workspaces", () => {
  assert.equal(resolveAuthDestination({ active: true, memberships: memberships("OWNER"), hasApplication: false }), "/admin");
  assert.equal(resolveAuthDestination({ active: true, memberships: memberships("BOARD"), hasApplication: true }), "/admin");
  assert.equal(resolveAuthDestination({ active: true, memberships: memberships("PANEL"), hasApplication: false }), "/admin");
  assert.equal(resolveAuthDestination({ active: true, memberships: memberships("RECRUITMENT_COMMITTEE"), hasApplication: false }), "/admin");
  assert.equal(resolveAuthDestination({ active: true, memberships: memberships("MEMBER"), hasApplication: true }), "/member");
});

test("closed-cycle committee membership does not grant workspace access", () => {
  for (const cycleStatus of ["CLOSED", "ARCHIVED"]) {
    assert.equal(resolveAuthDestination({ active: true, memberships: [{ role: "RECRUITMENT_COMMITTEE", cycleStatus }], hasApplication: false }), "/apply");
    assert.equal(resolveAuthDestination({ active: true, memberships: [{ role: "RECRUITMENT_COMMITTEE", cycleStatus }], hasApplication: true }), "/applicant");
  }
});

test("applicants route according to submission state", () => {
  assert.equal(resolveAuthDestination({ active: true, memberships: [], hasApplication: false }), "/apply");
  assert.equal(resolveAuthDestination({ active: true, memberships: [], hasApplication: true }), "/applicant");
});

test("internal access takes priority over applicant history", () => {
  assert.equal(resolveAuthDestination({ active: true, memberships: memberships("MEMBER", "BOARD"), hasApplication: true }), "/admin");
});

test("inactive profiles cannot enter a workspace", () => {
  assert.equal(resolveAuthDestination({ active: false, memberships: memberships("OWNER"), hasApplication: true }), "/access-denied");
});
