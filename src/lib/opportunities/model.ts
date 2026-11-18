// Board opportunity rollup: counts of member pipeline records (member tools,
// kind 'pipeline') by stage and track for one cycle, and how many have a
// next-action date in the past. The database returns counts only; record
// titles come back only when the viewer already holds pipeline reviewer access
// for the cycle, and only for overdue records.

import { isObject as isRecord, tools } from "@/lib/member-tools/model";

function pipelineFieldOptions(key: "stage" | "track"): readonly string[] {
  const field: { key: string; options?: readonly string[] } | undefined = tools.pipeline.fields.find((candidate) => candidate.key === key);
  if (!field?.options?.length) throw new Error(`Pipeline field ${key} has no options`);
  return field.options;
}
// Same order as the member pipeline form and the migration's arrays.
export const PIPELINE_STAGES = pipelineFieldOptions("stage");
export const PIPELINE_TRACKS = pipelineFieldOptions("track");

export type RollupCell = { stage: string; track: string; count: number; overdue: number };
export type OverdueRecord = { id: string; title: string; stage: string; track: string; nextDate: string; ownerName: string };
export type Rollup = {
  cycleId: string;
  // Today's date in Detroit; a next-action date before it is overdue.
  asOf: string;
  total: number;
  overdue: number;
  // Records whose stage or track is not a current option (none are expected;
  // saves validate both). Counted in total only.
  unclassified: number;
  canReview: boolean;
  // Null unless canReview. Never present for a board member without reviewer access.
  overdueRecords: OverdueRecord[] | null;
  cells: RollupCell[];
};

const isCount = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const isDate = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
const hasOnlyKeys = (value: Record<string, unknown>, keys: readonly string[]) => Object.keys(value).every((key) => keys.includes(key));

const ROLLUP_KEYS = ["cycleId", "asOf", "total", "overdue", "unclassified", "canReview", "overdueRecords", "cells"] as const;
const CELL_KEYS = ["stage", "track", "count", "overdue"] as const;
const RECORD_KEYS = ["id", "title", "stage", "track", "nextDate", "ownerName"] as const;

function parseCell(value: unknown): RollupCell | null {
  if (!isRecord(value) || !hasOnlyKeys(value, CELL_KEYS)) return null;
  const { stage, track, count, overdue } = value;
  if (typeof stage !== "string" || !PIPELINE_STAGES.includes(stage) || typeof track !== "string" || !PIPELINE_TRACKS.includes(track)) return null;
  if (!isCount(count) || !isCount(overdue) || overdue > count) return null;
  return { stage, track, count, overdue };
}

function parseOverdueRecord(value: unknown): OverdueRecord | null {
  if (!isRecord(value) || !hasOnlyKeys(value, RECORD_KEYS)) return null;
  const { id, title, stage, track, nextDate, ownerName } = value;
  if (typeof id !== "string" || !id || typeof title !== "string" || typeof stage !== "string" || !PIPELINE_STAGES.includes(stage)
    || typeof track !== "string" || !PIPELINE_TRACKS.includes(track) || !isDate(nextDate) || typeof ownerName !== "string") return null;
  return { id, title, stage, track, nextDate, ownerName };
}

// Returns null for any malformed or unexpectedly detailed response, so the page
// shows an unavailable state rather than a partial rollup or leaked content.
export function parseRollup(value: unknown): Rollup | null {
  if (!isRecord(value) || !hasOnlyKeys(value, ROLLUP_KEYS)) return null;
  const { cycleId, asOf, total, overdue, unclassified, canReview, overdueRecords, cells } = value;
  if (typeof cycleId !== "string" || !cycleId || !isDate(asOf) || !isCount(total) || !isCount(overdue) || !isCount(unclassified)
    || typeof canReview !== "boolean" || !Array.isArray(cells)) return null;
  const parsedCells: RollupCell[] = [];
  const seen = new Set<string>();
  for (const entry of cells) {
    const cell = parseCell(entry);
    if (!cell || seen.has(`${cell.stage}|${cell.track}`)) return null;
    seen.add(`${cell.stage}|${cell.track}`);
    parsedCells.push(cell);
  }
  if (seen.size !== PIPELINE_STAGES.length * PIPELINE_TRACKS.length) return null;
  const sum = (key: "count" | "overdue") => parsedCells.reduce((acc, cell) => acc + cell[key], 0);
  if (sum("count") + unclassified !== total || sum("overdue") !== overdue) return null;
  let records: OverdueRecord[] | null = null;
  if (canReview) {
    if (!Array.isArray(overdueRecords) || overdueRecords.length !== overdue) return null;
    records = [];
    for (const entry of overdueRecords) {
      const record = parseOverdueRecord(entry);
      if (!record) return null;
      records.push(record);
    }
  } else if (overdueRecords !== null) return null;
  return { cycleId, asOf, total, overdue, unclassified, canReview, overdueRecords: records, cells: parsedCells };
}

export type RollupRow = { stage: string; byTrack: Record<string, number>; total: number; overdue: number };

export function rollupGrid(rollup: Rollup): { rows: RollupRow[]; trackTotals: Record<string, number> } {
  const trackTotals = Object.fromEntries(PIPELINE_TRACKS.map((track) => [track, 0]));
  const rows = PIPELINE_STAGES.map((stage) => {
    const byTrack = Object.fromEntries(PIPELINE_TRACKS.map((track) => [track, 0]));
    let overdue = 0;
    for (const cell of rollup.cells) {
      if (cell.stage !== stage) continue;
      byTrack[cell.track] = cell.count;
      trackTotals[cell.track] += cell.count;
      overdue += cell.overdue;
    }
    return { stage, byTrack, total: Object.values(byTrack).reduce((a, b) => a + b, 0), overdue };
  });
  return { rows, trackTotals };
}

// "2026-11-15" -> "Nov 15, 2026". A calendar date, so format it in UTC to avoid a day shift.
export function formatCalendarDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value}T12:00:00Z`));
}
