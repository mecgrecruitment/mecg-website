type MembershipLike = { role: string; active: boolean };

// Mirrors rush.budget_is_member: an active membership in any cycle and any
// role except PANEL alone (panelists can be outside judges, not members).
export function canRequestBudget(memberships: readonly MembershipLike[]): boolean {
  return memberships.some((membership) => membership.active && membership.role !== "PANEL");
}

// Mirrors rush.budget_is_board.
export function canReviewBudget(memberships: readonly MembershipLike[]): boolean {
  return memberships.some((membership) => membership.active && (membership.role === "BOARD" || membership.role === "OWNER"));
}
