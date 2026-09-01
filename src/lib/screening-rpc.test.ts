import assert from "node:assert/strict";
import test from "node:test";
import { screeningRpc } from "./screening-rpc.ts";

function client(data: unknown, error: { code?: string; message: string } | null = null) {
  return {
    async rpc() {
      return { data, error };
    },
  };
}

test("screeningRpc accepts a valid registered RPC response", async () => {
  const result = await screeningRpc<boolean>(client(true), "check_rate_limit", { p_bucket: "test" });
  assert.deepEqual(result, { data: true, error: null });
});

test("screeningRpc rejects a malformed registered RPC response", async () => {
  const result = await screeningRpc<boolean>(client("true"), "check_rate_limit", { p_bucket: "test" });
  assert.equal(result.data, null);
  assert.equal(result.error?.code, "RPC_SHAPE");
  assert.match(result.error?.message ?? "", /check_rate_limit/);
});

test("screeningRpc validates nested screening detail fields", async () => {
  const result = await screeningRpc(
    client({
      assignmentId: "assignment-1",
      candidateCode: "APPLICANT 123456",
      status: "ASSIGNED",
      content: { responses: [] },
      criteria: [{ id: "criterion-1", name: "Judgment", description: "Uses evidence", weight: "25", required: true }],
    }),
    "screening_assignment_detail",
  );
  assert.equal(result.data, null);
  assert.equal(result.error?.code, "RPC_SHAPE");
});

test("screeningRpc preserves database errors without shape validation", async () => {
  const databaseError = { code: "42501", message: "forbidden" };
  const result = await screeningRpc(client({ unexpected: true }, databaseError), "screening_admin_overview");
  assert.equal(result.data, null);
  assert.deepEqual(result.error, databaseError);
});

test("screeningRpc leaves unconsumed mutation results unchanged", async () => {
  const payload = { id: "batch-1" };
  const result = await screeningRpc(client(payload), "create_screening_batch");
  assert.deepEqual(result, { data: payload, error: null });
});
