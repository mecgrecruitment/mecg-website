import test from "node:test";
import assert from "node:assert/strict";
import { PIPELINE_STAGES, PIPELINE_TRACKS, formatCalendarDate, parseRollup, rollupGrid } from "./model";
import { tools } from "@/lib/member-tools/model";
import { readFileSync } from "node:fs";

const cells = PIPELINE_STAGES.flatMap((stage) => PIPELINE_TRACKS.map((track) => ({ stage, track, count: 0, overdue: 0 })));
const base = { cycleId: "fall", asOf: "2026-11-18", total: 0, overdue: 0, unclassified: 0, canReview: false, overdueRecords: null, cells };

test("stage and track lists match the member pipeline form", () => {
  const field = (key: string) => tools.pipeline.fields.find((f) => f.key === key) as { options?: readonly string[] };
  assert.deepEqual([...PIPELINE_STAGES], [...(field("stage").options ?? [])]);
  assert.deepEqual([...PIPELINE_TRACKS], [...(field("track").options ?? [])]);
});

test("the rollup migration's stage and track arrays match the form", () => {
  const sql = readFileSync(new URL("../../../supabase/migrations/20261118110000_pipeline_rollup.sql", import.meta.url), "utf8");
  const array = (name: string) => JSON.parse(`[${sql.match(new RegExp(`${name} text\\[\\] := array\\[([^\\]]*)\\]`))![1]!.replaceAll("'", '"')}]`);
  assert.deepEqual(array("stages"), [...PIPELINE_STAGES]);
  assert.deepEqual(array("tracks"), [...PIPELINE_TRACKS]);
});

test("a non-reviewer rollup parses with counts only", () => {
  const parsed = parseRollup(base);
  assert.ok(parsed);
  assert.equal(parsed.overdueRecords, null);
  assert.equal(parsed.cells.length, PIPELINE_STAGES.length * PIPELINE_TRACKS.length);
});

test("a non-reviewer payload carrying record detail is refused", () => {
  assert.equal(parseRollup({ ...base, overdueRecords: [] }), null);
  assert.equal(parseRollup({ ...base, cells: cells.map((c, i) => (i ? c : { ...c, title: "Leak" })) }), null);
  assert.equal(parseRollup({ ...base, title: "Leak" }), null);
});

test("reviewer overdue records parse with only the listed fields", () => {
  const record = { id: "r1", title: "Acme", stage: "Proposal", track: "Client", nextDate: "2026-11-01", ownerName: "Avery" };
  const one = cells.map((c) => (c.stage === "Proposal" && c.track === "Client" ? { ...c, count: 1, overdue: 1 } : c));
  const parsed = parseRollup({ ...base, canReview: true, overdue: 1, total: 1, cells: one, overdueRecords: [record] });
  assert.deepEqual(parsed?.overdueRecords, [record]);
  assert.equal(parseRollup({ ...base, canReview: true, overdue: 1, total: 1, cells: one, overdueRecords: [{ ...record, problem: "Leak" }] }), null);
  assert.equal(parseRollup({ ...base, canReview: true, overdue: 1, total: 1, cells: one, overdueRecords: [{ ...record, stage: "Won" }] }), null);
  assert.equal(parseRollup({ ...base, canReview: true, overdueRecords: null }), null);
});

test("malformed counts, unknown stages and missing cells are refused", () => {
  assert.equal(parseRollup(null), null);
  assert.equal(parseRollup({ ...base, total: -1 }), null);
  assert.equal(parseRollup({ ...base, asOf: "18 Nov" }), null);
  assert.equal(parseRollup({ ...base, cells: cells.slice(1) }), null);
  assert.equal(parseRollup({ ...base, cells: [...cells.slice(1), { stage: "Won", track: "Client", count: 0, overdue: 0 }] }), null);
  assert.equal(parseRollup({ ...base, cells: cells.map((c, i) => (i ? c : { ...c, count: 1, overdue: 2 })) }), null);
});

test("the grid gives per-stage rows with track counts and totals", () => {
  const filled = cells.map((c) => (c.stage === "Proposal" && c.track === "Sponsor" ? { ...c, count: 3, overdue: 1 } : c.stage === "Proposal" ? { ...c, count: 2 } : c));
  const parsed = parseRollup({ ...base, total: 5, overdue: 1, cells: filled });
  assert.ok(parsed);
  const proposal = rollupGrid(parsed).rows.find((row) => row.stage === "Proposal");
  assert.deepEqual(proposal, { stage: "Proposal", byTrack: { Client: 2, Sponsor: 3 }, total: 5, overdue: 1 });
  assert.deepEqual(rollupGrid(parsed).trackTotals, { Client: 2, Sponsor: 3 });
});

test("totals that disagree with the cells are refused", () => {
  assert.equal(parseRollup({ ...base, total: 1 }), null);
  assert.equal(parseRollup({ ...base, total: 2, unclassified: 2 })?.unclassified, 2);
  assert.equal(parseRollup({ ...base, overdue: 1 }), null);
  const record = { id: "r1", title: "Acme", stage: "Proposal", track: "Client", nextDate: "2026-11-01", ownerName: "Avery" };
  assert.equal(parseRollup({ ...base, canReview: true, overdueRecords: [record] }), null, "reviewer list longer than the overdue count");
});

test("calendar dates format without a time-zone shift", () => {
  assert.equal(formatCalendarDate("2026-11-01"), "Nov 1, 2026");
});
