import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";

const OWNER = {
  id: "owner-1", email: "owner@umich.edu", name: "Owner", active: true,
  memberships: [{ id: "m1", cycleId: "cycle-1", role: "OWNER", active: true, cycle: { id: "cycle-1", name: "Fall", status: "IN_PROCESS", createdAt: new Date() } }],
};
const BOARD = {
  ...OWNER, id: "board-1",
  memberships: [{ ...OWNER.memberships[0], id: "m2", role: "BOARD" }],
};

function request(body: unknown) {
  return new NextRequest("http://localhost/api/admin/rush", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

async function route(testCase: string) {
  return import(`./route.ts?case=${testCase}`) as Promise<typeof import("./route.ts")>;
}

function client() {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  return { calls, value: { rpc: async (name: string, args: Record<string, unknown>) => { calls.push({ name, args }); return { data: true, error: null }; } } };
}

test("owner can deactivate a cycle membership with an audit reason", async (t) => {
  const fake = client();
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => OWNER } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => fake.value } });
  t.mock.module("@/lib/supabase/admin", { namedExports: { createAdminClient: () => { throw new Error("not called"); } } });
  const { POST } = await route("deactivate");
  const response = await POST(request({ action: "DEACTIVATE_MEMBERSHIP", cycleId: "cycle-1", userId: "member-1", reason: "Left the chapter" }));
  assert.equal(response.status, 201);
  assert.deepEqual(fake.calls, [{ name: "deactivate_cycle_membership", args: { target_user_id: "member-1", target_cycle_id: "cycle-1", revocation_reason: "Left the chapter" } }]);
});

test("board cannot deactivate a membership", async (t) => {
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => BOARD } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => { throw new Error("not called"); } } });
  t.mock.module("@/lib/supabase/admin", { namedExports: { createAdminClient: () => { throw new Error("not called"); } } });
  const { POST } = await route("deactivate-forbidden");
  const response = await POST(request({ action: "DEACTIVATE_MEMBERSHIP", cycleId: "cycle-1", userId: "member-1", reason: "Left" }));
  assert.equal(response.status, 403);
});

test("board can unassign an untouched evaluator assignment", async (t) => {
  const fake = client();
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => BOARD } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => fake.value } });
  t.mock.module("@/lib/supabase/admin", { namedExports: { createAdminClient: () => { throw new Error("not called"); } } });
  const { POST } = await route("unassign");
  const response = await POST(request({ action: "UNASSIGN", cycleId: "cycle-1", assignmentId: "assignment-1" }));
  assert.equal(response.status, 201);
  assert.equal(fake.calls[0]?.name, "unassign_evaluator");
});

test("reassignment requires both assignment and replacement evaluator", async (t) => {
  const fake = client();
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => BOARD } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => fake.value } });
  t.mock.module("@/lib/supabase/admin", { namedExports: { createAdminClient: () => { throw new Error("not called"); } } });
  const { POST } = await route("reassign-invalid");
  const response = await POST(request({ action: "REASSIGN", cycleId: "cycle-1", assignmentId: "assignment-1" }));
  assert.equal(response.status, 400);
  assert.equal(fake.calls.length, 0);
});
