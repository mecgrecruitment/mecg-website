import { notFound } from "next/navigation";
import { requestedWorkspaceCycleId } from "@/lib/workspace-cycle";
import { hasPermission } from "@/lib/authorization";
import { canVoteInStage, currentHashStage } from "@/lib/hash-tally";
import type { CurrentUser } from "@/lib/auth";
import { loadWorkspaceContext } from "@/lib/workspace-context";
import { workspaceAdminTools, workspaceMemberTools, type WorkspaceNavLink } from "@/lib/workspace-navigation";
import { withWorkspaceCycle, workspacePermissionsForPath } from "@/lib/workspace-cycle-url";
import { cycleStatusLabel } from "@/lib/labels";
import WorkspaceCycleSwitcher from "./workspace-cycle-switcher";
import WorkspaceSidebar from "./workspace-sidebar";
import LogoutButton from "./logout-button";


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
  const requestedCycle = await requestedWorkspaceCycleId();
  if (requestedCycle && !hasPermission(user.memberships, requestedCycle, "WORKSPACE_ACCESS")) notFound();
  const { data: workspaceContext } = await loadWorkspaceContext(cycleId);
  const currentContext = workspaceContext?.cycleId === cycleId ? workspaceContext : null;
  const isScreeningReviewer = currentContext?.isScreeningReviewer ?? false;
  const openScreening = currentContext?.openScreeningCount ?? 0;
  const hasGradingEvent = currentContext?.hasGradingEvent ?? false;
  const hasSpeedDatingRound = currentContext?.hasSpeedDatingRound ?? false;
  const hasGroupCaseWork = currentContext?.hasGroupCaseWork ?? false;

  const can = (permission: Parameters<typeof hasPermission>[2]) => hasPermission(user.memberships, cycleId, permission);
  // The link follows the open ballot: a stage hash or the final vote at
  // decision lock, and only for the roles that stage lets vote.
  const votingOpen = user.memberships.some((membership) => {
    if (!membership.active || membership.cycleId !== cycleId) return false;
    const stage = currentHashStage(membership.cycle);
    return stage !== null && canVoteInStage(membership.role, stage);
  });
  const isBoard = user.memberships.some((membership) =>
    membership.active && membership.cycleId === cycleId && ["BOARD", "OWNER"].includes(membership.role));
  const isOwner = user.memberships.some((membership) =>
    membership.active && membership.cycleId === cycleId && membership.role === "OWNER");

  const primary: WorkspaceNavLink[] = [
    ["/member", "My work"],
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
  const scoped = (links: readonly WorkspaceNavLink[]): WorkspaceNavLink[] => links.map(([href, label]) => [withWorkspaceCycle(href, cycleId), label]);
  const cycles = Array.from(new Map(user.memberships.filter((membership) => workspacePermissionsForPath(current).some((permission) => hasPermission(user.memberships, membership.cycleId, permission)))
    .map((membership) => [membership.cycleId, { id: membership.cycleId, name: membership.cycle.name, status: cycleStatusLabel(membership.cycle.status) }])).values());
  return (
    <>
      <WorkspaceSidebar
        current={current}
        cycle={user.memberships.find((membership) => membership.cycleId === cycleId)?.cycle.name ?? "Current cycle"}
        account={user.name}
        groups={[
          { label: "My work", links: scoped([...primary.filter(([href]) => href === "/member"), ...myTools.filter(([href]) => href !== "/admin/people" && href !== "/member/refer")]) },
          { label: "Recruitment", links: scoped(primary.filter(([href]) => href !== "/member")) },
          { label: "Community", links: scoped(myTools.filter(([href]) => href === "/admin/people" || href === "/member/refer")) },
          { label: "Administration", links: scoped(adminTools) },
        ]}
        switcher={cycles.length > 1 ? <WorkspaceCycleSwitcher cycleId={cycleId} cycles={cycles} /> : undefined}
        signOut={<LogoutButton className="workspace-sign-out" />}
      />
      <span id="workspace-content" tabIndex={-1} className="sr-only">Workspace content</span>
    </>
  );
}
