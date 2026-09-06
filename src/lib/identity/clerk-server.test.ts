import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";

const ISSUER = "https://clerk.mecg.test";
const SESSION = { userId: "user_2clerk", sessionClaims: { iss: `${ISSUER}/`, sub: "user_2clerk" } };
const CLERK_USER: {
  id: string;
  firstName: string;
  lastName: string;
  username: null;
  primaryEmailAddressId: string;
  emailAddresses: Array<{ id: string; emailAddress: string; verification: { status: string } | null }>;
  externalId: string | null;
} = {
  id: "user_2clerk",
  firstName: "Riley",
  lastName: "Board",
  username: null,
  primaryEmailAddressId: "idn_1",
  emailAddresses: [{ id: "idn_1", emailAddress: "Riley.Board@umich.edu", verification: { status: "verified" } }],
  externalId: null,
};

type Result = { data: unknown; error: unknown };

function importModule(testCase: string) {
  return import(`./clerk-server.ts?case=${testCase}`) as Promise<typeof import("./clerk-server.ts")>;
}

function mockEnvironment(t: TestContext, options: {
  rpc: (name: string, args?: Record<string, unknown>) => Result;
  clerkUser?: typeof CLERK_USER;
}) {
  // clerk-server.ts is a server module; the real marker package throws on import.
  t.mock.module("server-only", { namedExports: {} });
  t.mock.module("@clerk/nextjs/server", {
    namedExports: { auth: async () => SESSION, currentUser: async () => options.clerkUser ?? CLERK_USER },
  });
  t.mock.module("@/lib/env", {
    namedExports: { hasClerkConfiguration: () => true, requireClerkIssuer: () => ISSUER },
  });
  t.mock.module("@/lib/supabase/server", {
    namedExports: {
      createClient: async () => ({
        rpc: async (name: string) => options.rpc(name),
      }),
    },
  });
  t.mock.module("@/lib/supabase/admin", {
    namedExports: {
      createAdminClient: () => ({
        rpc: async (name: string, args?: Record<string, unknown>) => options.rpc(name, args),
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

test("a migrated user claims only the UUID assigned in Clerk externalId", async (t) => {
  const calls: Array<Record<string, unknown> | undefined> = [];
  mockEnvironment(t, {
    clerkUser: { ...CLERK_USER, externalId: "10000000-0000-4000-8000-000000000001" },
    rpc: (name, args) => {
      if (name === "actor_id") return { data: null, error: null };
      if (name === "ensure_external_identity") {
        calls.push(args);
        return { data: args?.existing_app_user_id ?? "fresh-uuid", error: null };
      }
      throw new Error(`unexpected rpc call: ${name}`);
    },
  });
  const { resolveCurrentIdentity } = await importModule("external-id");
  const identity = await resolveCurrentIdentity();
  assert.equal(identity?.appUserId, "10000000-0000-4000-8000-000000000001");
  assert.equal(calls[0]?.existing_app_user_id, "10000000-0000-4000-8000-000000000001");
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
  const { resolveCurrentIdentity } = await importModule("new-user");
  assert.equal((await resolveCurrentIdentity())?.appUserId, "fresh-uuid");
});

test("a malformed externalId cannot claim a legacy profile", async (t) => {
  mockEnvironment(t, {
    clerkUser: { ...CLERK_USER, externalId: "not-a-domain-uuid" },
    rpc: (name, args) => {
      if (name === "actor_id") return { data: null, error: null };
      if (name === "ensure_external_identity") {
        assert.equal(args?.existing_app_user_id, undefined);
        return { data: "fresh-uuid", error: null };
      }
      throw new Error(`unexpected rpc call: ${name}`);
    },
  });
  const { resolveCurrentIdentity } = await importModule("invalid-external-id");
  assert.equal((await resolveCurrentIdentity())?.appUserId, "fresh-uuid");
});

// The allowlist grants a role on the strength of an email address, so an
// unverified one must never reach ensure_external_identity.
test("an unverified primary email cannot provision an identity", async (t) => {
  mockEnvironment(t, {
    clerkUser: { ...CLERK_USER, emailAddresses: [{ id: "idn_1", emailAddress: "Riley.Board@umich.edu", verification: null }] },
    rpc: (name) => {
      if (name === "actor_id") return { data: null, error: null };
      throw new Error(`unexpected rpc call: ${name}`);
    },
  });
  const { resolveCurrentIdentity } = await importModule("unverified-email");
  await assert.rejects(resolveCurrentIdentity(), /A verified primary email is required/);
});
