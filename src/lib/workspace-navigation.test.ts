import assert from "node:assert/strict";
import test from "node:test";
import { secondaryDestinationLabel, workspaceAdminTools, workspaceMemberTools } from "./workspace-navigation";

test("live member tools expose screening, voting, and event tasks with the open count", () => {
  assert.deepEqual(workspaceMemberTools({
    hasSpeedDatingRound: false,
    hasGroupCaseWork: true,
    votingOpen: true,
    isScreeningReviewer: true,
    openScreeningCount: 3,
    hasGradingEvent: true,
  }), [
    ["/member?round=GROUP_CASE", "Group Case"],
    ["/member/hash", "Hash vote"],
    ["/member/screening", "Read applications · 3"],
    ["/member/event", "Live event"],
    ["/member/refer", "Refer someone"],
    ["/admin/people", "People"],
  ]);
});

test("Speed Dating appears for an eligible member without screening access", () => {
  assert.deepEqual(workspaceMemberTools({
    hasSpeedDatingRound: true,
    hasGroupCaseWork: false,
    votingOpen: false,
    isScreeningReviewer: false,
    openScreeningCount: 0,
    hasGradingEvent: false,
  }), [
    ["/member/speed-dating", "Speed Dating"],
    ["/member/refer", "Refer someone"],
    ["/admin/people", "People"],
  ]);
});

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
