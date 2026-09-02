import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";

const USER = { id: "applicant-1", memberships: [] };
const request = (body: unknown) => new NextRequest("http://localhost/applicant/onboarding", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const loadRoute = (testCase: string) => import(`./route.ts?case=${testCase}`) as Promise<typeof import("./route.ts")>;

test("applicant onboarding allows only self-completable fixed items", async (t) => {
  const calls: unknown[] = [];
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => USER } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => ({ rpc: async (name: string, args: unknown) => { calls.push({ name, args }); return { data: true, error: null }; } }) } });
  const { POST } = await loadRoute("self-items");
  const blocked = await POST(request({ applicationId: "app-1", itemKey: "BOARD_HANDOFF", complete: true }));
  assert.equal(blocked.status, 400);
  assert.equal(calls.length, 0);
  const accepted = await POST(request({ applicationId: "app-1", itemKey: "CONTACT_CONFIRMATION", complete: true }));
  assert.equal(accepted.status, 200);
  assert.deepEqual(calls, [{ name: "set_my_onboarding_item", args: { target_application_id: "app-1", target_item_key: "CONTACT_CONFIRMATION", complete: true } }]);
});
