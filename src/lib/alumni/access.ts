type MembershipLike = { role: string; active: boolean };

// Mirrors rush.alumni_is_member: an active membership in any cycle and any
// role except PANEL alone (panelists can be outside judges, not members).
export function canUseAlumniDirectory(memberships: readonly MembershipLike[]): boolean {
  return memberships.some((membership) => membership.active && membership.role !== "PANEL");
}
