import { hasPermission, type Permission } from "./authorization.ts";

type CycleMembership = {
  cycleId: string;
  role: string;
  active: boolean;
  cycle: { createdAt: Date };
};

export function selectAuthorizedCycleId(
  memberships: CycleMembership[],
  permission: Permission,
  requestedCycleId?: string | null,
) {
  if (requestedCycleId) {
    return hasPermission(memberships, requestedCycleId, permission)
      ? requestedCycleId
      : null;
  }
  return memberships
    .filter((membership) =>
      hasPermission(memberships, membership.cycleId, permission),
    )
    .sort(
      (a, b) => b.cycle.createdAt.getTime() - a.cycle.createdAt.getTime(),
    )[0]?.cycleId ?? null;
}
