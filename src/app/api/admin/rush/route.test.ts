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
const COMMITTEE = {
  ...OWNER, id: "committee-1",
  memberships: [{ ...OWNER.memberships[0], id: "m3", role: "RECRUITMENT_COMMITTEE" }],
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

test("admin account creation enforces Clerk's 8-character password boundary", async (t) => {
  const fake = client();
  const createdPasswords: string[] = [];
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => OWNER } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => fake.value } });
  t.mock.module("@/lib/supabase/admin", { namedExports: { createAdminClient: () => ({
    rpc: async () => ({ data: "app-user-1", error: null }),
    from: () => ({ delete: () => ({ eq: async () => ({ error: null }) }) }),
  }) } });
  t.mock.module("@/lib/env", { namedExports: {
    requireClerkIssuer: () => "https://test.clerk.accounts.dev",
    requireEnv: () => "sk_test",
  } });
  t.mock.module("@clerk/backend", { namedExports: { createClerkClient: () => ({ users: {
    createUser: async ({ password }: { password: string }) => {
      createdPasswords.push(password);
      return { id: "user_clerk" };
    },
    deleteUser: async () => undefined,
  } }) } });
  const { POST } = await route("clerk-password-boundary");

  const tooShort = await POST(request({
    action: "ADD_USER",
    cycleId: "cycle-1",
    name: "Test Member",
    email: "member@example.com",
    password: "a".repeat(7),
    role: "MEMBER",
  }));
  assert.equal(tooShort.status, 400);
  assert.match((await tooShort.json()).error, /8/);
  assert.deepEqual(createdPasswords, []);

  const accepted = await POST(request({
    action: "ADD_USER",
    cycleId: "cycle-1",
    name: "Test Member",
    email: "member@example.com",
    password: "a".repeat(8),
    role: "MEMBER",
  }));
  assert.equal(accepted.status, 201);
  assert.deepEqual(createdPasswords, ["a".repeat(8)]);
});

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

test("board can atomically advance a distinct applicant cohort to Speed Dating", async (t) => {
  const fake = client();
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => BOARD } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => fake.value } });
  t.mock.module("@/lib/supabase/admin", { namedExports: { createAdminClient: () => { throw new Error("not called"); } } });
  const { POST } = await route("advance-speed-dating");
  const response = await POST(request({
    action: "ADVANCE_SPEED_DATING",
    cycleId: "cycle-1",
    applicationIds: ["application-1", "application-2"],
  }));
  assert.equal(response.status, 201);
  assert.deepEqual(fake.calls, [{
    name: "advance_to_speed_dating",
    args: { target_cycle_id: "cycle-1", target_application_ids: ["application-1", "application-2"] },
  }]);
});

test("committee cannot advance applicants", async (t) => {
  const fake = client();
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => COMMITTEE } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => fake.value } });
  t.mock.module("@/lib/supabase/admin", { namedExports: { createAdminClient: () => { throw new Error("not called"); } } });
  const { POST } = await route("advance-speed-dating-forbidden");
  const forbidden = await POST(request({ action: "ADVANCE_SPEED_DATING", cycleId: "cycle-1", applicationIds: ["application-1"] }));
  assert.equal(forbidden.status, 403);
  assert.equal(fake.calls.length, 0);
});

test("board publishes only distinct two-person Speed Dating pairs", async (t) => {
  const fake = client();
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => BOARD } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => fake.value } });
  t.mock.module("@/lib/supabase/admin", { namedExports: { createAdminClient: () => { throw new Error("not called"); } } });
  const { POST } = await route("publish-speed-dating-pairs");
  const pairs = [
    { applicationIds: ["application-1", "application-2"] },
    { applicationIds: ["application-3", "application-4"] },
  ];
  const response = await POST(request({
    action: "SET_SPEED_DATING_PAIRS",
    cycleId: "cycle-1",
    roundId: "round-1",
    pairs,
    publish: true,
  }));
  assert.equal(response.status, 201);
  assert.deepEqual(fake.calls, [{
    name: "replace_speed_dating_pairs",
    args: { target_round_id: "round-1", submitted_pairs: pairs, publish_pairs: true },
  }]);

  const duplicate = await POST(request({
    action: "SET_SPEED_DATING_PAIRS",
    cycleId: "cycle-1",
    roundId: "round-1",
    pairs: [{ applicationIds: ["application-1", "application-1"] }],
  }));
  assert.equal(duplicate.status, 400);
  assert.equal(fake.calls.length, 1);
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

test("board can set a validated application window through the audited RPC", async (t) => {
  const fake = client();
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => BOARD } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => fake.value } });
  t.mock.module("@/lib/supabase/admin", { namedExports: { createAdminClient: () => { throw new Error("not called"); } } });
  const { POST } = await route("cycle-window");
  const response = await POST(request({
    action: "SET_CYCLE_WINDOW",
    cycleId: "cycle-1",
    opensAt: "2026-09-08T23:30:00.000Z",
    closesAt: "2026-09-11T15:00:00.000Z",
  }));
  assert.equal(response.status, 201);
  assert.deepEqual(fake.calls, [{
    name: "set_cycle_application_window",
    args: {
      target_cycle_id: "cycle-1",
      application_opens_at: "2026-09-08T23:30:00.000Z",
      application_closes_at: "2026-09-11T15:00:00.000Z",
    },
  }]);
});

test("application window rejects malformed or reversed dates before the RPC", async (t) => {
  const fake = client();
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => BOARD } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => fake.value } });
  t.mock.module("@/lib/supabase/admin", { namedExports: { createAdminClient: () => { throw new Error("not called"); } } });
  const { POST } = await route("cycle-window-invalid");
  const response = await POST(request({
    action: "SET_CYCLE_WINDOW",
    cycleId: "cycle-1",
    opensAt: "2026-09-11T15:00:00.000Z",
    closesAt: "not-a-date",
  }));
  assert.equal(response.status, 400);
  assert.equal(fake.calls.length, 0);
});

test("RSVP slots require offset-aware ordered times and a bounded integer capacity", async (t) => {
  const fake = client();
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => BOARD } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => fake.value } });
  t.mock.module("@/lib/supabase/admin", { namedExports: { createAdminClient: () => { throw new Error("not called"); } } });
  const { POST } = await route("slot-boundary");

  const offsetless = await POST(request({
    action: "CREATE_SLOT",
    cycleId: "cycle-1",
    eventId: "event-1",
    startsAt: "2026-09-10T18:00",
    endsAt: "2026-09-10T18:30",
    capacity: 8,
  }));
  assert.equal(offsetless.status, 400);

  const fractionalCapacity = await POST(request({
    action: "CREATE_SLOT",
    cycleId: "cycle-1",
    eventId: "event-1",
    startsAt: "2026-09-10T22:00:00.000Z",
    endsAt: "2026-09-10T22:30:00.000Z",
    capacity: 8.5,
  }));
  assert.equal(fractionalCapacity.status, 400);
  assert.equal(fake.calls.length, 0);

  const accepted = await POST(request({
    action: "CREATE_SLOT",
    cycleId: "cycle-1",
    eventId: "event-1",
    startsAt: "2026-09-10T22:00:00.000Z",
    endsAt: "2026-09-10T22:30:00.000Z",
    capacity: 8,
  }));
  assert.equal(accepted.status, 201);
  assert.deepEqual(fake.calls, [{
    name: "create_event_slot",
    args: {
      target_event_id: "event-1",
      slot_starts_at: "2026-09-10T22:00:00.000Z",
      slot_ends_at: "2026-09-10T22:30:00.000Z",
      slot_capacity: 8,
    },
  }]);
});

test("a failed Clerk rollback after grant_membership names the orphaned account", async (t) => {
  const deleted: string[] = [];
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => OWNER } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => ({
    rpc: async () => ({ data: null, error: { code: "42501", message: "denied" } }),
  }) } });
  t.mock.module("@/lib/supabase/admin", { namedExports: { createAdminClient: () => ({
    rpc: async () => ({ data: "app-user-1", error: null }),
    from: () => ({ delete: () => ({ eq: async () => ({ error: null }) }) }),
  }) } });
  t.mock.module("@/lib/env", { namedExports: {
    requireClerkIssuer: () => "https://test.clerk.accounts.dev",
    requireEnv: () => "sk_test",
  } });
  t.mock.module("@clerk/backend", { namedExports: { createClerkClient: () => ({ users: {
    createUser: async () => ({ id: "user_clerk" }),
    deleteUser: async (id: string) => { deleted.push(id); throw new Error("clerk unreachable"); },
  } }) } });
  const { POST } = await route("grant-rollback-failed");
  const response = await POST(request({
    action: "ADD_USER", cycleId: "cycle-1", name: "Test Member",
    email: "member@example.com", password: "a".repeat(8), role: "MEMBER",
  }));
  assert.equal(response.status, 500);
  const { error } = await response.json();
  assert.match(error, /member@example\.com/);
  assert.match(error, /Clerk/);
  assert.deepEqual(deleted, ["user_clerk"]);
});

test("a successful rollback after grant_membership still reports the RPC's own error", async (t) => {
  const deleted: string[] = [];
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => OWNER } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => ({
    rpc: async () => ({ data: null, error: { code: "42501", message: "denied" } }),
  }) } });
  t.mock.module("@/lib/supabase/admin", { namedExports: { createAdminClient: () => ({
    rpc: async () => ({ data: "app-user-1", error: null }),
    from: () => ({ delete: () => ({ eq: async () => ({ error: null }) }) }),
  }) } });
  t.mock.module("@/lib/env", { namedExports: {
    requireClerkIssuer: () => "https://test.clerk.accounts.dev",
    requireEnv: () => "sk_test",
  } });
  t.mock.module("@clerk/backend", { namedExports: { createClerkClient: () => ({ users: {
    createUser: async () => ({ id: "user_clerk" }),
    deleteUser: async (id: string) => { deleted.push(id); },
  } }) } });
  const { POST } = await route("grant-rollback-succeeded");
  const response = await POST(request({
    action: "ADD_USER", cycleId: "cycle-1", name: "Test Member",
    email: "member@example.com", password: "a".repeat(8), role: "MEMBER",
  }));
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: "Request could not be completed" });
  assert.deepEqual(deleted, ["user_clerk"]);
});

test("a failed Clerk rollback after ensure_external_identity names the orphaned account", async (t) => {
  const fake = client();
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => OWNER } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => fake.value } });
  t.mock.module("@/lib/supabase/admin", { namedExports: { createAdminClient: () => ({
    rpc: async () => ({ data: null, error: { code: "23505", message: "duplicate identity" } }),
    from: () => { throw new Error("not called"); },
  }) } });
  t.mock.module("@/lib/env", { namedExports: {
    requireClerkIssuer: () => "https://test.clerk.accounts.dev",
    requireEnv: () => "sk_test",
  } });
  t.mock.module("@clerk/backend", { namedExports: { createClerkClient: () => ({ users: {
    createUser: async () => ({ id: "user_clerk" }),
    deleteUser: async () => { throw new Error("clerk unreachable"); },
  } }) } });
  const { POST } = await route("identity-rollback-failed");
  const response = await POST(request({
    action: "ADD_USER", cycleId: "cycle-1", name: "Test Member",
    email: "member@example.com", password: "a".repeat(8), role: "MEMBER",
  }));
  assert.equal(response.status, 500);
  const { error } = await response.json();
  assert.match(error, /member@example\.com/);
  assert.match(error, /Clerk/);
  assert.equal(fake.calls.length, 0);
});
