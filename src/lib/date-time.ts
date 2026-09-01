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
