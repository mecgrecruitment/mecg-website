import assert from "node:assert/strict";
import test from "node:test";
import { hasEditableIntakeApplication, resolveAuthDestination, type AccessRole } from "./auth-destination.ts";

const memberships = (...roles: AccessRole[]) => roles.map((role) => ({ role }));

test("internal roles route to their workspaces", () => {
  assert.equal(resolveAuthDestination({ active: true, memberships: memberships("OWNER"), hasApplication: false, canStartApplication: false, hasEditableApplication: false }), "/admin");
  assert.equal(resolveAuthDestination({ active: true, memberships: memberships("BOARD"), hasApplication: true, canStartApplication: false, hasEditableApplication: false }), "/admin");
  assert.equal(resolveAuthDestination({ active: true, memberships: memberships("PANEL"), hasApplication: false, canStartApplication: false, hasEditableApplication: false }), "/admin");
  assert.equal(resolveAuthDestination({ active: true, memberships: memberships("RECRUITMENT_COMMITTEE"), hasApplication: false, canStartApplication: false, hasEditableApplication: false }), "/admin");
  assert.equal(resolveAuthDestination({ active: true, memberships: memberships("MEMBER"), hasApplication: true, canStartApplication: false, hasEditableApplication: false }), "/member");
});

test("closed-cycle committee membership does not grant workspace access", () => {
  for (const cycleStatus of ["CLOSED", "ARCHIVED"]) {
    assert.equal(resolveAuthDestination({ active: true, memberships: [{ role: "RECRUITMENT_COMMITTEE", cycleStatus }], hasApplication: false, canStartApplication: false, hasEditableApplication: false }), "/apply");
    assert.equal(resolveAuthDestination({ active: true, memberships: [{ role: "RECRUITMENT_COMMITTEE", cycleStatus }], hasApplication: true, canStartApplication: false, hasEditableApplication: false }), "/applicant");
  }
});

test("applicants route according to submission state", () => {
  assert.equal(resolveAuthDestination({ active: true, memberships: [], hasApplication: false, canStartApplication: false, hasEditableApplication: false }), "/apply");
  assert.equal(resolveAuthDestination({ active: true, memberships: [], hasApplication: true, canStartApplication: false, hasEditableApplication: false }), "/applicant");
});

test("internal access takes priority over applicant history", () => {
  assert.equal(resolveAuthDestination({ active: true, memberships: memberships("MEMBER", "BOARD"), hasApplication: true, canStartApplication: false, hasEditableApplication: false }), "/admin");
});

test("inactive profiles cannot enter a workspace", () => {
  assert.equal(resolveAuthDestination({ active: false, memberships: memberships("OWNER"), hasApplication: true, canStartApplication: false, hasEditableApplication: false }), "/access-denied");
});

// The reapplication case. Before can_start_application existed, a past
// application pinned the user to /applicant and /apply redirected them back,
// so a rejected applicant could never apply to a later cycle.
test("a past applicant may start an application in a new open cycle", () => {
  assert.equal(resolveAuthDestination({ active: true, memberships: [], hasApplication: true, canStartApplication: true, hasEditableApplication: false }), "/apply");
});

test("a first-time applicant with an open cycle goes to apply", () => {
  assert.equal(resolveAuthDestination({ active: true, memberships: [], hasApplication: false, canStartApplication: true, hasEditableApplication: false }), "/apply");
});

test("a past applicant with no new open cycle keeps their status page", () => {
  assert.equal(resolveAuthDestination({ active: true, memberships: [], hasApplication: true, canStartApplication: false, hasEditableApplication: false }), "/applicant");
});

test("an applicant already in the open cycle stays on their status page", () => {
  // can_start_application is false once a row exists for the open cycle, so a
  // submitted applicant is not sent back to a blank form mid-cycle.
  assert.equal(resolveAuthDestination({ active: true, memberships: [], hasApplication: true, canStartApplication: false, hasEditableApplication: false }), "/applicant");
});

test("internal roles outrank an open cycle", () => {
  assert.equal(resolveAuthDestination({ active: true, memberships: memberships("MEMBER"), hasApplication: true, canStartApplication: true, hasEditableApplication: false }), "/member");
  assert.equal(resolveAuthDestination({ active: true, memberships: memberships("BOARD"), hasApplication: true, canStartApplication: true, hasEditableApplication: false }), "/admin");
});

test("inactive profiles are denied even with an open cycle", () => {
  assert.equal(resolveAuthDestination({ active: false, memberships: [], hasApplication: true, canStartApplication: true, hasEditableApplication: false }), "/access-denied");
});

for (const status of ["DRAFT", "NEEDS_INFO"]) {
  test(`a returning applicant can resume current-cycle ${status} work`, () => {
    const input = { active: true, memberships: [], hasApplication: true, canStartApplication: false };
    const intake = { open: true, cycleId: "new-cycle", draft: { revision: "saved-revision" }, needsInfo: status === "NEEDS_INFO" };
    assert.equal(resolveAuthDestination({ ...input, hasEditableApplication: hasEditableIntakeApplication(intake) }), "/apply");
    assert.equal(resolveAuthDestination({ ...input, hasEditableApplication: hasEditableIntakeApplication({ ...intake, draft: null }) }), "/applicant");
    assert.equal(resolveAuthDestination({ ...input, memberships: memberships("MEMBER"), hasEditableApplication: true }), "/member");
  });
}
test("editable intake capability rejects closed or malformed boundary data", () => {
  for (const value of [null, [], {}, { open: false, cycleId: "new", draft: {} }, { open: true, cycleId: null, draft: {} }, { open: true, cycleId: "new", draft: [] }]) assert.equal(hasEditableIntakeApplication(value), false);
});
