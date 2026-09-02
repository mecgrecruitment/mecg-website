import { createPublicClient } from "@/lib/supabase/public";

export type PublicRecruitmentCycle = {
  name?: string;
  status?: string;
  opensAt?: string | null;
  closesAt?: string | null;
};

export type PublicRecruitment = {
  cycle?: PublicRecruitmentCycle | null;
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

export async function fetchPublicRecruitment(): Promise<PublicRecruitment> {
  const supabase = createPublicClient();
  const { data } = await supabase.rpc("public_recruitment");
  return data && typeof data === "object" ? data as PublicRecruitment : { cycle: null };
}
