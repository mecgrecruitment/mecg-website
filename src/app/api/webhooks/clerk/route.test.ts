import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

const ISSUER = "https://test.clerk.accounts.dev";

async function importRoute(label: string) {
  return import(`./route.ts?case=${label}`) as Promise<typeof import("./route.ts")>;
}

function mockCommon(t: test.TestContext, event: object, calls: Array<{ name: string; args: object }>) {
  t.mock.module("@clerk/nextjs/webhooks", { namedExports: { verifyWebhook: async () => event } });
  t.mock.module("@/lib/env", { namedExports: {
    requireClerkIssuer: () => ISSUER,
    requireClerkWebhookSigningSecret: () => "whsec_test",
  } });
  t.mock.module("@/lib/supabase/admin", { namedExports: { createAdminClient: () => ({
    rpc: async (name: string, args: object) => { calls.push({ name, args }); return { data: "APPLIED", error: null }; },
  }) } });
}

function request(eventId = "evt_test", timestamp = "1788379200") {
  return new NextRequest("http://localhost/api/webhooks/clerk", {
    method: "POST",
    headers: { "svix-id": eventId, "svix-timestamp": timestamp },
  });
}

test("created migration users are reconciled through the prepared UUID ledger", async (t) => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  mockCommon(t, {
    type: "user.created",
    data: {
      id: "user_clerk", primary_email_address_id: "email_1",
      email_addresses: [{ id: "email_1", email_address: "Person@Example.com" }],
      first_name: "Test", last_name: "Person", username: null,
      external_id: "10000000-0000-4000-8000-000000000001",
    },
  }, calls);
  const { POST } = await importRoute("created");
  const response = await POST(request("evt_created"));
  assert.equal(response.status, 200);
  assert.deepEqual(calls, [{ name: "reconcile_clerk_webhook", args: {
    webhook_event_id: "evt_created", webhook_event_type: "user.created",
    webhook_occurred_at: "2026-09-02T20:00:00.000Z",
    identity_issuer: ISSUER, identity_subject: "user_clerk", identity_email: "Person@Example.com",
    identity_display_name: "Test Person", existing_app_user_id: "10000000-0000-4000-8000-000000000001",
  } }]);
});

test("deletion disables only the Clerk identity mapping", async (t) => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  mockCommon(t, { type: "user.deleted", data: { id: "user_deleted" } }, calls);
  const { POST } = await importRoute("deleted");
  const response = await POST(request("evt_deleted"));
  assert.equal(response.status, 200);
  assert.deepEqual(calls, [{ name: "reconcile_clerk_webhook", args: {
    webhook_event_id: "evt_deleted", webhook_event_type: "user.deleted",
    webhook_occurred_at: "2026-09-02T20:00:00.000Z",
    identity_issuer: ISSUER, identity_subject: "user_deleted", identity_email: null,
    identity_display_name: null, existing_app_user_id: null,
  } }]);
});

test("supported events require signed delivery identity and timestamp metadata", async (t) => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  mockCommon(t, { type: "user.deleted", data: { id: "user_deleted" } }, calls);
  const { POST } = await importRoute("missing-delivery-metadata");
  const response = await POST(new NextRequest("http://localhost/api/webhooks/clerk", { method: "POST" }));
  assert.equal(response.status, 400);
  assert.deepEqual(calls, []);
});
