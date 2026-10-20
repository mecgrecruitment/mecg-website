export type WorkspaceNavLink = readonly [href: string, label: string];

export function workspaceMemberTools({
  hasSpeedDatingRound,
  hasGroupCaseWork,
  votingOpen,
  isScreeningReviewer,
  openScreeningCount,
  hasGradingEvent,
}: {
  hasSpeedDatingRound: boolean;
  hasGroupCaseWork: boolean;
  votingOpen: boolean;
  isScreeningReviewer: boolean;
  openScreeningCount: number;
  hasGradingEvent: boolean;
}): WorkspaceNavLink[] {
  return [
    ...(hasSpeedDatingRound ? [["/member/speed-dating", "Speed Dating"] as const] : []),
    ...(hasGroupCaseWork ? [["/member/group-case", "Group Case"] as const] : []),
    ...(votingOpen ? [["/member/hash", "Hash vote"] as const] : []),
    ...(isScreeningReviewer
      ? [["/member/screening", `Read applications${openScreeningCount ? ` · ${openScreeningCount}` : ""}`] as const]
      : []),
    ...(hasGradingEvent ? [["/member/event", "Live event"] as const] : []),
    ["/member/refer", "Refer someone"],
    ["/admin/people", "People"],
  ];
}

export function workspaceAdminTools({
  canRecruitmentOperations,
  canManageCycle,
  isBoard,
  isOwner,
}: {
  canRecruitmentOperations: boolean;
  canManageCycle: boolean;
  isBoard: boolean;
  isOwner: boolean;
}): WorkspaceNavLink[] {
  return [
    ...(canRecruitmentOperations
      ? [["/admin/audit", "Activity"] as const]
      : []),
    ...(isBoard ? [["/admin/projects", "Projects"] as const] : []),
    ...(canManageCycle ? [["/admin/settings", "Settings"] as const] : []),
    ...(isOwner ? [["/admin/operations", "Operations"] as const] : []),
  ];
}

export function secondaryDestinationLabel(
  current: string,
  links: readonly WorkspaceNavLink[],
) {
  const currentPath = current.split(/[?#]/, 1)[0];
  return links.find(([href]) => href.split(/[?#]/, 1)[0] === currentPath)?.[1];
}
