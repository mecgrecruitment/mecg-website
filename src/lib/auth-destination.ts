export type AccessRole = "MEMBER" | "BOARD" | "PANEL" | "OWNER" | "RECRUITMENT_COMMITTEE";

type AccessMembership = { role: AccessRole; cycleStatus?: string };

export type AuthDestination = "/admin" | "/member" | "/applicant" | "/apply" | "/access-denied";

export function resolveAuthDestination(input: {
  active: boolean;
  memberships: readonly AccessMembership[];
  hasApplication: boolean;
  canStartApplication: boolean;
  hasEditableApplication: boolean;
}): AuthDestination {
  if (!input.active) return "/access-denied";

  const roles = new Set(input.memberships
    .filter((membership) => membership.role !== "RECRUITMENT_COMMITTEE" || !["CLOSED", "ARCHIVED"].includes(membership.cycleStatus ?? ""))
    .map((membership) => membership.role));
  if (roles.has("OWNER") || roles.has("BOARD") || roles.has("PANEL") || roles.has("RECRUITMENT_COMMITTEE")) return "/admin";
  if (roles.has("MEMBER")) return "/member";
  // A past application must not trap someone on the old decision. If a cycle is
  // open that they have not applied to, applying is their live business.
  if (input.canStartApplication || input.hasEditableApplication) return "/apply";
  return input.hasApplication ? "/applicant" : "/apply";
}

// intake_schema selects the current eligible open cycle and returns draft only
// for caller-owned DRAFT/NEEDS_INFO rows. History alone cannot answer this.
export function hasEditableIntakeApplication(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return "open" in value && value.open === true
    && "cycleId" in value && typeof value.cycleId === "string" && !!value.cycleId.trim()
    && "draft" in value && !!value.draft && typeof value.draft === "object" && !Array.isArray(value.draft);
}
