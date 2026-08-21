type MembershipLike = { cycleId: string; role: string; active: boolean };

export type Permission =
  | "WORKSPACE_ACCESS"
  | "HASH_PANEL_ACCESS"
  | "EVALUATE"
  | "MANAGE_CYCLE"
  | "DECIDE"
  | "EXPORT";

export function hasPermission(
  memberships: MembershipLike[],
  cycleId: string,
  permission: Permission,
) {
  const roles = new Set(
    memberships
      .filter((membership) => membership.active && membership.cycleId === cycleId)
      .map((membership) => membership.role),
  );
  if (roles.has("OWNER")) return true;
  if (permission === "WORKSPACE_ACCESS" || permission === "EVALUATE") {
    return roles.has("MEMBER") || roles.has("BOARD") || roles.has("PANEL");
  }
  if (permission === "HASH_PANEL_ACCESS" || permission === "DECIDE") {
    return roles.has("PANEL");
  }
  return roles.has("BOARD");
}
