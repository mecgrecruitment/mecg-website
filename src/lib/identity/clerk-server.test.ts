import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";

const ISSUER = "https://clerk.mecg.test";
const SESSION = { userId: "user_2clerk", sessionClaims: { iss: `${ISSUER}/`, sub: "user_2clerk" } };
const CLERK_USER = {
  id: "user_2clerk",
  firstName: "Riley",
  lastName: "Board",
  username: null,
  primaryEmailAddressId: "idn_1",
  emailAddresses: [{ id: "idn_1", emailAddress: "Riley.Board@umich.edu" }],
};

type Result = { data: unknown; error: unknown };

// Chainable enough for .select().eq().in().order().limit().maybeSingle().
// When `rows` is supplied the builder actually applies the recorded ordering,
// so a test can prove which of several duplicate rows the query picks.
function table(result: Result, rows?: Array<Record<string, unknown>>) {
  const builder: Record<string, unknown> = {};
  let order: { column: string; ascending: boolean } | null = null;
  for (const method of ["select", "eq", "in", "limit"]) builder[method] = () => builder;
  builder.order = (column: string, options?: { ascending?: boolean }) => {
    order = { column, ascending: options?.ascending !== false };
    return builder;
  };
  builder.maybeSingle = async () => {
    if (!rows) return result;
    const column = order?.column ?? "";
    const direction = order?.ascending === false ? -1 : 1;
    const sorted = [...rows].sort((a, b) => String(a[column]).localeCompare(String(b[column])) * direction);
    return { data: sorted[0] ?? null, error: null };
  };
  return builder;
}

function importModule(testCase: string) {
  return import(`./clerk-server.ts?case=${testCase}`) as Promise<typeof import("./clerk-server.ts")>;
}

function mockEnvironment(t: TestContext, options: {
  rpc: (name: string, args?: Record<string, unknown>) => Result;
  ledger?: Result;
  ledgerRows?: Array<Record<string, unknown>>;
  profiles?: Result;
}) {
  // clerk-server.ts is a server module; the real marker package throws on import.
  t.mock.module("server-only", { namedExports: {} });
  t.mock.module("@clerk/nextjs/server", {
    namedExports: { auth: async () => SESSION, currentUser: async () => CLERK_USER },
  });
  t.mock.module("@/lib/env", {
    namedExports: { hasClerkConfiguration: () => true, requireClerkIssuer: () => ISSUER },
  });
  t.mock.module("@/lib/supabase/server", {
    namedExports: {
      createClient: async () => ({
        rpc: async (name: string) => options.rpc(name),
        from: () => table(options.profiles ?? { data: null, error: { code: "PGRST116", message: "multiple rows" } }),
      }),
    },
  });
  t.mock.module("@/lib/supabase/admin", {
    namedExports: {
      createAdminClient: () => ({
        rpc: async (name: string, args?: Record<string, unknown>) => options.rpc(name, args),
        from: () => table(options.ledger ?? { data: null, error: null }, options.ledgerRows),
      }),
    },
  });
}

// rush.profiles also exposes cycle colleagues, so the old unfiltered
// maybeSingle() returned PGRST116 for every Board member and 500ed /admin.
test("a multi-row profiles response no longer throws for a mapped identity", async (t) => {
  mockEnvironment(t, {
    rpc: (name) => {
      if (name === "actor_id") return { data: "board-uuid", error: null };
      throw new Error(`unexpected rpc call: ${name}`);
    },
  });
  const { resolveCurrentIdentity } = await importModule("mapped-multi-row");
  assert.deepEqual(await resolveCurrentIdentity(), {
    appUserId: "board-uuid",
    issuer: ISSUER,
    subject: SESSION.userId,
  });
});

test("an unlinked migrated user claims the app user id from the migration ledger", async (t) => {
  const calls: Array<Record<string, unknown> | undefined> = [];
  mockEnvironment(t, {
    ledger: { data: { source_user_id: "legacy-uuid" }, error: null },
    rpc: (name, args) => {
      if (name === "actor_id") return { data: null, error: null };
      if (name === "ensure_external_identity") {
        calls.push(args);
        return { data: args?.existing_app_user_id ?? "fresh-uuid", error: null };
      }
      throw new Error(`unexpected rpc call: ${name}`);
    },
  });
  const { resolveCurrentIdentity } = await importModule("ledger-hit");
  const identity = await resolveCurrentIdentity();
  assert.equal(identity?.appUserId, "legacy-uuid");
  assert.equal(calls[0]?.existing_app_user_id, "legacy-uuid");
  assert.equal(calls[0]?.identity_email, "Riley.Board@umich.edu");
});

test("a new applicant with no ledger row still provisions a fresh identity", async (t) => {
  mockEnvironment(t, {
    rpc: (name, args) => {
      if (name === "actor_id") return { data: null, error: null };
      if (name === "ensure_external_identity") {
        assert.equal(args?.existing_app_user_id, undefined);
        return { data: "fresh-uuid", error: null };
      }
      throw new Error(`unexpected rpc call: ${name}`);
    },
  });
  const { resolveCurrentIdentity } = await importModule("ledger-miss");
  assert.equal((await resolveCurrentIdentity())?.appUserId, "fresh-uuid");
});

// expected_email has no unique constraint, so duplicate rows for one address
// are legal. maybeSingle() alone made that PGRST116, which this module throws,
// which locked that person out of sign-in for good. The LINKED row is the
// identity already claimed, so it must win, deterministically.
test("duplicate ledger rows for one email resolve to the LINKED row", async (t) => {
  const calls: Array<Record<string, unknown> | undefined> = [];
  mockEnvironment(t, {
    ledgerRows: [
      { source_user_id: "prepared-uuid", status: "PREPARED" },
      { source_user_id: "linked-uuid", status: "LINKED" },
    ],
    rpc: (name, args) => {
      if (name === "actor_id") return { data: null, error: null };
      if (name === "ensure_external_identity") {
        calls.push(args);
        return { data: args?.existing_app_user_id ?? "fresh-uuid", error: null };
      }
      throw new Error(`unexpected rpc call: ${name}`);
    },
  });
  const { resolveCurrentIdentity } = await importModule("ledger-duplicate");
  assert.equal((await resolveCurrentIdentity())?.appUserId, "linked-uuid");
  assert.equal(calls[0]?.existing_app_user_id, "linked-uuid");
});

// Fail closed: a broken ledger read must never mint a second identity for a
// Board member whose old row still owns their email.
test("a failed ledger lookup surfaces instead of provisioning a new identity", async (t) => {
  mockEnvironment(t, {
    ledger: { data: null, error: { code: "57014", message: "canceling statement due to statement timeout" } },
    rpc: (name) => {
      if (name === "actor_id") return { data: null, error: null };
      throw new Error(`unexpected rpc call: ${name}`);
    },
  });
  const { resolveCurrentIdentity } = await importModule("ledger-error");
  await assert.rejects(resolveCurrentIdentity(), (error: { code?: string }) => error.code === "57014");
});
