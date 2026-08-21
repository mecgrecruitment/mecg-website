/* eslint-disable @typescript-eslint/no-require-imports -- plain CommonJS so
   this runs directly under `node --test` with zero build step */
const { test } = require("node:test");
const assert = require("node:assert");
const { isCheckinWindowOpen } = require("./rush.js");

test("isCheckinWindowOpen: true inside the window", () => {
  const event = {
    checkinOpensAt: new Date("2026-01-01T18:00:00Z"),
    checkinClosesAt: new Date("2026-01-01T20:00:00Z"),
  };
  assert.strictEqual(
    isCheckinWindowOpen(event, new Date("2026-01-01T19:00:00Z")),
    true,
  );
});

test("isCheckinWindowOpen: false before opening", () => {
  const event = {
    checkinOpensAt: new Date("2026-01-01T18:00:00Z"),
    checkinClosesAt: new Date("2026-01-01T20:00:00Z"),
  };
  assert.strictEqual(
    isCheckinWindowOpen(event, new Date("2026-01-01T17:59:59Z")),
    false,
  );
});

test("isCheckinWindowOpen: false after closing", () => {
  const event = {
    checkinOpensAt: new Date("2026-01-01T18:00:00Z"),
    checkinClosesAt: new Date("2026-01-01T20:00:00Z"),
  };
  assert.strictEqual(
    isCheckinWindowOpen(event, new Date("2026-01-01T20:00:01Z")),
    false,
  );
});

test("isCheckinWindowOpen: true exactly at open/close boundaries", () => {
  const event = {
    checkinOpensAt: new Date("2026-01-01T18:00:00Z"),
    checkinClosesAt: new Date("2026-01-01T20:00:00Z"),
  };
  assert.strictEqual(
    isCheckinWindowOpen(event, new Date("2026-01-01T18:00:00Z")),
    true,
  );
  assert.strictEqual(
    isCheckinWindowOpen(event, new Date("2026-01-01T20:00:00Z")),
    true,
  );
});
