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

function request() {
  return new NextRequest("http://localhost/api/maintenance/reminders", {
    headers: { authorization: `Bearer ${SECRET}` },
  });
}

function withCronSecret<T>(fn: () => T): T {
  const previous = process.env.CRON_SECRET;
  process.env.CRON_SECRET = SECRET;
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
  const { GET } = await withCronSecret(() => importRoute("provider-failure"));
  const response = await withCronSecret(() => GET(request()));

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { sent: 0, failed: 1, recordingFailed: 0 });
  assert.deepEqual(rpcCalls, ["pending_reminders"]);
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
  const { GET } = await withCronSecret(() => importRoute("success"));
  const response = await withCronSecret(() => GET(request()));

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { sent: 1, failed: 0, recordingFailed: 0 });
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
