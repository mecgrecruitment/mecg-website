import assert from "node:assert/strict";
import test from "node:test";
import { resolveAuthDestination } from "./auth-destination.ts";

test("internal roles route to their workspaces", () => {
  assert.equal(resolveAuthDestination({ active: true, roles: ["OWNER"], hasApplication: false }), "/admin");
  assert.equal(resolveAuthDestination({ active: true, roles: ["BOARD"], hasApplication: true }), "/admin");
  assert.equal(resolveAuthDestination({ active: true, roles: ["PANEL"], hasApplication: false }), "/admin");
  assert.equal(resolveAuthDestination({ active: true, roles: ["MEMBER"], hasApplication: true }), "/member");
});

test("applicants route according to submission state", () => {
  assert.equal(resolveAuthDestination({ active: true, roles: [], hasApplication: false }), "/apply");
  assert.equal(resolveAuthDestination({ active: true, roles: [], hasApplication: true }), "/applicant");
});

test("internal access takes priority over applicant history", () => {
  assert.equal(resolveAuthDestination({ active: true, roles: ["MEMBER", "BOARD"], hasApplication: true }), "/admin");
});

test("inactive profiles cannot enter a workspace", () => {
  assert.equal(resolveAuthDestination({ active: false, roles: ["OWNER"], hasApplication: true }), "/access-denied");
});
