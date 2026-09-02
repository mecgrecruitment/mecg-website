import assert from "node:assert/strict";
import test from "node:test";
import { secondaryDestinationLabel, workspaceAdminTools } from "./workspace-navigation";

test("recruitment operators can discover setup and activity without receiving Board tools", () => {
  assert.deepEqual(workspaceAdminTools({
    canRecruitmentOperations: true,
    canManageCycle: false,
    isBoard: false,
    isOwner: false,
  }), [
    ["/admin/screening", "Review setup"],
    ["/admin/audit", "Activity"],
  ]);
});

test("owners receive every administrative destination", () => {
  assert.deepEqual(workspaceAdminTools({
    canRecruitmentOperations: true,
    canManageCycle: true,
    isBoard: true,
    isOwner: true,
  }), [
    ["/admin/screening", "Review setup"],
    ["/admin/audit", "Activity"],
    ["/admin/projects", "Projects"],
    ["/admin/settings", "Settings"],
    ["/admin/operations", "Operations"],
  ]);
});

test("the secondary navigation trigger names the current destination", () => {
  assert.equal(
    secondaryDestinationLabel("/admin/projects?cycle=fall", [["/admin/projects", "Projects"]]),
    "Projects",
  );
  assert.equal(secondaryDestinationLabel("/admin", [["/admin/projects", "Projects"]]), undefined);
});
