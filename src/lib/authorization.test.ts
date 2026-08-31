import test from "node:test";
import assert from "node:assert/strict";
import { hasPermission, type Permission } from "./authorization.ts";

const membership = (role: string, cycleId = "cycle") => ({ role, cycleId, active: true });

const permissions: Permission[] = [
  "WORKSPACE_ACCESS",
  "RECRUITMENT_OPERATIONS",
  "MANAGE_CYCLE",
  "MANAGE_MEMBERSHIPS",
  "HASH_PANEL_ACCESS",
  "DECIDE",
  "RELEASE",
  "EXPORT",
];

const expected: Record<string, Permission[]> = {
  MEMBER: ["WORKSPACE_ACCESS"],
  BOARD: ["WORKSPACE_ACCESS", "RECRUITMENT_OPERATIONS", "MANAGE_CYCLE", "EXPORT"],
  PANEL: ["WORKSPACE_ACCESS", "HASH_PANEL_ACCESS", "DECIDE", "RELEASE"],
  OWNER: permissions,
  RECRUITMENT_COMMITTEE: ["WORKSPACE_ACCESS", "RECRUITMENT_OPERATIONS"],
};

test("roles receive only their explicit permissions", () => {
  for (const [role, allowed] of Object.entries(expected)) {
    for (const permission of permissions) {
      assert.equal(hasPermission([membership(role)], "cycle", permission), allowed.includes(permission), `${role} ${permission}`);
    }
  }
});

test("unknown roles and permissions fail closed", () => {
  assert.equal(hasPermission([membership("UNKNOWN")], "cycle", "WORKSPACE_ACCESS"), false);
  assert.equal(hasPermission([membership("OWNER")], "cycle", "UNKNOWN" as Permission), false);
});

test("permissions are cycle-scoped and ignore inactive memberships", () => {
  assert.equal(hasPermission([membership("BOARD", "old")], "cycle", "MANAGE_CYCLE"), false);
  assert.equal(hasPermission([{ ...membership("BOARD"), active: false }], "cycle", "MANAGE_CYCLE"), false);
});

test("committee access ends when its cycle closes", () => {
  for (const status of ["CLOSED", "ARCHIVED"]) {
    const committee = [{ ...membership("RECRUITMENT_COMMITTEE"), cycle: { status } }];
    assert.equal(hasPermission(committee, "cycle", "WORKSPACE_ACCESS"), false);
    assert.equal(hasPermission(committee, "cycle", "RECRUITMENT_OPERATIONS"), false);
  }
  assert.equal(hasPermission([{ ...membership("RECRUITMENT_COMMITTEE"), cycle: { status: "IN_PROCESS" } }], "cycle", "WORKSPACE_ACCESS"), true);
  assert.equal(hasPermission([{ ...membership("RECRUITMENT_COMMITTEE"), cycle: { status: "IN_PROCESS" } }], "cycle", "RECRUITMENT_OPERATIONS"), true);
});

test("closed cycles preserve board and owner recruitment operations", () => {
  for (const role of ["BOARD", "OWNER"]) {
    assert.equal(hasPermission([{ ...membership(role), cycle: { status: "CLOSED" } }], "cycle", "RECRUITMENT_OPERATIONS"), true);
  }
});
