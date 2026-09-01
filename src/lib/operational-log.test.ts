import assert from "node:assert/strict";
import test from "node:test";
import { operationalLog } from "./operational-log.ts";

test("operationalLog writes one structured record", (t) => {
  let output = "";
  t.mock.method(console, "error", (value: string) => { output = value; });
  t.mock.method(Date.prototype, "toISOString", () => "2026-09-01T12:00:00.000Z");

  operationalLog("error", {
    event: "health.failed",
    requestId: "request-1",
    durationMs: 12.6,
    detail: { dependency: "supabase" },
  });

  assert.deepEqual(JSON.parse(output), {
    timestamp: "2026-09-01T12:00:00.000Z",
    level: "error",
    service: "mecg-recruitment",
    event: "health.failed",
    requestId: "request-1",
    durationMs: 13,
    detail: { dependency: "supabase" },
  });
});

test("operationalLog removes line breaks and bounds metadata", (t) => {
  let output = "";
  t.mock.method(console, "warn", (value: string) => { output = value; });

  operationalLog("warn", {
    event: "cron\nfailed",
    code: "x".repeat(120),
    detail: { reason: "bad\ninput" },
  });

  const record = JSON.parse(output);
  assert.equal(record.event, "cron failed");
  assert.equal(record.code.length, 80);
  assert.equal(record.detail.reason, "bad input");
});
