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

test("reminders remain retryable when the email provider fails", async (t) => {
  const rpcCalls: string[] = [];
  t.mock.module("@/lib/supabase/admin", {
    namedExports: {
      createAdminClient: () => ({
        rpc: async (name: string) => {
          rpcCalls.push(name);
          return name === "pending_reminders"
            ? { data: [reminder], error: null }
            : { data: null, error: null };
        },
      }),
    },
  });
  mockEmail(t, async () => false);
  const records = degradedRecords(t);
  const { GET } = await withCronSecret(() => importRoute("provider-failure"));
  const response = await withCronSecret(() => GET(request()));

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { sent: 0, failed: 1, recordingFailed: 0 });
  assert.deepEqual(rpcCalls, ["pending_reminders"]);
  assert.equal(records.length, 1);
  assert.deepEqual(
    { event: records[0].event, code: records[0].code, detail: records[0].detail },
    { event: "cron.reminders_degraded", code: "SEND_FAILED", detail: { sent: 0, failed: 1, recordingFailed: 0 } },
  );
});

test("reminders log a degraded run when mark_reminder_sent fails", async (t) => {
  t.mock.module("@/lib/supabase/admin", {
    namedExports: {
      createAdminClient: () => ({
        rpc: async (name: string) =>
          name === "pending_reminders"
            ? { data: [reminder], error: null }
            : { data: null, error: { code: "P0001" } },
      }),
    },
  });
  mockEmail(t, async () => true);
  const records = degradedRecords(t);
  const { GET } = await withCronSecret(() => importRoute("record-failure"));
  const response = await withCronSecret(() => GET(request()));

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { sent: 0, failed: 0, recordingFailed: 1 });
  assert.equal(records.length, 1);
  assert.deepEqual(
    { event: records[0].event, code: records[0].code, detail: records[0].detail },
    { event: "cron.reminders_degraded", code: "RECORD_FAILED", detail: { sent: 0, failed: 0, recordingFailed: 1 } },
  );
});

test("reminders are recorded only after successful delivery", async (t) => {
  const rpcCalls: Array<{ name: string; args?: Record<string, unknown> }> = [];
  t.mock.module("@/lib/supabase/admin", {
    namedExports: {
      createAdminClient: () => ({
        rpc: async (name: string, args?: Record<string, unknown>) => {
          rpcCalls.push({ name, args });
          return name === "pending_reminders"
            ? { data: [reminder], error: null }
            : { data: null, error: null };
        },
      }),
    },
  });
  mockEmail(t, async () => true);
  const records = degradedRecords(t);
  const { GET } = await withCronSecret(() => importRoute("success"));
  const response = await withCronSecret(() => GET(request()));

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { sent: 1, failed: 0, recordingFailed: 0 });
  assert.equal(records.length, 0);
  assert.deepEqual(rpcCalls[1], {
    name: "mark_reminder_sent",
    args: { reminder_kind: "EVALUATION_DUE", subject_id: "round-1", recipient_id: "member-1" },
  });
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
