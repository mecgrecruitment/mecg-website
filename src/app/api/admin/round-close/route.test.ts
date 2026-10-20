import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

type RpcError = { code?: string; message: string };
const ROUND = "round-1";
const CYCLE = "real-cycle";
const summary = {
  roundId: ROUND, roundStatus: "ACTIVE", checkedAt: "2026-10-16T16:00:00.000Z",
  applicants: 3, applicantsReady: 1, applicantsIncomplete: 2,
  submittedEvaluations: 3, validEvaluations: 2, openAssignments: 2,
};
function user(role: string, cycleId = CYCLE) {
  return { id: "operator", memberships: [{ cycleId, role, active: true }] };
}
function request(query = `roundId=${ROUND}`) {
  return new NextRequest(`http://localhost/api/admin/round-close?${query}`);
}
function importRoute(id: string) {
  return import(`./route.ts?case=${id}`) as Promise<typeof import("./route.ts")>;
}
function client({
  round = { id: ROUND, cycle_id: CYCLE }, lookupError = null, rpcData = summary, rpcError = null, throws = false, rpcThrows = false,
}: { round?: { id: string; cycle_id: string } | null; lookupError?: RpcError | null; rpcData?: unknown; rpcError?: RpcError | null; throws?: boolean; rpcThrows?: boolean } = {}) {
  const calls: { name: string; args: unknown }[] = [];
  const reads: { table: string; field: string; value: string }[] = [];
  return {
    calls, reads,
    db: {
      from: (table: string) => ({ select: () => ({ eq: (field: string, value: string) => ({ maybeSingle: async () => {
        reads.push({ table, field, value });
        if (throws) throw new Error("provider secret applicant@example.invalid");
        return { data: round, error: lookupError };
      } }) }) }),
      rpc: async (name: string, args: unknown) => { calls.push({ name, args }); if (rpcThrows) throw new Error("provider secret applicant@example.invalid"); return { data: rpcData, error: rpcError }; },
    },
  };
}

test("round close summary requires a signed-in identity before querying data", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => null } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => { throw new Error("must not query"); } } });
  const { GET } = await importRoute("unauthorized");
  const res = await GET(request());
  assert.equal(res.status, 401);
  assert.equal(res.headers.get("cache-control"), "no-store");
});

test("round close summary rejects missing, repeated, blank and oversized round identifiers", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => user("OWNER") } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => { throw new Error("must not query"); } } });
  const { GET } = await importRoute("invalid");
  for (const query of ["", "roundId=", "roundId=%20", "roundId=a&roundId=b", `roundId=${"a".repeat(201)}`]) assert.equal((await GET(request(query))).status, 400);
});

test("round close summary treats invisible RLS rows as not found", async (t) => {
  const fake = client({ round: null });
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => user("OWNER") } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => fake.db } });
  const { GET } = await importRoute("missing");
  assert.equal((await GET(request())).status, 404);
  assert.deepEqual(fake.calls, []);
});

test("caller cycle claims and panel role cannot authorize closing the round's real cycle", async (t) => {
  for (const actor of [user("OWNER", "claimed-cycle"), user("PANEL"), user("MEMBER"), user("RECRUITMENT_COMMITTEE")]) {
    t.mock.reset();
    const fake = client();
    t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => actor } });
    t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => fake.db } });
    const { GET } = await importRoute(`forbidden-${actor.memberships[0].role}-${actor.memberships[0].cycleId}`);
    assert.equal((await GET(request(`roundId=${ROUND}&cycleId=claimed-cycle`))).status, 403);
    assert.deepEqual(fake.calls, []);
  }
});

test("board gets validated live coverage via the caller client and no-store response", async (t) => {
  const fake = client();
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => user("BOARD") } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => fake.db } });
  const { GET } = await importRoute("allowed");
  const res = await GET(request(`roundId=${ROUND}&cycleId=untrusted`));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.deepEqual(await res.json(), summary);
  assert.deepEqual(fake.reads, [{ table: "rounds", field: "id", value: ROUND }]);
  assert.deepEqual(fake.calls, [{ name: "round_close_summary", args: { target_round_id: ROUND } }]);
});

test("RPC permission recheck and disappearing round remain forbidden/not found", async (t) => {
  for (const [code, status] of [["42501", 403], ["P0002", 404]] as const) {
    t.mock.reset();
    const fake = client({ rpcError: { code, message: "private provider details" } });
    t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => user("OWNER") } });
    t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => fake.db } });
    const { GET } = await importRoute(`rpc-${code}`);
    const res = await GET(request());
    assert.equal(res.status, status);
    assert.doesNotMatch(JSON.stringify(await res.json()), /private provider/);
  }
});

test("lookup, RPC and thrown infrastructure errors expose only generic unavailable responses", async (t) => {
  for (const [name, options] of [
    ["lookup", { lookupError: { code: "XX000", message: "provider secret applicant@example.invalid" } }],
    ["rpc", { rpcError: { code: "XX000", message: "provider secret applicant@example.invalid" } }],
    ["throw", { throws: true }],
    ["rpc-throw", { rpcThrows: true }],
  ] satisfies [string, Parameters<typeof client>[0]][]) {
    t.mock.reset();
    const fake = client(options);
    t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => user("OWNER") } });
    t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => fake.db } });
    const { GET } = await importRoute(`unavailable-${name}`);
    const res = await GET(request());
    assert.equal(res.status, 503);
    assert.deepEqual(await res.json(), { error: "Round readiness is unavailable. Try again." });
    assert.equal(res.headers.get("cache-control"), "no-store");
  }
});

test("malformed or wrong-round summaries cannot be presented as verified coverage", async (t) => {
  for (const [index, data] of [null, { ...summary, roundId: "other-round" }, { ...summary, applicantsReady: -1 }].entries()) {
    t.mock.reset();
    const fake = client({ rpcData: data });
    t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => user("OWNER") } });
    t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => fake.db } });
    const { GET } = await importRoute(`invalid-summary-${index}`);
    assert.equal((await GET(request())).status, 503);
  }
});
