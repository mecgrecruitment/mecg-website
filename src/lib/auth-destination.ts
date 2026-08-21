export type AccessRole = "MEMBER" | "BOARD" | "PANEL" | "OWNER";

export type AuthDestination = "/admin" | "/member" | "/applicant" | "/apply" | "/access-denied";

export function resolveAuthDestination(input: {
  active: boolean;
  roles: readonly AccessRole[];
  hasApplication: boolean;
}): AuthDestination {
  if (!input.active) return "/access-denied";

  const roles = new Set(input.roles);
  if (roles.has("OWNER") || roles.has("BOARD") || roles.has("PANEL")) return "/admin";
  if (roles.has("MEMBER")) return "/member";
  return input.hasApplication ? "/applicant" : "/apply";
}
