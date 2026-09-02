import assert from "node:assert/strict";
import test from "node:test";
import { formatEasternDateTime, parseOffsetDateTime } from "./date-time.ts";

test("formats winter and summer instants in Detroit time", () => {
  assert.equal(formatEasternDateTime("2026-01-15T17:30:00Z"), "Jan 15, 2026, 12:30 PM ET");
  assert.equal(formatEasternDateTime("2026-07-15T17:30:00Z"), "Jul 15, 2026, 1:30 PM ET");
});

test("supports a full date and fails safely for malformed values", () => {
  assert.equal(formatEasternDateTime("2026-09-10T22:00:00Z", "full"), "Thursday, September 10, 2026 at 6:00 PM ET");
  assert.equal(formatEasternDateTime("not-a-date"), "Invalid date");
});

test("strictly parses complete RFC 3339 date-times", () => {
  assert.equal(parseOffsetDateTime("2026-09-02T20:00:00-04:00")?.toISOString(), "2026-09-03T00:00:00.000Z");
  assert.equal(parseOffsetDateTime("2026-09-03T00:00:00.123Z")?.toISOString(), "2026-09-03T00:00:00.123Z");
});

test("rejects abbreviated, offset-less, and impossible date-times", () => {
  for (const value of [
    "1Z",
    "2026-09-02T20:00",
    "2026-02-30T20:00:00Z",
    "2026-09-02T24:00:00Z",
    "2026-09-02T20:00:60Z",
    "2026-09-02T20:00:00+24:00",
  ]) assert.equal(parseOffsetDateTime(value), null, value);
});
