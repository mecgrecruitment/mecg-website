import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";

const SECRET = "r".repeat(40);
const reminder = {
  kind: "EVALUATION_DUE",
  subjectId: "round-1",
  recipientId: "member-1",
  email: "member@example.com",
  name: "Member",
  detail: "Round one",
  dueAt: "2026-09-10T21:00:00.000Z",
};

function request(headers: Record<string, string> = { authorization: `Bearer ${SECRET}` }) {
  return new NextRequest("http://localhost/api/maintenance/reminders", { headers });
}

// null unsets the variable; assigning undefined would store the string "undefined".
function withCronSecret<T>(fn: () => T, value: string | null = SECRET): T {
  const previous = process.env.CRON_SECRET;
  if (value === null) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = value;
  try {
    return fn();
  } finally {
    if (previous === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previous;
  }
}

async function importRoute(testCase: string) {
  return import(`./route.ts?case=${testCase}`) as Promise<typeof import("./route.ts")>;
}

function mockEmail(t: test.TestContext, sendEmail: () => Promise<boolean>) {
  t.mock.module("@/lib/email", {
    namedExports: {
      escapeHtml: (value: string) => value,
      sendEmail,
      wrapEmail: (html: string) => html,
    },
  });
}

// operationalLog writes one JSON line per record through console.error; keep
// only those so the loop's ad hoc console.error calls do not pollute the check.
function degradedRecords(t: test.TestContext) {
  const records: Array<Record<string, unknown>> = [];
  t.mock.method(console, "error", (value: unknown) => {
    if (typeof value !== "string" || !value.startsWith("{")) return;
    const record = JSON.parse(value);
    if (record.service === "mecg-recruitment" && record.level === "error") records.push(record);
  });
  return records;
}

// The claim is what arbitrates two overlapping cron runs, so every case here
// has to say what claim_reminder returned.
function mockRpc(
  t: test.TestContext,
  calls: Array<{ name: string; args?: Record<string, unknown> }>,
  results: Record<string, { data: unknown; error: unknown }>,
) {
  t.mock.module("@/lib/supabase/admin", {
    namedExports: {
      createAdminClient: () => ({
        rpc: async (name: string, args?: Record<string, unknown>) => {
          calls.push({ name, args });
          if (name === "pending_reminders") return { data: [reminder], error: null };
          return results[name] ?? { data: null, error: null };
        },
      }),
    },
  });
}

const claimArgs = { reminder_kind: "EVALUATION_DUE", subject_id: "round-1", recipient_id: "member-1" };

test("reminders remain retryable when the email provider fails", async (t) => {
  const rpcCalls: Array<{ name: string; args?: Record<string, unknown> }> = [];
  mockRpc(t, rpcCalls, { claim_reminder: { data: true, error: null } });
  mockEmail(t, async () => false);
  const records = degradedRecords(t);
  const { GET } = await withCronSecret(() => importRoute("provider-failure"));
  const response = await withCronSecret(() => GET(request()));

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { sent: 0, failed: 1, recordingFailed: 0, skipped: 0 });
  // A failed send hands the claim back, so the next run sends it again.
  assert.deepEqual(rpcCalls.map((call) => call.name), ["pending_reminders", "claim_reminder", "release_reminder"]);
  assert.deepEqual(rpcCalls[2].args, claimArgs);
  assert.equal(records.length, 1);
  assert.deepEqual(
    { event: records[0].event, code: records[0].code, detail: records[0].detail },
    { event: "cron.reminders_degraded", code: "SEND_FAILED", detail: { sent: 0, failed: 1, recordingFailed: 0 } },
  );
});

test("reminders log a degraded run when the claim fails", async (t) => {
  const rpcCalls: Array<{ name: string; args?: Record<string, unknown> }> = [];
  mockRpc(t, rpcCalls, { claim_reminder: { data: null, error: { code: "P0001" } } });
  let emailCalls = 0;
  mockEmail(t, async () => { emailCalls += 1; return true; });
  const records = degradedRecords(t);
  const { GET } = await withCronSecret(() => importRoute("record-failure"));
  const response = await withCronSecret(() => GET(request()));

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { sent: 0, failed: 0, recordingFailed: 1, skipped: 0 });
  assert.equal(emailCalls, 0);
  assert.equal(records.length, 1);
  assert.deepEqual(
    { event: records[0].event, code: records[0].code, detail: records[0].detail },
    { event: "cron.reminders_degraded", code: "RECORD_FAILED", detail: { sent: 0, failed: 0, recordingFailed: 1 } },
  );
});

test("a reminder another run already claimed is not sent again", async (t) => {
  const rpcCalls: Array<{ name: string; args?: Record<string, unknown> }> = [];
  mockRpc(t, rpcCalls, { claim_reminder: { data: false, error: null } });
  let emailCalls = 0;
  mockEmail(t, async () => { emailCalls += 1; return true; });
  const records = degradedRecords(t);
  const { GET } = await withCronSecret(() => importRoute("lost-claim"));
  const response = await withCronSecret(() => GET(request()));

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { sent: 0, failed: 0, recordingFailed: 0, skipped: 1 });
  assert.equal(emailCalls, 0);
  assert.deepEqual(rpcCalls.map((call) => call.name), ["pending_reminders", "claim_reminder"]);
  assert.equal(records.length, 0);
});

test("reminders are claimed before delivery and kept once delivered", async (t) => {
  const rpcCalls: Array<{ name: string; args?: Record<string, unknown> }> = [];
  mockRpc(t, rpcCalls, { claim_reminder: { data: true, error: null } });
  mockEmail(t, async () => true);
  const records = degradedRecords(t);
  const { GET } = await withCronSecret(() => importRoute("success"));
  const response = await withCronSecret(() => GET(request()));

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { sent: 1, failed: 0, recordingFailed: 0, skipped: 0 });
  assert.equal(records.length, 0);
  assert.deepEqual(rpcCalls[1], { name: "claim_reminder", args: claimArgs });
  assert.deepEqual(rpcCalls.map((call) => call.name), ["pending_reminders", "claim_reminder"]);
});

test("reminders fail closed on a malformed database payload", async (t) => {
  let emailCalls = 0;
  t.mock.module("@/lib/supabase/admin", {
    namedExports: { createAdminClient: () => ({ rpc: async () => ({ data: [{ ...reminder, dueAt: "not-a-date" }], error: null }) }) },
  });
  mockEmail(t, async () => { emailCalls += 1; return true; });
  const { GET } = await withCronSecret(() => importRoute("malformed"));
  const response = await withCronSecret(() => GET(request()));

  assert.equal(response.status, 500);
  assert.equal(emailCalls, 0);
});

function mockNoWork(t: test.TestContext) {
  t.mock.module("@/lib/supabase/admin", { namedExports: { createAdminClient: () => { throw new Error("should not run"); } } });
  mockEmail(t, async () => { throw new Error("should not run"); });
}

test("reminders reject a missing authorization header", async (t) => {
  mockNoWork(t);
  const { GET } = await withCronSecret(() => importRoute("missing-header"));
  const response = await withCronSecret(() => GET(request({})));

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "Unauthorized" });
});

test("reminders reject a wrong secret", async (t) => {
  mockNoWork(t);
  const { GET } = await withCronSecret(() => importRoute("wrong-secret"));
  const response = await withCronSecret(() => GET(request({ authorization: "Bearer nope" })));

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "Unauthorized" });
});

test("reminders refuse to run when CRON_SECRET is unset", async (t) => {
  mockNoWork(t);
  const { GET } = await withCronSecret(() => importRoute("unset-secret"));
  const response = await withCronSecret(() => GET(request()), null);

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "Not configured" });
});

test("reminders refuse to run when CRON_SECRET is blank", async (t) => {
  mockNoWork(t);
  const { GET } = await withCronSecret(() => importRoute("blank-secret"));
  const response = await withCronSecret(() => GET(request({ authorization: "Bearer  " })), "  ");

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "Not configured" });
});
