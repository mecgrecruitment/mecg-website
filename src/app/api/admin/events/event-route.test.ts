import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";

const BOARD = {
  id: "board-1", email: "board@umich.edu", name: "Board", active: true,
  memberships: [{ id: "m1", cycleId: "cycle-1", role: "BOARD", active: true, cycle: { id: "cycle-1", name: "Fall", status: "IN_PROCESS", createdAt: new Date() } }],
};

test("PATCH rejects moving a published event into the past before calling the RPC", async (t) => {
  let rpcCalls = 0;
  const query = {
    select() { return this; },
    eq() { return this; },
    async maybeSingle() { return { data: { cycle_id: "cycle-1", status: "PUBLISHED", starts_at: "2030-09-10T22:00:00.000Z" }, error: null }; },
  };
  const client = { from: () => query, rpc: async () => { rpcCalls += 1; return { data: null, error: null }; } };
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => BOARD } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => client } });
  const specifier = "./[id]/route.ts?case=past";
  const { PATCH } = await import(specifier) as typeof import("./[id]/route.ts");
  const request = new NextRequest("http://localhost/api/admin/events/event-1", {
    method: "PATCH", headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Mixer", kind: "MIXER", visibility: "PUBLIC", location: "Ross",
      startsAt: "2020-09-10T22:00:00.000Z", endsAt: "2020-09-10T23:00:00.000Z",
      checkinOpensAt: "2020-09-10T21:45:00.000Z", checkinClosesAt: "2020-09-10T23:15:00.000Z" }),
  });
  const response = await PATCH(request, { params: Promise.resolve({ id: "event-1" }) });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "A published event cannot be moved into the past");
  assert.equal(rpcCalls, 0);
});

test("PATCH rejects an impossible calendar date before calling the RPC", async (t) => {
  let rpcCalls = 0;
  const query = {
    select() { return this; },
    eq() { return this; },
    async maybeSingle() { return { data: { cycle_id: "cycle-1", status: "DRAFT", starts_at: "2030-09-10T22:00:00.000Z" }, error: null }; },
  };
  const client = { from: () => query, rpc: async () => { rpcCalls += 1; return { data: null, error: null }; } };
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => BOARD } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => client } });
  const specifier = "./[id]/route.ts?case=impossible-date";
  const { PATCH } = await import(specifier) as typeof import("./[id]/route.ts");
  const request = new NextRequest("http://localhost/api/admin/events/event-1", {
    method: "PATCH", headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Mixer", kind: "MIXER", visibility: "PUBLIC", location: "Ross",
      startsAt: "2030-02-30T22:00:00.000Z", endsAt: "2030-03-01T23:00:00.000Z",
      checkinOpensAt: "2030-03-01T21:45:00.000Z", checkinClosesAt: "2030-03-01T23:15:00.000Z" }),
  });
  const response = await PATCH(request, { params: Promise.resolve({ id: "event-1" }) });
  assert.equal(response.status, 400);
  assert.equal(rpcCalls, 0);
});
