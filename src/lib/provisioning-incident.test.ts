import assert from "node:assert/strict";
import test from "node:test";
import { creationOutcomeIsUncertain } from "./provisioning-incident";

test("creation transport, timeout and server failures require reconciliation", () => {
  for (const error of [new Error("timeout"), null, { status: 500 }, { status: 408 }, { status: "409" }, { status: NaN }, { status: 409.5 }, { status: 200 }]) assert.equal(creationOutcomeIsUncertain(error), true);
});
test("definitive creation client rejections can be corrected without an orphan claim", () => {
  for (const status of [400, 401, 403, 409, 422, 429]) assert.equal(creationOutcomeIsUncertain({ status }), false);
});

test("incident persistence never leaks identity or raw errors to logs and responses", async (t) => {
  let outcome: "saved" | "failed" | "thrown" = "saved";
  const rows: Record<string, unknown>[] = [];
  const logs: unknown[][] = [];
  t.mock.method(console, "error", (...args: unknown[]) => { logs.push(args); });
  t.mock.module("@/lib/supabase/admin", { namedExports: { createAdminClient: () => ({ from: (table: string) => {
    assert.equal(table, "provisioning_incidents");
    return { insert: async (row: Record<string, unknown>) => {
      rows.push(row);
      if (outcome === "thrown") throw new Error("private-token provider-body");
      return { error: outcome === "failed" ? { message: "private-token provider-body" } : null };
    } };
  } }) } });
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const { recordProvisioningFailure } = await import("./provisioning-incident");
  for (const state of ["saved", "failed", "thrown"] as const) {
    outcome = state;
    const result = await recordProvisioningFailure(createAdminClient(), { cycleId: "cycle", requestedBy: "owner", email: "private@example.invalid", clerkUserId: "private-clerk-id", appUserId: null, phase: "IDENTITY_LINK", clerkCleanupFailed: true, profileCleanupFailed: false });
    assert.equal(result.remediationRecorded, state === "saved");
    assert.match(result.incidentId, /^[0-9a-f-]{36}$/);
    assert.doesNotMatch(JSON.stringify(result), /private@example|private-clerk|private-token|provider-body/);
  }
  assert.equal(rows.length, 3);
  assert.equal(rows[0].email, "private@example.invalid");
  assert.deepEqual(Object.keys(rows[0]).sort(), ["app_user_id", "clerk_cleanup_failed", "clerk_user_id", "cycle_id", "email", "id", "phase", "profile_cleanup_failed", "requested_by"]);
  assert.doesNotMatch(JSON.stringify(logs), /private@example|private-clerk|private-token|provider-body/);
});
