import assert from "node:assert/strict";
import test from "node:test";
import { pollHashLive } from "./hash-live.ts";

// Ballot visibility, note gating and the membership gate are member_hash_live's
// (supabase/tests/member_hash_live.sql). This covers what the phone does with the answer.
function client(result: { data: unknown; error: { code?: string } | null } | Error, calls: unknown[] = []) {
  return { rpc: async (name: "member_hash_live", args: unknown) => {
    assert.equal(name, "member_hash_live");
    calls.push(args);
    if (result instanceof Error) throw result;
    return result;
  } };
}

test("a poll is one call carrying the selected cycle and the requested applicant", async () => {
  const calls: unknown[] = [];
  const empty = { data: { presenting: null, applicationId: null, notes: [] }, error: null };
  await pollHashLive(client(empty, calls), "cycle", "other");
  await pollHashLive(client(empty, calls));
  assert.deepEqual(calls, [
    { target_cycle_id: "cycle", target_application_id: "other" },
    { target_cycle_id: null, target_application_id: "" },
  ]);
});

test("the presented applicant gets its readable major and year line", async () => {
  const result = await pollHashLive(client({ data: {
    presenting: { id: "presenter", name: "Visible applicant", major: null, class_year: null },
    applicationId: "presenter",
    notes: [{ source: "GROUP_CASE", note: "Evidence" }],
  }, error: null }));
  assert.deepEqual(result, { outcome: "ok", live: {
    presentingId: "presenter",
    presenting: { id: "presenter", name: "Visible applicant", meta: "", decided: null },
    applicationId: "presenter",
    notes: [{ source: "GROUP_CASE", note: "Evidence" }],
  } });
});

for (const [code, outcome] of [["28000", "signed-out"], ["42501", "signed-out"], ["XX000", "failed"]] as const) {
  test(`a database refusal ${code} reads as ${outcome}`, async () => {
    assert.deepEqual(await pollHashLive(client({ data: null, error: { code } })), { outcome, live: null });
  });
}

test("a dropped request is a failed poll, not a lost sign-in", async () => {
  assert.deepEqual(await pollHashLive(client(new Error("offline"))), { outcome: "failed", live: null });
});
