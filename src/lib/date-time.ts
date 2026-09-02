const EASTERN_TIME_ZONE = "America/Detroit";

const formatters = {
  medium: new Intl.DateTimeFormat("en-US", {
    timeZone: EASTERN_TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
  }),
  full: new Intl.DateTimeFormat("en-US", {
    timeZone: EASTERN_TIME_ZONE,
    dateStyle: "full",
    timeStyle: "short",
  }),
};

const badgeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: EASTERN_TIME_ZONE,
  month: "short",
  day: "2-digit",
});

export function formatEasternDateTime(value: string | Date, style: keyof typeof formatters = "medium") {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Invalid date";
  return `${formatters[style].format(date)} ET`;
}

export function easternDateBadge(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  const parts = new Map(badgeFormatter.formatToParts(date).map((part) => [part.type, part.value]));
  return { month: (parts.get("month") ?? "").toUpperCase(), day: parts.get("day") ?? "" };
}

const OFFSET_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|([+-])(\d{2}):(\d{2}))$/;

/**
 * Parse the exact RFC 3339 shape accepted by mutation routes.
 *
 * `Date` alone is intentionally not used as validation: engines normalize
 * impossible calendar dates and accept abbreviated inputs such as `1Z`.
 */
export function parseOffsetDateTime(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const match = OFFSET_DATE_TIME.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const offsetHour = match[9] ? Number(match[10]) : 0;
  const offsetMinute = match[9] ? Number(match[11]) : 0;
  if (year < 1 || month < 1 || month > 12 || day < 1 || hour > 23 || minute > 59 || second > 59
    || offsetHour > 23 || offsetMinute > 59) return null;

  const calendarCheck = new Date(0);
  calendarCheck.setUTCFullYear(year, month - 1, day);
  calendarCheck.setUTCHours(hour, minute, second, 0);
  if (calendarCheck.getUTCFullYear() !== year || calendarCheck.getUTCMonth() !== month - 1
    || calendarCheck.getUTCDate() !== day || calendarCheck.getUTCHours() !== hour
    || calendarCheck.getUTCMinutes() !== minute || calendarCheck.getUTCSeconds() !== second) return null;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
