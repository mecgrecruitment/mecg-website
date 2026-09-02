export type WorkspaceNavLink = readonly [href: string, label: string];

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
      ? ([
        ["/admin/screening", "Review setup"],
        ["/admin/audit", "Activity"],
      ] as const)
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
  return links.find(([href]) => href === currentPath)?.[1];
}
