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

test("deliverNotification sends a durable application receipt", async (t) => {
  const sent: Array<Record<string, unknown>> = [];
  t.mock.module("@/lib/email", {
    namedExports: {
      escapeHtml: (value: string) => value.replaceAll("<", "&lt;").replaceAll(">", "&gt;"),
      wrapEmail: (html: string, cta?: { label: string }) => `${html}${cta?.label ?? ""}`,
      sendEmailDetailed: async (params: Record<string, unknown>) => {
        sent.push(params);
        return { delivered: true, providerMessageId: "provider-receipt", errorCategory: null, retryable: false };
      },
    },
  });
  const receiptClaim = {
    id: "notification-receipt",
    recipient: "applicant@example.com",
    templateKey: "APPLICATION_RECEIVED",
    templateVersion: 1,
    attemptCount: 1,
    idempotencyKey: "application-received:application-1",
    applicantName: "<Applicant>",
  };
  const client = { rpc: async (name: string) => name === "claim_notification" ? { data: receiptClaim, error: null } : { data: "SENT", error: null } };
  const { deliverNotification } = await importNotifications("application-received");
  assert.equal((await deliverNotification(client, receiptClaim.id)).status, "SENT");
  assert.equal(sent[0]?.subject, "We received your MECG application");
  assert.equal(sent[0]?.idempotencyKey, receiptClaim.idempotencyKey);
  assert.match(String(sent[0]?.html), /&lt;Applicant&gt;/);
  assert.match(String(sent[0]?.html), /View your application/);
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

test("deliverNotification sends a Speed Dating invitation with escaped round details", async (t) => {
  const sent: Array<Record<string, unknown>> = [];
  t.mock.module("@/lib/email", {
    namedExports: {
      escapeHtml: (value: string) => value.replaceAll("<", "&lt;").replaceAll(">", "&gt;"),
      wrapEmail: (html: string, cta?: { label: string }) => `${html}${cta?.label ?? ""}`,
      sendEmailDetailed: async (params: Record<string, unknown>) => {
        sent.push(params);
        return { delivered: true, providerMessageId: "provider-invitation", errorCategory: null, retryable: false };
      },
    },
  });
  const invitationClaim = {
    id: "notification-invitation",
    recipient: "applicant@example.com",
    templateKey: "SPEED_DATING_INVITATION",
    templateVersion: 1,
    attemptCount: 1,
    idempotencyKey: "speed-dating-invitation:participation-1",
    applicantName: "<Applicant>",
    roundName: "Speed <Dating>",
    roundOpensAt: "2026-09-10T22:00:00Z",
    roundClosesAt: "2026-09-11T02:00:00Z",
  };
  const client = { rpc: async (name: string) => name === "claim_notification" ? { data: invitationClaim, error: null } : { data: "SENT", error: null } };
  const { deliverNotification } = await importNotifications("speed-dating-invitation");
  assert.equal((await deliverNotification(client, invitationClaim.id)).status, "SENT");
  assert.equal(sent[0]?.idempotencyKey, invitationClaim.idempotencyKey);
  assert.equal(sent[0]?.subject, "You're invited to MECG Speed Dating");
  assert.match(String(sent[0]?.html), /&lt;Applicant&gt;/);
  assert.match(String(sent[0]?.html), /Speed &lt;Dating&gt;/);
  assert.match(String(sent[0]?.html), /View next steps/);
});

test("deliverNotification sends an evaluator assignment to My Work", async (t) => {
  const sent: Array<Record<string, unknown>> = [];
  t.mock.module("@/lib/email", {
    namedExports: {
      escapeHtml: (value: string) => value.replaceAll("<", "&lt;").replaceAll(">", "&gt;"),
      wrapEmail: (html: string, cta?: { label: string }) => `${html}${cta?.label ?? ""}`,
      sendEmailDetailed: async (params: Record<string, unknown>) => {
        sent.push(params);
        return { delivered: true, providerMessageId: "provider-assignment", errorCategory: null, retryable: false };
      },
    },
  });
  const assignmentClaim = {
    id: "notification-assignment",
    recipient: "evaluator@example.com",
    templateKey: "EVALUATION_ASSIGNED",
    templateVersion: 1,
    attemptCount: 1,
    idempotencyKey: "evaluation-assigned:assignment-1",
    applicantName: "<Applicant>",
    evaluatorName: "<Evaluator>",
    roundName: "Speed Dating",
    roundOpensAt: null,
    roundClosesAt: "2026-09-11T02:00:00Z",
    assignmentId: "assignment-1",
  };
  const client = { rpc: async (name: string) => name === "claim_notification" ? { data: assignmentClaim, error: null } : { data: "SENT", error: null } };
  const { deliverNotification } = await importNotifications("evaluation-assigned");
  assert.equal((await deliverNotification(client, assignmentClaim.id)).status, "SENT");
  assert.equal(sent[0]?.idempotencyKey, assignmentClaim.idempotencyKey);
  assert.equal(sent[0]?.subject, "New MECG Speed Dating evaluation");
  assert.match(String(sent[0]?.html), /&lt;Evaluator&gt;/);
  assert.match(String(sent[0]?.html), /&lt;Applicant&gt;/);
  assert.match(String(sent[0]?.html), /Open My Work/);
});

test("deliverNotification rejects a malformed new-template timestamp before sending", async (t) => {
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
  const malformedClaim = {
    id: "notification-malformed",
    recipient: "applicant@example.com",
    templateKey: "SPEED_DATING_INVITATION",
    templateVersion: 1,
    attemptCount: 1,
    idempotencyKey: "speed-dating-invitation:participation-bad",
    applicantName: "Applicant",
    roundName: "Speed Dating",
    roundOpensAt: "not-a-timestamp",
    roundClosesAt: null,
  };
  const client = { rpc: async () => ({ data: malformedClaim, error: null }) };
  const { deliverNotification } = await importNotifications("malformed-speed-dating");
  await assert.rejects(() => deliverNotification(client, malformedClaim.id), /invalid payload/);
  assert.equal(sendCount, 0);
});
