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

// Hash pages derive "panelOnly" as HASH_PANEL_ACCESS without MANAGE_CYCLE or
// RECRUITMENT_OPERATIONS (src/app/admin/hash/page.tsx, hash/deliberate/page.tsx,
// applications/[id]/page.tsx). Only that combination should ever see an applicant
// code and hidden evaluator identity instead of the real dossier.
function panelOnly(role: string) {
  const memberships = [membership(role)];
  return (
    hasPermission(memberships, "cycle", "HASH_PANEL_ACCESS")
    && !hasPermission(memberships, "cycle", "MANAGE_CYCLE")
    && !hasPermission(memberships, "cycle", "RECRUITMENT_OPERATIONS")
  );
}

test("only a bare PANEL membership is treated as panel-only for blind Hash review", () => {
  assert.equal(panelOnly("PANEL"), true);
  assert.equal(panelOnly("BOARD"), false);
  assert.equal(panelOnly("OWNER"), false);
  assert.equal(panelOnly("RECRUITMENT_COMMITTEE"), false);
  assert.equal(panelOnly("MEMBER"), false);
});
