type MembershipLike = { cycleId: string; role: string; active: boolean; cycle?: { status?: string; [key: string]: unknown } };

export type Permission =
  | "WORKSPACE_ACCESS"
  | "RECRUITMENT_OPERATIONS"
  | "MANAGE_CYCLE"
  | "MANAGE_MEMBERSHIPS"
  | "HASH_PANEL_ACCESS"
  | "DECIDE"
  | "RELEASE"
  | "EXPORT";

const ROLE_PERMISSIONS: Record<string, readonly Permission[]> = {
  MEMBER: ["WORKSPACE_ACCESS"],
  BOARD: ["WORKSPACE_ACCESS", "RECRUITMENT_OPERATIONS", "MANAGE_CYCLE", "EXPORT"],
  PANEL: ["WORKSPACE_ACCESS", "HASH_PANEL_ACCESS", "DECIDE", "RELEASE"],
  OWNER: ["WORKSPACE_ACCESS", "RECRUITMENT_OPERATIONS", "MANAGE_CYCLE", "MANAGE_MEMBERSHIPS", "HASH_PANEL_ACCESS", "DECIDE", "RELEASE", "EXPORT"],
  RECRUITMENT_COMMITTEE: ["WORKSPACE_ACCESS", "RECRUITMENT_OPERATIONS"],
};

export function hasPermission(memberships: MembershipLike[], cycleId: string, permission: Permission) {
  return memberships.some((membership) =>
    membership.active
    && membership.cycleId === cycleId
    && ROLE_PERMISSIONS[membership.role]?.includes(permission)
    && !(membership.role === "RECRUITMENT_COMMITTEE"
      && ["WORKSPACE_ACCESS", "RECRUITMENT_OPERATIONS"].includes(permission)
      && ["CLOSED", "ARCHIVED"].includes(membership.cycle?.status ?? "")),
  );
}
