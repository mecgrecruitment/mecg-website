import { formatEasternDateTime } from "@/lib/date-time";
import { safeHumanLocation } from "./safe-location";

export type ApplicantSchedule = {
  rsvps?: { slotId: string; eventId: string; eventName: string; startsAt: string; endsAt: string; location: string | null }[];
  group?: { name: string; prompt: string } | null;
  buddy?: { slotId: string; cycleId: string; startsAt: string; endsAt: string } | null;
  buddies?: { slotId: string; cycleId: string; startsAt: string; endsAt: string }[];
  openSlots?: { id: string; eventId: string; eventName: string; startsAt: string; endsAt: string; remaining: number }[];
  openBuddy?: { id: string; cycleId: string; startsAt: string; endsAt: string }[];
};

export type NextAction = {
  eyebrow: string;
  title: string;
  detail: string;
  href?: string;
  label?: string;
};

export type ApplicantScheduleState =
  | { kind: "unavailable" }
  | { kind: "loaded"; plan: ApplicantSchedule };

function nextConfirmedScheduleItem(plan: ApplicantSchedule, now: number) {
  const buddies = plan.buddies ?? (plan.buddy ? [plan.buddy] : []);
  const confirmed = [
    ...(plan.rsvps ?? []).map((item) => ({ label: item.eventName, startsAt: item.startsAt, location: safeHumanLocation(item.location) })),
    ...buddies.map((item) => ({ label: "Member chat", startsAt: item.startsAt, location: null })),
  ]
    .filter((item) => new Date(item.startsAt).getTime() > now)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  return confirmed[0] ?? null;
}

export function scheduleNextAction({ schedule, now }: { schedule: ApplicantScheduleState; now: number }): NextAction {
  if (schedule.kind === "unavailable") {
    return {
      eyebrow: "Schedule unavailable",
      title: "Your schedule could not be loaded",
      detail: "We could not check your bookings or available times. Retry below, or contact the recruitment team if this continues.",
      href: "#applicant-schedule",
      label: "View retry options",
    };
  }
  const { plan } = schedule;
  const openSlotCount = (plan.openSlots ?? []).filter((slot) => slot.remaining > 0).length + (plan.openBuddy ?? []).length;
  const nextConfirmed = nextConfirmedScheduleItem(plan, now);
  if (nextConfirmed) {
    return {
      eyebrow: "Next up",
      title: nextConfirmed.label,
      detail: `${formatEasternDateTime(nextConfirmed.startsAt)}${nextConfirmed.location ? ` · ${nextConfirmed.location}` : ""}`,
      href: "#applicant-schedule",
      label: "View schedule",
    };
  } else if (openSlotCount > 0) {
    return {
      eyebrow: "Next action",
      title: `Choose from ${openSlotCount} open ${openSlotCount === 1 ? "time" : "times"}`,
      detail: "Book the event or member-chat time that works for you.",
      href: "#applicant-schedule",
      label: "Choose a time",
    };
  } else {
    return {
      eyebrow: "No action needed",
      title: "You're caught up",
      detail: "Your status updates automatically. MECG will contact you when there is something to do.",
    };
  }
}
