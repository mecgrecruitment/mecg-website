import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { workspaceCycleFixture } from "@/lib/workspace-cycle-fixture";

// The member poll gates its cohort inside member_hash_live (supabase/tests/member_hash_live.sql).
test("admin live Hash polling honors an authorized older selected cohort and rejects foreign/conflicting selectors", async (t) => {
  const cycles: string[] = [];
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => workspaceCycleFixture } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => ({
    from: () => ({ select: () => ({ eq: (_key: string, cycleId: string) => { cycles.push(cycleId); return { single: async () => ({ data: { hash_presenting_application_id: null }, error: null }) }; } }) }),
    rpc: async (_name: string, args: { target_cycle_id?: string }) => { if (args.target_cycle_id) cycles.push(args.target_cycle_id); return { data: [], error: null }; },
  }) } });
  const path = "./route.ts?case=admin-cohort";
  const { GET } = await import(path) as typeof import("./route");
  assert.equal((await GET(new NextRequest("http://localhost/api/admin/hash/live?cycleId=old-cycle"))).status, 200);
  assert.deepEqual(cycles, ["old-cycle", "old-cycle"]);
  assert.equal((await GET(new NextRequest("http://localhost/api/admin/hash/live?cycleId=foreign-cycle"))).status, 403);
  assert.equal((await GET(new NextRequest("http://localhost/api/admin/hash/live?cycle=old-cycle&cycleId=live-cycle"))).status, 400);
  assert.deepEqual(cycles, ["old-cycle", "old-cycle"], "denied selectors cannot cause data reads");
});
