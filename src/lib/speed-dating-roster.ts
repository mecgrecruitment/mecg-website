export type RosterApplicant = {
  applicationId: string;
  name: string;
  score: number | null;
  note: string;
  session: number | null;
  savedAt: string | null;
};

export type SpeedDatingRoster = {
  roundId: string;
  roundName: string;
  roundStatus: "DRAFT" | "PUBLISHED" | "ACTIVE" | "FROZEN" | "FINALIZED" | "ARCHIVED";
  criterion: { id: string; name: string; description: string } | null;
  rubricReady: boolean;
  progress: { scored: number; total: number };
  applicants: RosterApplicant[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isRosterApplicant(value: unknown): value is RosterApplicant {
  return isRecord(value)
    && typeof value.applicationId === "string"
    && typeof value.name === "string"
    && (value.score === null || (Number.isInteger(value.score) && (value.score as number) >= 1 && (value.score as number) <= 5))
    && typeof value.note === "string"
    && (value.session === null || Number.isInteger(value.session))
    && (value.savedAt === null || typeof value.savedAt === "string");
}

export function isSpeedDatingRoster(value: unknown): value is SpeedDatingRoster {
  if (!isRecord(value)) return false;
  if (typeof value.roundId !== "string" || typeof value.roundName !== "string") return false;
  if (!["DRAFT", "PUBLISHED", "ACTIVE", "FROZEN", "FINALIZED", "ARCHIVED"].includes(String(value.roundStatus))) return false;
  if (typeof value.rubricReady !== "boolean") return false;
  if (!isRecord(value.progress) || typeof value.progress.scored !== "number" || typeof value.progress.total !== "number") return false;
  if (value.criterion !== null && !(isRecord(value.criterion)
    && typeof value.criterion.id === "string"
    && typeof value.criterion.name === "string"
    && typeof value.criterion.description === "string")) return false;
  return Array.isArray(value.applicants) && value.applicants.every(isRosterApplicant);
}

function fold(value: string) {
  return value.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase().trim();
}

// Diacritic-insensitive substring match; an empty query matches everyone.
export function matchesApplicantName(name: string, query: string) {
  const needle = fold(query);
  return !needle || fold(name).includes(needle);
}

// Plain lowercase includes for free-text notes; an empty query matches nothing.
export function matchesNote(note: string, query: string) {
  const needle = query.trim().toLowerCase();
  return Boolean(needle) && note.toLowerCase().includes(needle);
}

export type ResultsSortKey = "adjusted" | "mean" | "count" | "stddev";
type ResultsRow = { name: string; count: number; adjusted: number | null; mean: number | null; stddev: number | null };

// Board results ordering: ungraded applicants always sink to the bottom and
// nulls sort after values in either direction.
export function compareResults(a: ResultsRow, b: ResultsRow, key: ResultsSortKey, direction: "desc" | "asc") {
  if ((a.count === 0) !== (b.count === 0)) return a.count === 0 ? 1 : -1;
  const left = a[key];
  const right = b[key];
  if (left == null || right == null) return left == null ? (right == null ? 0 : 1) : -1;
  return (direction === "desc" ? right - left : left - right) || a.name.localeCompare(b.name);
}
