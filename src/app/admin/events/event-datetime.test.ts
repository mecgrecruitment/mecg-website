import test from "node:test";
import assert from "node:assert/strict";
import { detroitDateTimeToIso, formatDetroitDateTime } from "@/lib/detroit-date-time";

test("event input values always render in Detroit rather than the host timezone", () => {
  assert.equal(formatDetroitDateTime("2026-07-15T22:30:00.000Z"), "2026-07-15T18:30");
  assert.equal(formatDetroitDateTime("2026-12-15T22:30:00.000Z"), "2026-12-15T17:30");
});

test("Detroit wall time converts to the correct instant across daylight saving seasons", () => {
  assert.equal(detroitDateTimeToIso("2026-07-15T18:30"), "2026-07-15T22:30:00.000Z");
  assert.equal(detroitDateTimeToIso("2026-12-15T17:30"), "2026-12-15T22:30:00.000Z");
});

test("an unchanged ambiguous Detroit wall time preserves its original instant", () => {
  assert.equal(detroitDateTimeToIso("2026-11-01T01:30", "2026-11-01T06:30:00.000Z"), "2026-11-01T06:30:00.000Z");
});

test("a new ambiguous Detroit wall time is rejected", () => {
  assert.throws(() => detroitDateTimeToIso("2026-11-01T01:30"), /occurs twice/);
});

test("a nonexistent Detroit wall time is rejected", () => {
  assert.throws(() => detroitDateTimeToIso("2026-03-08T02:30"), /does not exist/);
});
