import type { TallyItem } from "@/components/tally-strip";

export type MemberWorkTask = {
  href: string;
  label: string;
  detail: string;
  dueAt: number;
  action?: "Start" | "Continue" | "Open ballot";
  // The member's own progress only; never anyone else's votes or scores.
  progress?: readonly TallyItem[];
};

// Missing deadlines stay last; availability is not an invented due date.
export function taskDeadline(deadline: string | null | undefined) {
  if (!deadline) return Number.POSITIVE_INFINITY;
  const time = new Date(deadline).getTime();
  return Number.isFinite(time) ? time : Number.POSITIVE_INFINITY;
}

export function roundWorkOpen(round: { status: string; closes_at: string | null }, now = Date.now()) {
  const closesAt = taskDeadline(round.closes_at);
  return round.status === "ACTIVE" && (!round.closes_at || Number.isFinite(closesAt) && closesAt >= now);
}

export function orderedWorkTasks(tasks: readonly MemberWorkTask[]) {
  return [...tasks].sort((a, b) => a.dueAt - b.dueAt || a.label.localeCompare(b.label));
}
