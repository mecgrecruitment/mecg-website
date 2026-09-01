import { hasPermission, type Permission } from "./authorization.ts";

type CycleMembership = {
  cycleId: string;
  role: string;
  active: boolean;
  cycle: {
    status: string;
    createdAt: Date;
  };
};

const CYCLE_STATUS_PRIORITY: Record<string, number> = {
  OPEN: 3,
  IN_PROCESS: 3,
  DECISION_LOCK: 3,
  DRAFT: 2,
  CLOSED: 1,
  ARCHIVED: 0,
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
    .sort((a, b) => {
      const statusDifference = (CYCLE_STATUS_PRIORITY[b.cycle.status] ?? -1)
        - (CYCLE_STATUS_PRIORITY[a.cycle.status] ?? -1);
      return statusDifference || b.cycle.createdAt.getTime() - a.cycle.createdAt.getTime();
    })[0]?.cycleId ?? null;
}
