import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

function request(body: unknown) {
  return new NextRequest("http://localhost/api/member/impressions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function route(testCase: string) {
  return import(`./route.ts?case=${testCase}`) as Promise<typeof import("./route.ts")>;
}

function validBody() {
  return {
    eventId: "event-1",
    applicationId: "application-1",
    tags: ["Shared a project example"],
    note: "Described their role and the project context.",
  };
}

test("event observations reject the retired numeric score contract", async (t) => {
  let rpcCalls = 0;
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => ({ id: "member-1" }) } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => ({}) } });
  t.mock.module("@/lib/screening-rpc", { namedExports: { screeningRpc: async () => { rpcCalls += 1; return { data: "id", error: null }; } } });
  const { POST } = await route("numeric-rejected");
  const response = await POST(request({ ...validBody(), score: 5 }));
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "Numeric event scores are no longer accepted");
  assert.equal(rpcCalls, 0);
});

test("event observations accept only the neutral tag vocabulary", async (t) => {
  let rpcCalls = 0;
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => ({ id: "member-1" }) } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => ({}) } });
  t.mock.module("@/lib/screening-rpc", { namedExports: { screeningRpc: async () => { rpcCalls += 1; return { data: "id", error: null }; } } });
  const { POST } = await route("neutral-tags");
  assert.equal((await POST(request({ ...validBody(), tags: ["Great energy"] }))).status, 400);
  assert.equal((await POST(request({ ...validBody(), tags: [], note: "   " }))).status, 400);
  assert.equal(rpcCalls, 0);
});

test("event observations call the qualitative RPC without scoring fields", async (t) => {
  const calls: Array<{ name: string; args?: Record<string, unknown> }> = [];
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => ({ id: "member-1" }) } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => ({ rpc: async () => ({ data: null, error: null }) }) } });
  t.mock.module("@/lib/screening-rpc", { namedExports: {
    screeningRpc: async (_client: unknown, name: string, args?: Record<string, unknown>) => {
      calls.push({ name, args });
      return { data: "observation-1", error: null };
    },
  } });
  const { POST } = await route("qualitative-success");
  const response = await POST(request(validBody()));
  assert.equal(response.status, 201);
  assert.deepEqual(calls, [{
    name: "submit_event_observation",
    args: {
      target_event_id: "event-1",
      target_application_id: "application-1",
      observation_tags: ["Shared a project example"],
      observation_note: "Described their role and the project context.",
    },
  }]);
  assert.equal("score" in (calls[0]?.args ?? {}), false);
});
