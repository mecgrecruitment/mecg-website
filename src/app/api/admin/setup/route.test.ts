import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";

type RpcError = { code?: string; message: string };
type RpcResponse = { data: unknown; error: RpcError | null };
type RpcHandlers = Record<string, (args?: Record<string, unknown>) => RpcResponse>;

const OWNER_USER = {
  id: "owner-1",
  email: "owner@umich.edu",
  name: "Owner",
  active: true,
  memberships: [{ id: "m1", cycleId: "cycle-1", role: "OWNER", active: true, cycle: { id: "cycle-1", name: "Fall", status: "OPEN", createdAt: new Date() } }],
};

const BOARD_USER = {
  id: "board-1",
  email: "board@umich.edu",
  name: "Board",
  active: true,
  memberships: [{ id: "m2", cycleId: "cycle-1", role: "BOARD", active: true, cycle: { id: "cycle-1", name: "Fall", status: "OPEN", createdAt: new Date() } }],
};

const NO_MEMBERSHIP_USER = { id: "bare-1", email: "bare@umich.edu", name: "Bare", active: true, memberships: [] };

async function importRoute(testCase: string) {
  const specifier = `./route.ts?case=${testCase}`;
  return import(specifier) as Promise<typeof import("./route.ts")>;
}

function postRequest(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost/api/admin/setup", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
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

test("POST /api/admin/setup returns 401 when unauthenticated", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => null } });
  t.mock.module("@/lib/supabase/server", {
    namedExports: { createClient: async () => { throw new Error("createClient should not be called"); } },
  });
  const { POST } = await importRoute("401");
  const res = await POST(postRequest({ name: "Winter 2027" }));
  assert.equal(res.status, 401);
});

test("POST /api/admin/setup returns 403 for an authenticated user with no OWNER membership anywhere", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => BOARD_USER } });
  t.mock.module("@/lib/supabase/server", {
    namedExports: { createClient: async () => { throw new Error("createClient should not be called"); } },
  });
  const { POST } = await importRoute("403-board");
  const res = await POST(postRequest({ name: "Winter 2027" }));
  assert.equal(res.status, 403);
  assert.equal((await res.json()).error, "Forbidden");
});

test("POST /api/admin/setup returns 403 for a bare authenticated user with zero memberships", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => NO_MEMBERSHIP_USER } });
  t.mock.module("@/lib/supabase/server", {
    namedExports: { createClient: async () => { throw new Error("createClient should not be called"); } },
  });
  const { POST } = await importRoute("403-bare");
  const res = await POST(postRequest({ name: "Winter 2027" }));
  assert.equal(res.status, 403);
});

test("POST /api/admin/setup rejects payloads over the 2 KiB cap before parsing", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => OWNER_USER } });
  t.mock.module("@/lib/supabase/server", {
    namedExports: { createClient: async () => { throw new Error("createClient should not be called"); } },
  });
  const { POST } = await importRoute("413");
  const request = postRequest({ name: "Winter 2027" }, { "content-length": String(2 * 1024 + 1) });
  t.mock.method(request, "json", async () => { throw new Error("json should not be read"); });
  const res = await POST(request);
  assert.equal(res.status, 413);
  assert.equal((await res.json()).error, "Payload is too large");
});

test("POST /api/admin/setup creates a cycle for an OWNER", async (t) => {
  const { calls, client } = fakeSupabaseClient({
    create_cycle: () => ({ data: "cycle-99", error: null }),
  });
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => OWNER_USER } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => client } });
  const { POST } = await importRoute("success");
  const res = await POST(postRequest({ name: "Winter 2027" }));
  assert.equal(res.status, 201);
  assert.deepEqual(await res.json(), { id: "cycle-99" });
  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.name, "create_cycle");
});
