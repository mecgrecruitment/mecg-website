export type AccessRole = "MEMBER" | "BOARD" | "PANEL" | "OWNER" | "RECRUITMENT_COMMITTEE";

type AccessMembership = { role: AccessRole; cycleStatus?: string };

export type AuthDestination = "/admin" | "/member" | "/applicant" | "/apply" | "/access-denied";

export function resolveAuthDestination(input: {
  active: boolean;
  memberships: readonly AccessMembership[];
  hasApplication: boolean;
}): AuthDestination {
  if (!input.active) return "/access-denied";

  const roles = new Set(input.memberships
    .filter((membership) => membership.role !== "RECRUITMENT_COMMITTEE" || !["CLOSED", "ARCHIVED"].includes(membership.cycleStatus ?? ""))
    .map((membership) => membership.role));
  if (roles.has("OWNER") || roles.has("BOARD") || roles.has("PANEL") || roles.has("RECRUITMENT_COMMITTEE")) return "/admin";
  if (roles.has("MEMBER")) return "/member";
  return input.hasApplication ? "/applicant" : "/apply";
}
