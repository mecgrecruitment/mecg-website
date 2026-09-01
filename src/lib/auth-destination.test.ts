import assert from "node:assert/strict";
import test from "node:test";
import { resolveAuthDestination, type AccessRole } from "./auth-destination.ts";

const memberships = (...roles: AccessRole[]) => roles.map((role) => ({ role }));

test("internal roles route to their workspaces", () => {
  assert.equal(resolveAuthDestination({ active: true, memberships: memberships("OWNER"), hasApplication: false, canStartApplication: false }), "/admin");
  assert.equal(resolveAuthDestination({ active: true, memberships: memberships("BOARD"), hasApplication: true, canStartApplication: false }), "/admin");
  assert.equal(resolveAuthDestination({ active: true, memberships: memberships("PANEL"), hasApplication: false, canStartApplication: false }), "/admin");
  assert.equal(resolveAuthDestination({ active: true, memberships: memberships("RECRUITMENT_COMMITTEE"), hasApplication: false, canStartApplication: false }), "/admin");
  assert.equal(resolveAuthDestination({ active: true, memberships: memberships("MEMBER"), hasApplication: true, canStartApplication: false }), "/member");
});

test("closed-cycle committee membership does not grant workspace access", () => {
  for (const cycleStatus of ["CLOSED", "ARCHIVED"]) {
    assert.equal(resolveAuthDestination({ active: true, memberships: [{ role: "RECRUITMENT_COMMITTEE", cycleStatus }], hasApplication: false, canStartApplication: false }), "/apply");
    assert.equal(resolveAuthDestination({ active: true, memberships: [{ role: "RECRUITMENT_COMMITTEE", cycleStatus }], hasApplication: true, canStartApplication: false }), "/applicant");
  }
});

test("applicants route according to submission state", () => {
  assert.equal(resolveAuthDestination({ active: true, memberships: [], hasApplication: false, canStartApplication: false }), "/apply");
  assert.equal(resolveAuthDestination({ active: true, memberships: [], hasApplication: true, canStartApplication: false }), "/applicant");
});

test("internal access takes priority over applicant history", () => {
  assert.equal(resolveAuthDestination({ active: true, memberships: memberships("MEMBER", "BOARD"), hasApplication: true, canStartApplication: false }), "/admin");
});

test("inactive profiles cannot enter a workspace", () => {
  assert.equal(resolveAuthDestination({ active: false, memberships: memberships("OWNER"), hasApplication: true, canStartApplication: false }), "/access-denied");
});

// The reapplication case. Before can_start_application existed, a past
// application pinned the user to /applicant and /apply redirected them back,
// so a rejected applicant could never apply to a later cycle.
test("a past applicant may start an application in a new open cycle", () => {
  assert.equal(resolveAuthDestination({ active: true, memberships: [], hasApplication: true, canStartApplication: true }), "/apply");
});

test("a first-time applicant with an open cycle goes to apply", () => {
  assert.equal(resolveAuthDestination({ active: true, memberships: [], hasApplication: false, canStartApplication: true }), "/apply");
});

test("a past applicant with no new open cycle keeps their status page", () => {
  assert.equal(resolveAuthDestination({ active: true, memberships: [], hasApplication: true, canStartApplication: false }), "/applicant");
});

test("an applicant already in the open cycle stays on their status page", () => {
  // can_start_application is false once a row exists for the open cycle, so a
  // submitted applicant is not sent back to a blank form mid-cycle.
  assert.equal(resolveAuthDestination({ active: true, memberships: [], hasApplication: true, canStartApplication: false }), "/applicant");
});

test("internal roles outrank an open cycle", () => {
  assert.equal(resolveAuthDestination({ active: true, memberships: memberships("MEMBER"), hasApplication: true, canStartApplication: true }), "/member");
  assert.equal(resolveAuthDestination({ active: true, memberships: memberships("BOARD"), hasApplication: true, canStartApplication: true }), "/admin");
});

test("inactive profiles are denied even with an open cycle", () => {
  assert.equal(resolveAuthDestination({ active: false, memberships: [], hasApplication: true, canStartApplication: true }), "/access-denied");
});
