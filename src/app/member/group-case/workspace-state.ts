import type { GroupCaseRoster } from "@/lib/group-case-roster";

export const GROUP_CASE_VISIBLE_STATUSES = ["PUBLISHED", "ACTIVE", "FROZEN", "FINALIZED", "ARCHIVED"] as const;
type Round = { status: GroupCaseRoster["roundStatus"]; closes_at: string | null };
export type GroupCaseWorkspaceState =
  | { kind: "active"; label: "Observations open"; action: "Continue observations"; detail: string }
  | { kind: "preview"; label: "Not open yet"; action: "Preview Group Case"; detail: string }
  | { kind: "read-only"; label: "Grading closed"; action: "Review saved observations"; detail: string };

// This describes editing availability, never evaluation quality or completion.
// The dedicated roster presents the canonical database quality verdict.
export function groupCaseWorkspaceState(round: Round, now = Date.now()): GroupCaseWorkspaceState {
  if (round.status === "PUBLISHED" || round.status === "DRAFT") return {
    kind: "preview", label: "Not open yet", action: "Preview Group Case",
    detail: "Observations open when the Board starts the round.",
  };
  if (round.status === "ACTIVE" && (!round.closes_at || new Date(round.closes_at).getTime() >= now)) return {
    kind: "active", label: "Observations open", action: "Continue observations",
    detail: "Saved evidence can still be edited. Open Group Case to check your review requirements.",
  };
  return {
    kind: "read-only", label: "Grading closed", action: "Review saved observations",
    detail: "This round is read-only. You can review your saved evidence and its grading requirements.",
  };
}
