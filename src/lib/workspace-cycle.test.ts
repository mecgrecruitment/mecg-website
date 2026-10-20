import assert from "node:assert/strict";
import test from "node:test";
import { workspaceCycleFixture } from "./workspace-cycle-fixture";

async function setup(t: test.TestContext, values: string[], key: string) {
  t.mock.module("server-only", { namedExports: {} });
  t.mock.module("next/headers", { namedExports: { headers: async () => new Headers({ "x-mecg-workspace-cycle": JSON.stringify(values) }) } });
  t.mock.module("next/navigation", { namedExports: { notFound: () => { throw new Error("NOT_FOUND"); } } });
  return import(`./workspace-cycle.ts?case=${key}`) as Promise<typeof import("./workspace-cycle")>;
}

test("default priority remains unchanged, explicit draft and old cohorts win only when authorized", async (t) => {
  const first = await setup(t, [], "default");
  assert.equal(await first.selectWorkspaceCycle(workspaceCycleFixture.memberships, "MANAGE_CYCLE"), "live-cycle");
});
for (const cycleId of ["draft-cycle", "old-cycle"]) test(`authorized ${cycleId} is honored rather than defaulting to current`, async (t) => {
  const helper = await setup(t, [cycleId], cycleId);
  assert.equal(await helper.selectWorkspaceCycle(workspaceCycleFixture.memberships, "MANAGE_CYCLE"), cycleId);
  assert.equal((await helper.selectWorkspaceMembership(workspaceCycleFixture))?.cycleId, cycleId);
});
test("unknown, inactive and capability-ineligible explicit cohorts cannot fall back", async (t) => {
  const helper = await setup(t, ["draft-cycle"], "ineligible");
  await assert.rejects(helper.selectWorkspaceCycle([], "WORKSPACE_ACCESS"), /NOT_FOUND/);
  await assert.rejects(helper.selectWorkspaceCycle(workspaceCycleFixture.memberships.map((membership) => ({ ...membership, active: false })), "WORKSPACE_ACCESS"), /NOT_FOUND/);
  await assert.rejects(helper.selectWorkspaceCycle(workspaceCycleFixture.memberships.map((membership) => ({ ...membership, role: "MEMBER" })), "MANAGE_CYCLE"), /NOT_FOUND/);
});
test("a route's alternative capabilities stay within the explicitly requested cohort", async (t) => {
  const helper = await setup(t, ["draft-cycle"], "panel");
  assert.equal(await helper.selectWorkspaceCycle(workspaceCycleFixture.memberships.map((membership) => ({ ...membership, role: "PANEL" })), ["RECRUITMENT_OPERATIONS", "HASH_PANEL_ACCESS"]), "draft-cycle");
});
test("contradictory selector context is rejected before choosing a cohort", async (t) => {
  const helper = await setup(t, ["draft-cycle", "live-cycle"], "conflict");
  await assert.rejects(helper.selectWorkspaceCycle(workspaceCycleFixture.memberships, "MANAGE_CYCLE"), /NOT_FOUND/);
});
