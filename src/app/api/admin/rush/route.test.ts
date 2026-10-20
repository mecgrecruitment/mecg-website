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
const PANEL = {
  ...OWNER, id: "panel-1",
  memberships: [{ ...OWNER.memberships[0], id: "m4", role: "PANEL" }],
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

function client(data: unknown = true) {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  return { calls, value: { rpc: async (name: string, args: Record<string, unknown>) => { calls.push({ name, args }); return { data, error: null }; } } };
}

test("admin account creation enforces Clerk's 8-character password boundary", async (t) => {
  const fake = client("membership-id");
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

test("board can form Group Case teams of a chosen size", async (t) => {
  const fake = client();
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => BOARD } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => fake.value } });
  t.mock.module("@/lib/supabase/admin", { namedExports: { createAdminClient: () => { throw new Error("not called"); } } });
  const { POST } = await route("form-groups");
  const response = await POST(request({ action: "FORM_GROUPS", cycleId: "cycle-1", groupSize: 4 }));
  assert.equal(response.status, 201);
  assert.deepEqual(fake.calls, [{ name: "form_case_groups", args: { target_cycle_id: "cycle-1", group_size: 4 } }]);
});

test("panel cannot form Group Case teams", async (t) => {
  const fake = client();
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => PANEL } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => fake.value } });
  t.mock.module("@/lib/supabase/admin", { namedExports: { createAdminClient: () => { throw new Error("not called"); } } });
  const { POST } = await route("form-groups-forbidden");
  const forbidden = await POST(request({ action: "FORM_GROUPS", cycleId: "cycle-1" }));
  assert.equal(forbidden.status, 403);
  assert.equal(fake.calls.length, 0);
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

test("a rejected membership grant preserves linked access and records restricted recovery", async (t) => {
  const deleted: string[] = [];
  const incidents: Record<string, unknown>[] = [];
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => OWNER } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => ({
    rpc: async () => ({ data: null, error: { code: "42501", message: "denied" } }),
  }) } });
  t.mock.module("@/lib/supabase/admin", { namedExports: { createAdminClient: () => ({
    rpc: async () => ({ data: "app-user-1", error: null }),
    from: (table: string) => { assert.equal(table, "provisioning_incidents"); return { insert: async (row: Record<string, unknown>) => { incidents.push(row); return { error: null }; } }; },
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
  const payload = await response.json();
  assert.match(payload.error, /owner review/);
  assert.match(payload.incidentId, /^[0-9a-f-]{36}$/);
  assert.doesNotMatch(JSON.stringify(payload), /member@example\.com|user_clerk|unreachable/);
  assert.deepEqual(deleted, []);
  assert.equal(payload.remediationRecorded, true);
  assert.equal(incidents[0].email, "member@example.com");
  assert.equal(incidents[0].phase, "MEMBERSHIP_GRANT");
  assert.equal(incidents[0].clerk_user_id, "user_clerk");
  assert.equal(incidents[0].app_user_id, "app-user-1");
  assert.equal(incidents[0].clerk_cleanup_failed, false);
});

test("an uncertain membership grant preserves accounts for reconciliation", async (t) => {
  const deleted: string[] = [];
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => OWNER } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => ({
    rpc: async () => { throw new Error("acknowledgement lost"); },
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
  assert.equal(response.status, 500);
  assert.match((await response.json()).error, /owner review/);
  assert.deepEqual(deleted, []);
});

test("a failed Clerk rollback after ensure_external_identity uses an incident reference", async (t) => {
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
  const payload = await response.json();
  assert.match(payload.error, /owner review/);
  assert.match(payload.incidentId, /^[0-9a-f-]{36}$/);
  assert.doesNotMatch(JSON.stringify(payload), /member@example\.com|user_clerk|unreachable/);
  assert.equal(fake.calls.length, 0);
});

for (const scenario of ["create-unknown", "create-rejected", "identity-unknown", "identity-empty", "identity-denied-clean", "identity-connection", "identity-completion-unknown"] as const) {
  test(`account provisioning handles ${scenario} without unsafe cleanup or identity logs`, async (t) => {
    const stored: Record<string, unknown>[] = [];
    const deleted: string[] = [];
    const logs: unknown[][] = [];
    let grants = 0;
    t.mock.method(console, "error", (...args: unknown[]) => { logs.push(args); });
    t.mock.method(console, "warn", (...args: unknown[]) => { logs.push(args); });
    t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => OWNER } });
    t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => ({ rpc: async () => { grants += 1; return { data: "membership", error: null }; } }) } });
    t.mock.module("@/lib/supabase/admin", { namedExports: { createAdminClient: () => ({
      rpc: async () => {
        if (scenario === "identity-connection" || scenario === "identity-completion-unknown") return { data: null, error: { code: scenario === "identity-connection" ? "08006" : "40003", message: "private-token uncertain commit" } };
        if (scenario === "identity-unknown") throw new Error("private-token provider failed private@example.invalid");
        if (scenario === "identity-denied-clean") return { data: null, error: { code: "23505", message: "private-token private@example.invalid" } };
        return { data: null, error: null };
      },
      from: (table: string) => { assert.equal(table, "provisioning_incidents"); return { insert: async (row: Record<string, unknown>) => { stored.push(row); return { error: null }; } }; },
    }) } });
    t.mock.module("@/lib/env", { namedExports: { requireClerkIssuer: () => "https://test.clerk.accounts.dev", requireEnv: () => "sk_test" } });
    t.mock.module("@clerk/backend", { namedExports: { createClerkClient: () => ({ users: {
      createUser: async () => {
        if (scenario === "create-unknown") throw new Error("private-token private@example.invalid");
        if (scenario === "create-rejected") throw { status: 422, message: "private-token private@example.invalid" };
        return { id: "private-clerk-id" };
      },
      deleteUser: async (id: string) => { deleted.push(id); },
    } }) } });
    const { POST } = await route(scenario);
    const response = await POST(request({ action: "ADD_USER", cycleId: "cycle-1", name: "Private Name", email: "private@example.invalid", password: "private-password", role: "MEMBER" }));
    assert.equal(response.status, scenario === "create-rejected" ? 409 : 500);
    const result = await response.json();
    assert.doesNotMatch(JSON.stringify(result), /private@example|private-clerk|private-password|private-token|Private Name/);
    assert.doesNotMatch(JSON.stringify(logs), /private@example|private-clerk|private-password|private-token|Private Name/);
    assert.equal(grants, 0);
    if (scenario === "create-rejected" || scenario === "identity-denied-clean") assert.equal(stored.length, 0);
    else {
      assert.equal(stored.length, 1);
      assert.equal(stored[0].phase, scenario === "create-unknown" ? "CREATE_ACCOUNT" : "IDENTITY_LINK");
      assert.equal(result.remediationRecorded, true);
    }
    assert.deepEqual(deleted, scenario === "identity-denied-clean" ? ["private-clerk-id"] : []);
  });
}

for (const scenario of ["identity-unknown", "identity-error", "identity-missing", "grant-unknown", "grant-error", "grant-missing", "incident-store-failed", "success"] as const) {
  test(`existing account ${scenario} records opaque recovery without destructive compensation`, async (t) => {
    const incidents: Record<string, unknown>[] = [];
    const logs: unknown[][] = [];
    let grants = 0;
    let deletes = 0;
    t.mock.method(console, "error", (...args: unknown[]) => { logs.push(args); });
    t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => OWNER } });
    t.mock.module("@/lib/env", { namedExports: { requireClerkIssuer: () => "https://test.clerk.accounts.dev", requireEnv: () => "sk_test" } });
    t.mock.module("@clerk/backend", { namedExports: { createClerkClient: () => ({ users: {
      getUserList: async () => ({ data: [{ id: "private-existing-clerk", firstName: "Private", lastName: "Person", username: null, externalId: null, emailAddresses: [{ emailAddress: "private@example.invalid" }] }] }),
      deleteUser: async () => { deletes += 1; },
    } }) } });
    t.mock.module("@/lib/supabase/admin", { namedExports: { createAdminClient: () => ({
      rpc: async () => {
        if (scenario === "identity-unknown") throw new Error("private-provider-token");
        if (scenario === "identity-error") return { data: null, error: { code: "57014", message: "private-provider-token" } };
        return { data: scenario === "identity-missing" ? null : "00000000-0000-4000-8000-000000000111", error: null };
      },
      from: (table: string) => { assert.equal(table, "provisioning_incidents"); return { insert: async (row: Record<string, unknown>) => { incidents.push(row); if (scenario === "incident-store-failed") throw new Error("private@example.invalid"); return { error: null }; } }; },
    }) } });
    t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => ({ rpc: async (name: string) => {
      assert.equal(name, "grant_membership"); grants += 1;
      if (scenario === "grant-unknown") throw new Error("private-provider-token");
      return { data: scenario === "grant-missing" ? null : "membership-id", error: scenario === "success" || scenario === "grant-missing" ? null : { code: "57014", message: "private-provider-token" } };
    } }) } });
    const { POST } = await route(`existing-${scenario}`);
    const response = await POST(request({ action: "ADD_EXISTING_USER", cycleId: "cycle-1", email: "private@example.invalid", role: "MEMBER" }));
    assert.equal(response.status, scenario === "success" ? 201 : 500);
    const result = await response.json();
    if (scenario === "success") {
      assert.equal(result.id, "membership-id");
      assert.equal(incidents.length, 0); assert.equal(grants, 1); assert.equal(deletes, 0);
      return;
    }
    assert.equal(result.remediationRecorded, scenario !== "incident-store-failed");
    assert.match(result.incidentId, /^[0-9a-f-]{36}$/);
    assert.equal(incidents.length, 1);
    assert.equal(incidents[0]?.phase, scenario.startsWith("identity") ? "IDENTITY_LINK" : "MEMBERSHIP_GRANT");
    assert.equal(grants, scenario.startsWith("identity") ? 0 : 1);
    assert.equal(deletes, 0);
    assert.doesNotMatch(JSON.stringify(result), /private@example|private-existing|private-provider|Private Person|000000000111/);
    assert.doesNotMatch(JSON.stringify(logs), /private@example|private-existing|private-provider|Private Person|000000000111/);
  });
}

test("new account missing membership receipt preserves partial access and records recovery", async (t) => {
  const incidents: Record<string, unknown>[] = [];
  let deletes = 0;
  t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => OWNER } });
  t.mock.module("@/lib/env", { namedExports: { requireClerkIssuer: () => "https://test.clerk.accounts.dev", requireEnv: () => "sk_test" } });
  t.mock.module("@clerk/backend", { namedExports: { createClerkClient: () => ({ users: { createUser: async () => ({ id: "synthetic-clerk" }), deleteUser: async () => { deletes += 1; } } }) } });
  t.mock.module("@/lib/supabase/admin", { namedExports: { createAdminClient: () => ({
    rpc: async () => ({ data: "00000000-0000-4000-8000-000000000111", error: null }),
    from: () => ({ insert: async (row: Record<string, unknown>) => { incidents.push(row); return { error: null }; } }),
  }) } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => ({ rpc: async () => ({ data: null, error: null }) }) } });
  const { POST } = await route("new-empty-membership-receipt");
  const response = await POST(request({ action: "ADD_USER", cycleId: "cycle-1", email: "synthetic@example.invalid", name: "Synthetic Person", password: "synthetic-password", role: "MEMBER" }));
  assert.equal(response.status, 500);
  const body = await response.json();
  assert.equal(body.remediationRecorded, true);
  assert.equal(incidents[0]?.phase, "MEMBERSHIP_GRANT");
  assert.equal(deletes, 0);
  assert.doesNotMatch(JSON.stringify(body), /synthetic@example|synthetic-password|synthetic-clerk/);
});

for (const acknowledgement of ["new-text-rubric-id", null, "", { ok: true }]) {
  test(`rubric save acknowledges the authorized target only with an actual rubric ID: ${JSON.stringify(acknowledgement)}`, async (t) => {
    const fake = client(acknowledgement);
    t.mock.module("server-only", { namedExports: {} });
    t.mock.module("@/lib/supabase/admin", { namedExports: { createAdminClient: () => ({}) } });
    t.mock.module("@/lib/env", { namedExports: { requireClerkIssuer: () => "https://test.clerk.accounts.dev", requireEnv: () => "sk_test" } });
    t.mock.module("@/lib/auth", { namedExports: { currentUser: async () => BOARD } });
    t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => fake.value } });
    const { POST } = await route(`rubric-receipt-${JSON.stringify(acknowledgement)}`);
    const response = await POST(request({ action: "SET_RUBRIC_CRITERIA", cycleId: "cycle-1", roundId: "round-1", criteria: [] }));
    assert.deepEqual(fake.calls, [{ name: "set_rubric_criteria", args: { target_round_id: "round-1", criteria: [] } }]);
    if (typeof acknowledgement === "string" && acknowledgement) {
      assert.equal(response.status, 201);
      assert.deepEqual(await response.json(), { id: acknowledgement, roundId: "round-1" });
    } else {
      assert.equal(response.status, 500);
      assert.match((await response.json()).error, /may already be saved/);
    }
  });
}
