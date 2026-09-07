import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";

type RpcResult = { data: unknown; error: { code?: string; message: string } | null };

function importModule(testCase: string) {
  return import(`./workspace-context.ts?case=${testCase}`) as Promise<typeof import("./workspace-context.ts")>;
}

function mockClient(t: TestContext, rpc: (name: string) => RpcResult) {
  t.mock.module("server-only", { namedExports: {} });
  t.mock.module("@/lib/supabase/server", {
    namedExports: {
      createClient: async () => ({ rpc: async (name: string) => rpc(name) }),
    },
  });
}

test("a deployment with the previous database schema still loads member work", async (t) => {
  const calls: string[] = [];
  mockClient(t, (name) => {
    calls.push(name);
    if (name === "workspace_context") {
      return { data: null, error: { code: "PGRST202", message: "function is not in the schema cache" } };
    }
    if (name === "is_active_screening_reviewer") return { data: false, error: null };
    throw new Error(`unexpected RPC ${name}`);
  });

  const { loadWorkspaceContext } = await importModule("previous-schema");
  assert.deepEqual(await loadWorkspaceContext("cycle-1"), {
    data: {
      cycleId: "cycle-1",
      isScreeningReviewer: false,
      openScreeningCount: 0,
      openEvaluationCount: 0,
      openCalibrationCount: 0,
      openLiveEventCount: 0,
      openTaskCount: 0,
      hasGradingEvent: false,
      hasSpeedDatingRound: false,
      hasGroupCaseWork: false,
    },
    error: null,
  });
  assert.deepEqual(calls, ["workspace_context", "is_active_screening_reviewer"]);
});

test("real workspace context failures remain visible", async (t) => {
  const unavailable = { code: "57014", message: "database request timed out" };
  mockClient(t, (name) => {
    assert.equal(name, "workspace_context");
    return { data: null, error: unavailable };
  });

  const { loadWorkspaceContext } = await importModule("real-error");
  assert.deepEqual(await loadWorkspaceContext("cycle-2"), { data: null, error: unavailable });
});
