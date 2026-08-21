import test from "node:test";
import assert from "node:assert/strict";
import { hasPermission } from "./authorization.ts";

const membership = (role: string, cycleId = "cycle") => ({ role, cycleId, active: true });

test("all active chapter roles can open required workspaces", () => {
  for (const role of ["MEMBER", "BOARD", "PANEL", "OWNER"]) {
    assert.equal(hasPermission([membership(role)], "cycle", "WORKSPACE_ACCESS"), true);
  }
});

test("Hash panel access is separate from Member and Board operations", () => {
  assert.equal(hasPermission([membership("MEMBER")], "cycle", "HASH_PANEL_ACCESS"), false);
  assert.equal(hasPermission([membership("BOARD")], "cycle", "HASH_PANEL_ACCESS"), false);
  assert.equal(hasPermission([membership("PANEL")], "cycle", "HASH_PANEL_ACCESS"), true);
});

test("permissions are cycle-scoped and ignore inactive memberships", () => {
  assert.equal(hasPermission([membership("BOARD", "old")], "cycle", "MANAGE_CYCLE"), false);
  assert.equal(hasPermission([{ ...membership("BOARD"), active: false }], "cycle", "MANAGE_CYCLE"), false);
});
