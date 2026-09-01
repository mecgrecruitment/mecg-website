import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";

type RpcError = { code?: string; message: string };
type RpcResponse = { data: unknown; error: RpcError | null };
type RpcHandlers = Record<string, (args?: Record<string, unknown>) => RpcResponse>;

const FAKE_USER = { id: "applicant-1", email: "ada@umich.edu", name: "Ada", active: true, memberships: [] };

async function importRoute(testCase: string) {
  return import(`./route.ts?case=${testCase}`) as Promise<typeof import("./route.ts")>;
}

function postRequest(body: unknown) {
  return new NextRequest("http://localhost/api/applicant/offer", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function fakeSupabaseClient(handlers: RpcHandlers) {
  const calls: Array<{ name: string; args?: Record<string, unknown> }> = [];
  return {
    calls,
    client: {
      rpc: async (name: string, args?: Record<string, unknown>): Promise<RpcResponse> => {
        calls.push({ name, args });
        const handler = handlers[name];
        if (!handler) throw new Error(`unexpected rpc call: ${name}`);
        return handler(args);
      },
    },
  };
}

test("POST /api/applicant/offer returns 429 without calling the RPC when rate limited", async (t) => {
  const { calls, client } = fakeSupabaseClient({});
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => FAKE_USER } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => client } });
  let checkedBucket: string | undefined;
  t.mock.module("@/lib/rate-limit", { namedExports: { checkRateLimit: async (bucket: string) => { checkedBucket = bucket; return false; } } });
  const { POST } = await importRoute("429");
  const res = await POST(postRequest({ applicationId: "app-1", accept: true }));
  assert.equal(res.status, 429);
  assert.deepEqual(calls, []);
  assert.equal(checkedBucket, `applicant-offer:${FAKE_USER.id}`);
});

test("POST /api/applicant/offer responds when not rate limited", async (t) => {
  const { calls, client } = fakeSupabaseClient({ respond_to_offer: () => ({ data: null, error: null }) });
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => FAKE_USER } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => client } });
  t.mock.module("@/lib/rate-limit", { namedExports: { checkRateLimit: async () => true } });
  const { POST } = await importRoute("success");
  const res = await POST(postRequest({ applicationId: "app-1", accept: true }));
  assert.equal(res.status, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.name, "respond_to_offer");
});
