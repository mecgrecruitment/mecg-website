type MembershipLike = { cycleId: string; role: string; active: boolean };

// Mirrors rush.staffing_is_member: an active membership in the cycle in any
// role except PANEL alone (panelists can be outside judges, not members).
export function canSubmitAvailability(memberships: readonly MembershipLike[], cycleId: string): boolean {
  return memberships.some((membership) => membership.active && membership.cycleId === cycleId && membership.role !== "PANEL");
}
