import assert from "node:assert/strict";
import test from "node:test";
import { formatEasternDateTime } from "./date-time.ts";

test("formats winter and summer instants in Detroit time", () => {
  assert.equal(formatEasternDateTime("2026-01-15T17:30:00Z"), "Jan 15, 2026, 12:30 PM ET");
  assert.equal(formatEasternDateTime("2026-07-15T17:30:00Z"), "Jul 15, 2026, 1:30 PM ET");
});

test("supports a full date and fails safely for malformed values", () => {
  assert.equal(formatEasternDateTime("2026-09-10T22:00:00Z", "full"), "Thursday, September 10, 2026 at 6:00 PM ET");
  assert.equal(formatEasternDateTime("not-a-date"), "Invalid date");
});
