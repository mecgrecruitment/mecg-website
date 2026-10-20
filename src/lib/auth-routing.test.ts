import assert from "node:assert/strict";
import test from "node:test";

test("current auth routing preserves a repeat applicant's editable intake lifecycle", async (t) => {
  let canStart = true;
  let intake: unknown = { open: true, cycleId: "later-cycle", draft: null };
  let intakeError: { message: string } | null = null;
  let internal = false;
  let intakeReads = 0;
  const client = {
    from(table: string) {
      if (table === "profiles") return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { active: true }, error: null }) }) }) };
      return { select: () => ({ eq: () => ({ eq: async () => ({ data: internal ? [{ role: "MEMBER", rush_cycles: { status: "OPEN" } }] : [], error: null }) }) }) };
    },
    async rpc(name: string) {
      if (name === "is_applicant") return { data: true, error: null }; // prior-cycle submitted history
      if (name === "can_start_application") return { data: canStart, error: null };
      if (name === "intake_schema") { intakeReads += 1; return { data: intake, error: intakeError }; }
      throw new Error(`Unexpected RPC ${name}`);
    },
  };
  t.mock.module("server-only", { namedExports: {} });
  t.mock.module("@/lib/identity/clerk-server", { namedExports: { resolveCurrentIdentity: async () => ({ appUserId: "returning-applicant" }) } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => client } });
  const { currentDestination } = await import("./auth.ts");

  assert.equal(await currentDestination(), "/apply");
  assert.equal(intakeReads, 0);
  canStart = false; // initial save creates the current-cycle row
  intake = { open: true, cycleId: "later-cycle", draft: { name: "Saved applicant", revision: "saved-revision" }, needsInfo: false };
  assert.equal(await currentDestination(), "/apply");
  intake = { open: true, cycleId: "later-cycle", draft: { name: "Saved applicant", revision: "saved-revision" }, needsInfo: true };
  assert.equal(await currentDestination(), "/apply");
  intake = { open: true, cycleId: "later-cycle", draft: null, needsInfo: false }; // submitted
  assert.equal(await currentDestination(), "/applicant");
  intake = { open: false, cycleId: null, draft: null };
  assert.equal(await currentDestination(), "/applicant");
  intakeError = { message: "intake unavailable" };
  await assert.rejects(currentDestination(), { message: "intake unavailable" });
  internal = true;
  const before = intakeReads;
  assert.equal(await currentDestination(), "/member");
  assert.equal(intakeReads, before);
});
