import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";

const membership = (role: string) => ({ id: "m1", cycleId: "cycle-1", role, active: true, cycle: { id: "cycle-1", name: "Fall", status: "IN_PROCESS", createdAt: new Date() } });
const request = (body: unknown) => new NextRequest("http://localhost/admin/people/onboarding", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const loadRoute = (testCase: string) => import(`./route.ts?case=${testCase}`) as Promise<typeof import("./route.ts")>;

test("only Board or Owner can mutate onboarding", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => ({ id: "member-1", memberships: [membership("MEMBER")] }) } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => { throw new Error("not called"); } } });
  const { POST } = await loadRoute("forbidden");
  const response = await POST(request({ action: "SET_COMPLETION", cycleId: "cycle-1", applicationId: "app-1", itemKey: "ORIENTATION", value: true }));
  assert.equal(response.status, 403);
});

test("Board completion uses the audited completion RPC", async (t) => {
  const calls: unknown[] = [];
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => ({ id: "board-1", memberships: [membership("BOARD")] }) } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => ({ rpc: async (name: string, args: unknown) => { calls.push({ name, args }); return { data: true, error: null }; } }) } });
  const { POST } = await loadRoute("completion");
  const response = await POST(request({ action: "SET_COMPLETION", cycleId: "cycle-1", applicationId: "app-1", itemKey: "ORIENTATION", value: true }));
  assert.equal(response.status, 200);
  assert.deepEqual(calls, [{ name: "set_member_onboarding_completion", args: { target_application_id: "app-1", target_item_key: "ORIENTATION", complete: true } }]);
});
