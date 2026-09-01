import test from "node:test";
import assert from "node:assert/strict";

async function importNotifications(testCase: string) {
  return import(`./notifications.ts?case=${testCase}`) as Promise<typeof import("./notifications.ts")>;
}

const claim = {
  id: "notification-1",
  recipient: "applicant@example.com",
  templateKey: "DECISION_RELEASED",
  templateVersion: 1,
  attemptCount: 1,
  idempotencyKey: "decision-release:decision-1",
  decisionOutcome: "OFFER",
  applicantName: "<Applicant>",
};

test("deliverNotification uses the stable idempotency key and completes a successful attempt", async (t) => {
  const sent: Array<Record<string, unknown>> = [];
  t.mock.module("@/lib/email", {
    namedExports: {
      escapeHtml: (value: string) => value.replaceAll("<", "&lt;").replaceAll(">", "&gt;"),
      wrapEmail: (html: string) => html,
      sendEmailDetailed: async (params: Record<string, unknown>) => {
        sent.push(params);
        return { delivered: true, providerMessageId: "provider-1", errorCategory: null, retryable: false };
      },
    },
  });
  const rpcCalls: Array<{ name: string; args?: Record<string, unknown> }> = [];
  const client = {
    rpc: async (name: string, args?: Record<string, unknown>) => {
      rpcCalls.push({ name, args });
      if (name === "claim_notification") return { data: claim, error: null };
      if (name === "complete_notification") return { data: "SENT", error: null };
      throw new Error(`unexpected RPC ${name}`);
    },
  };
  const { deliverNotification } = await importNotifications("success");
  const result = await deliverNotification(client, "notification-1");
  assert.deepEqual(result, { attempted: true, delivered: true, status: "SENT" });
  assert.equal(sent[0]?.idempotencyKey, "decision-release:decision-1");
  assert.match(String(sent[0]?.html), /&lt;Applicant&gt;/);
  assert.equal(rpcCalls[1]?.name, "complete_notification");
  assert.equal(rpcCalls[1]?.args?.provider_id, "provider-1");
});

test("deliverNotification records a retryable provider failure as pending", async (t) => {
  t.mock.module("@/lib/email", {
    namedExports: {
      escapeHtml: (value: string) => value,
      wrapEmail: (html: string) => html,
      sendEmailDetailed: async () => ({ delivered: false, providerMessageId: null, errorCategory: "HTTP_503", retryable: true }),
    },
  });
  let completion: Record<string, unknown> | undefined;
  const client = {
    rpc: async (name: string, args?: Record<string, unknown>) => {
      if (name === "claim_notification") return { data: claim, error: null };
      completion = args;
      return { data: "PENDING", error: null };
    },
  };
  const { deliverNotification } = await importNotifications("retryable");
  const result = await deliverNotification(client, "notification-1");
  assert.equal(result.status, "PENDING");
  assert.equal(completion?.should_retry, true);
  assert.equal(completion?.error_category, "HTTP_503");
});

test("deliverNotification does not send when an item is not due", async (t) => {
  let sendCount = 0;
  t.mock.module("@/lib/email", {
    namedExports: {
      escapeHtml: (value: string) => value,
      wrapEmail: (html: string) => html,
      sendEmailDetailed: async () => {
        sendCount += 1;
        return { delivered: true, providerMessageId: null, errorCategory: null, retryable: false };
      },
    },
  });
  const client = { rpc: async () => ({ data: null, error: null }) };
  const { deliverNotification } = await importNotifications("not-due");
  assert.deepEqual(await deliverNotification(client, "notification-1"), { attempted: false, delivered: false, status: "NOT_DUE" });
  assert.equal(sendCount, 0);
});

test("deliverNotification sends an event cancellation with its stable per-applicant key", async (t) => {
  const sent: Array<Record<string, unknown>> = [];
  t.mock.module("@/lib/email", {
    namedExports: {
      escapeHtml: (value: string) => value.replaceAll("<", "&lt;").replaceAll(">", "&gt;"),
      wrapEmail: (html: string) => html,
      sendEmailDetailed: async (params: Record<string, unknown>) => {
        sent.push(params);
        return { delivered: true, providerMessageId: "provider-event", errorCategory: null, retryable: false };
      },
    },
  });
  const eventClaim = {
    id: "notification-event", recipient: "applicant@example.com", templateKey: "EVENT_CANCELLED", templateVersion: 1,
    attemptCount: 1, idempotencyKey: "event-cancelled:event-1:application-1", applicantName: "<Applicant>",
    eventName: "Meet & Greet", eventStartsAt: "2026-09-10T22:00:00Z", eventLocation: "Ross",
  };
  const client = { rpc: async (name: string) => name === "claim_notification" ? { data: eventClaim, error: null } : { data: "SENT", error: null } };
  const { deliverNotification } = await importNotifications("event-cancelled");
  assert.equal((await deliverNotification(client, "notification-event")).status, "SENT");
  assert.equal(sent[0]?.idempotencyKey, "event-cancelled:event-1:application-1");
  assert.match(String(sent[0]?.subject), /Meet & Greet/);
  assert.match(String(sent[0]?.html), /&lt;Applicant&gt;/);
});
