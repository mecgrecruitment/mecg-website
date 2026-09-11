import { hasPermission } from "@/lib/authorization";
import type { CurrentUser } from "@/lib/auth";
import { loadWorkspaceContext } from "@/lib/workspace-context";
import { workspaceAdminTools, workspaceMemberTools, type WorkspaceNavLink } from "@/lib/workspace-navigation";
import PillNav from "./pill-nav";
import WorkspaceMoreMenu from "./workspace-more-menu";

// One nav for the whole internal workspace. Before this, /admin had BoardNav,
// /member hand-rolled its own link array, and every sub-page had neither: you
// landed on Case teams or Live event and your only way out was a single "back"
// button. Board members also carried two mental models because the two trees
// advertised each other with cross-link buttons instead of shared nav.
//
// Capability gating lives here so a page never has to reason about which links
// a role may see.
//
// Labels are plain English on purpose. "Pipeline", "Blind screening",
// "Delivery" and "Audit log" were internal names that meant nothing to a member
// on their first day; the routes behind them are unchanged.
export default async function WorkspaceNav({
  user,
  cycleId,
  current,
}: {
  user: CurrentUser;
  cycleId: string;
  current: string;
}) {
  // One cycle-bound contract keeps live navigation state consistent and avoids
  // repeating independent screening, grading-event, and round queries on every
  // internal page. Safe defaults preserve role-based navigation if it fails.
  const { data: workspaceContext } = await loadWorkspaceContext(cycleId);
  const currentContext = workspaceContext?.cycleId === cycleId ? workspaceContext : null;
  const isScreeningReviewer = currentContext?.isScreeningReviewer ?? false;
  const openScreening = currentContext?.openScreeningCount ?? 0;
  const hasGradingEvent = currentContext?.hasGradingEvent ?? false;
  const hasSpeedDatingRound = currentContext?.hasSpeedDatingRound ?? false;
  const hasGroupCaseWork = currentContext?.hasGroupCaseWork ?? false;

  const can = (permission: Parameters<typeof hasPermission>[2]) => hasPermission(user.memberships, cycleId, permission);
  // Every member votes once the cycle reaches decision lock, so the link is
  // driven by cycle state rather than by role.
  const votingOpen = user.memberships.some((membership) =>
    membership.active && membership.cycleId === cycleId && membership.cycle.status === "DECISION_LOCK");
  const isBoard = user.memberships.some((membership) =>
    membership.active && ["BOARD", "OWNER"].includes(membership.role));
  const isOwner = user.memberships.some((membership) =>
    membership.active && membership.role === "OWNER");

  const primary: WorkspaceNavLink[] = [
    ["/member", `My work${currentContext?.openTaskCount ? ` · ${currentContext.openTaskCount}` : ""}`],
    ...(can("RECRUITMENT_OPERATIONS")
      ? ([
        ["/admin", "Recruitment"],
        ["/admin/screening", "Application review"],
        ["/admin/rounds", "Interviews"],
      ] as const)
      : []),
    ...(!can("RECRUITMENT_OPERATIONS") && can("HASH_PANEL_ACCESS") ? [["/admin", "Overview"] as const] : []),
    ...(can("HASH_PANEL_ACCESS") ? [["/admin/hash", "Decisions"] as const] : []),
    ...(can("RECRUITMENT_OPERATIONS") ? [["/admin/messages", "Communications"] as const] : []),
  ];

  const myTools = workspaceMemberTools({
    hasSpeedDatingRound,
    hasGroupCaseWork,
    votingOpen,
    isScreeningReviewer,
    openScreeningCount: openScreening,
    hasGradingEvent,
  });

  const adminTools = workspaceAdminTools({
    canRecruitmentOperations: can("RECRUITMENT_OPERATIONS"),
    canManageCycle: can("MANAGE_CYCLE"),
    isBoard,
    isOwner,
  });
  return (
    <>
      <div className="workspace-nav-shell sticky top-3 z-30 flex items-center gap-1 rounded-2xl bg-white/92 p-1.5 shadow-[0_10px_30px_rgba(7,13,31,0.08),inset_0_0_0_1px_rgba(7,13,31,0.08)] backdrop-blur-xl">
        <div className="min-w-0 flex-1">
          <PillNav ariaLabel="Workspace" current={current} links={primary} matchPathOnly />
        </div>
        <WorkspaceMoreMenu current={current} myTools={myTools} adminTools={adminTools} />
      </div>
      <span id="workspace-content" tabIndex={-1} className="sr-only">Workspace content</span>
    </>
  );
}
