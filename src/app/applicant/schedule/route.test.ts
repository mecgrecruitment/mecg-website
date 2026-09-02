import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";

const USER = { id: "applicant-1", memberships: [] };
const request = (body: unknown) => new NextRequest("http://localhost/applicant/schedule", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const importRoute = (testCase: string) => import(`./route.ts?case=${testCase}`) as Promise<typeof import("./route.ts")>;

test("schedule reschedule validates both slots before the RPC", async (t) => {
  const calls: unknown[] = [];
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => USER } });
  t.mock.module("@/lib/rate-limit", { namedExports: { checkRateLimit: async () => true } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => ({ rpc: async (name: string, args: unknown) => { calls.push({ name, args }); return { data: true, error: null }; } }) } });
  const { POST } = await importRoute("reschedule");
  assert.equal((await POST(request({ action: "RESCHEDULE_RSVP", currentSlotId: "old" }))).status, 400);
  assert.equal(calls.length, 0);
  assert.equal((await POST(request({ action: "RESCHEDULE_RSVP", currentSlotId: "old", nextSlotId: "new" }))).status, 200);
  assert.deepEqual(calls, [{ name: "reschedule_my_event_rsvp", args: { current_slot_id: "old", next_slot_id: "new" } }]);
});

test("schedule cancellation is rate limited before the RPC", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => USER } });
  t.mock.module("@/lib/rate-limit", { namedExports: { checkRateLimit: async () => false } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => { throw new Error("not called"); } } });
  const { POST } = await importRoute("limited");
  assert.equal((await POST(request({ action: "CANCEL_BUDDY", currentSlotId: "slot-1" }))).status, 429);
});
