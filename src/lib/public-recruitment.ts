import { createPublicClient } from "@/lib/supabase/public";

export type PublicRecruitmentCycle = {
  name?: string;
  status?: string;
  opensAt?: string | null;
  closesAt?: string | null;
};

export type PublicRecruitmentEvent = { id: string; name: string; kind: string; startsAt: string; endsAt: string | null; location: string | null; visibility: "PUBLIC" };
export type PublicRecruitment =
  | { kind: "available"; cycle: PublicRecruitmentCycle | null; events: PublicRecruitmentEvent[] }
  | { kind: "unavailable"; cycle: null; events: [] };

const UNAVAILABLE: PublicRecruitment = { kind: "unavailable", cycle: null, events: [] };
const nullableDate = (value: unknown): value is string | null => value === null || typeof value === "string" && Number.isFinite(Date.parse(value));

export function parsePublicRecruitment(value: unknown): PublicRecruitment {
  if (!value || typeof value !== "object" || !("cycle" in value) || !("events" in value) || !Array.isArray(value.events)) return UNAVAILABLE;
  let cycle: PublicRecruitmentCycle | null = null;
  if (value.cycle !== null) {
    const candidate = value.cycle;
    if (!candidate || typeof candidate !== "object" || !("name" in candidate) || typeof candidate.name !== "string" || !candidate.name.trim() || !("status" in candidate) || (candidate.status !== "DRAFT" && candidate.status !== "OPEN" && candidate.status !== "IN_PROCESS") || !("opensAt" in candidate) || !nullableDate(candidate.opensAt) || !("closesAt" in candidate) || !nullableDate(candidate.closesAt)) return UNAVAILABLE;
    cycle = { name: candidate.name, status: candidate.status, opensAt: candidate.opensAt, closesAt: candidate.closesAt };
  }
  const events: PublicRecruitmentEvent[] = [];
  for (const event of value.events) {
    if (!event || typeof event !== "object" || typeof event.id !== "string" || !event.id || typeof event.name !== "string" || typeof event.kind !== "string" || typeof event.startsAt !== "string" || !Number.isFinite(Date.parse(event.startsAt)) || !nullableDate(event.endsAt) || !(event.location === null || typeof event.location === "string") || event.visibility !== "PUBLIC") return UNAVAILABLE;
    events.push({ id: event.id, name: event.name, kind: event.kind, startsAt: event.startsAt, endsAt: event.endsAt, location: event.location, visibility: "PUBLIC" });
  }
  if (cycle === null && events.length > 0) return UNAVAILABLE;
  return { kind: "available", cycle, events };
}

export type RecruitmentAction = {
  href: string;
  label: string;
};

const DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Detroit",
  timeZoneName: "short",
});

const TIME_FORMAT = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Detroit",
  timeZoneName: "short",
});

export function formatRecruitmentDate(value: string) {
  return DATE_FORMAT.format(new Date(value));
}

export function formatRecruitmentTime(value: string) {
  return TIME_FORMAT.format(new Date(value));
}

export function formatRecruitmentEventTime(startsAt: string, endsAt?: string | null) {
  const start = formatRecruitmentDate(startsAt);
  return endsAt ? `${start} to ${TIME_FORMAT.format(new Date(endsAt))}` : start;
}

export function isApplicationWindowOpen(cycle: PublicRecruitmentCycle, now = Date.now()) {
  const opensAt = cycle.opensAt ? new Date(cycle.opensAt).getTime() : null;
  const closesAt = cycle.closesAt ? new Date(cycle.closesAt).getTime() : null;
  return cycle.status === "OPEN"
    && (opensAt === null || opensAt <= now)
    && (closesAt === null || closesAt >= now);
}

export function isBeforeApplicationOpen(cycle: PublicRecruitmentCycle, now = Date.now()) {
  const opensAt = cycle.opensAt ? new Date(cycle.opensAt).getTime() : null;
  return cycle.status === "OPEN" && opensAt !== null && opensAt > now;
}

export function applicationCycleStatus(cycle: PublicRecruitmentCycle, now = Date.now()) {
  const closesAt = cycle.closesAt ? new Date(cycle.closesAt).getTime() : null;

  if (isApplicationWindowOpen(cycle, now)) {
    return {
      label: "Applications are open",
      detail: cycle.closesAt ? `Apply by ${formatRecruitmentDate(cycle.closesAt)}.` : "Apply now.",
      isOpen: true,
      opensAt: cycle.opensAt ?? null,
    };
  }

  if (cycle.status === "OPEN" && closesAt !== null && closesAt < now) {
    return {
      label: "Applications are closed",
      detail: `Applications closed ${formatRecruitmentDate(cycle.closesAt!)}.`,
      isOpen: false,
      opensAt: cycle.opensAt ?? null,
    };
  }

  if (cycle.status === "IN_PROCESS") {
    return {
      label: "Selection is in progress",
      detail: "Current applicants can find invitations and updates on their status page.",
      isOpen: false,
      opensAt: cycle.opensAt ?? null,
    };
  }

  return {
    label: "Applications open soon",
    detail: cycle.opensAt
      ? `Applications open ${formatRecruitmentDate(cycle.opensAt)}${cycle.closesAt ? ` and close ${formatRecruitmentDate(cycle.closesAt)}` : ""}.`
      : "Join the interest list for published dates.",
    isOpen: false,
    opensAt: cycle.opensAt ?? null,
  };
}

export function recruitmentAction(
  cycle?: PublicRecruitmentCycle | null,
  options: {
    now?: number;
    inactiveHref?: string;
    inactiveLabel?: string;
  } = {},
): RecruitmentAction {
  if (cycle && isApplicationWindowOpen(cycle, options.now)) {
    return { href: "/apply", label: "Apply now" };
  }

  return {
    href: options.inactiveHref ?? "/join",
    label: options.inactiveLabel ?? "Join MECG",
  };
}

export async function fetchPublicRecruitment(): Promise<PublicRecruitment> {
  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase.rpc("public_recruitment");
    return error ? UNAVAILABLE : parsePublicRecruitment(data);
  } catch {
    return UNAVAILABLE;
  }
}
