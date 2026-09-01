const EVENT_TIME_ZONE = "America/Detroit";

type DateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

const formatter = new Intl.DateTimeFormat("en-US", {
  timeZone: EVENT_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function partsAt(instant: number): DateTimeParts & { second: number } {
  const values = new Map(formatter.formatToParts(new Date(instant)).map((part) => [part.type, part.value]));
  return {
    year: Number(values.get("year")), month: Number(values.get("month")), day: Number(values.get("day")),
    hour: Number(values.get("hour")), minute: Number(values.get("minute")), second: Number(values.get("second")),
  };
}

export function formatEventDateTime(isoInstant: string): string {
  const parts = partsAt(new Date(isoInstant).getTime());
  return `${parts.year.toString().padStart(4, "0")}-${parts.month.toString().padStart(2, "0")}-${parts.day.toString().padStart(2, "0")}T${parts.hour.toString().padStart(2, "0")}:${parts.minute.toString().padStart(2, "0")}`;
}

function parseParts(value: string): DateTimeParts {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error("Invalid event date and time");
  const parts = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]), hour: Number(match[4]), minute: Number(match[5]) };
  const check = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute));
  if (check.getUTCFullYear() !== parts.year || check.getUTCMonth() !== parts.month - 1 || check.getUTCDate() !== parts.day
    || check.getUTCHours() !== parts.hour || check.getUTCMinutes() !== parts.minute) throw new Error("Invalid event date and time");
  return parts;
}

function offsetAt(instant: number): number {
  const parts = partsAt(instant);
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - instant;
}

export function eventDateTimeToIso(localValue: string, originalInstant?: string): string {
  if (originalInstant && formatEventDateTime(originalInstant) === localValue) return new Date(originalInstant).toISOString();
  const parts = parseParts(localValue);
  const wallClock = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  const day = 86_400_000;
  const sampleInstants = [wallClock, wallClock - day, wallClock + day, wallClock - 180 * day, wallClock + 180 * day];
  const offsets = new Set(sampleInstants.map(offsetAt));
  const candidates = [...offsets]
    .map((offset) => wallClock - offset)
    .filter((instant) => formatEventDateTime(new Date(instant).toISOString()) === localValue)
    .sort((left, right) => left - right);
  if (!candidates.length) throw new Error("This Detroit time does not exist because of daylight saving time");
  return new Date(candidates[0]).toISOString();
}
