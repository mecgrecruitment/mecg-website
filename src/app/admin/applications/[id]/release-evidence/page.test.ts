import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as nodeModule from "node:module";
import test, { type TestContext } from "node:test";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

type LoadResult = { format: string; shortCircuit?: boolean; source?: string };
const registerHooks: unknown = Reflect.get(nodeModule, "registerHooks");
if (typeof registerHooks !== "function") throw new Error("Node JSX test loading is unavailable");
registerHooks({ load(url: string, context: unknown, nextLoad: (url: string, context: unknown) => LoadResult) {
  if (!new URL(url).pathname.endsWith(".tsx")) return nextLoad(url, context);
  return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(fileURLToPath(url), "utf8"), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText };
} });
const appId = "42000000-0000-4000-8000-000000000001";
const actualCycle = "actual-cycle";
const report = {
  applicationId: appId, applicationStatus: "FINAL_REVIEW", ready: false, blockers: [],
  rounds: [{ roundId: "round-id", roundName: "Group case", kind: "GROUP_CASE", status: "FROZEN", validLockedEvaluations: 1,
    requiredEvaluations: 2, missingRequiredCriteria: ["Mechanical reasoning"], blockers: ["VALID_LOCKED_EVALUATIONS_MISSING"] }],
};
type Options = { role?: string; membershipCycle?: string; authDenied?: boolean; applicationMissing?: boolean; applicationFailure?: boolean;
  rpcData?: unknown; rpcError?: string; rpcThrows?: boolean };
function setup(t: TestContext, options: Options = {}) {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  t.mock.module("server-only", { namedExports: {} });
  t.mock.module("next/navigation", { namedExports: { notFound: () => { throw new Error("NOT_FOUND"); }, redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); } } });
  t.mock.module("@/components/workspace-nav", { defaultExport: ({ cycleId }: { cycleId: string }) => createElement("span", { "data-nav-cycle": cycleId }) });
  t.mock.module("@/components/workspace-header", { defaultExport: ({ title }: { title: string }) => createElement("h1", null, title) });
  t.mock.module("@/lib/auth", { namedExports: { requireAdmin: async () => {
    calls.push({ method: "requireAdmin", args: [] });
    if (options.authDenied) throw new Error("AUTH_DENIED");
    return { memberships: [{ cycleId: options.membershipCycle ?? actualCycle, active: true, role: options.role ?? "PANEL" }] };
  } } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => {
    calls.push({ method: "createClient", args: [] });
    return {
      from(table: string) { calls.push({ method: "from", args: [table] }); return {
        select(fields: string) { calls.push({ method: "select", args: [fields] }); return {
          eq(key: string, value: unknown) { calls.push({ method: "eq", args: [key, value] }); return {
            async maybeSingle() { return { data: options.applicationMissing ? null : { cycle_id: actualCycle }, error: options.applicationFailure ? { message: "private lookup error" } : null }; },
          }; },
        }; },
      }; },
      async rpc(name: string, args: unknown) {
        calls.push({ method: "rpc", args: [name, args] });
        if (options.rpcThrows) throw new Error("private transport error");
        return { data: "rpcData" in options ? options.rpcData : report, error: options.rpcError ? { code: options.rpcError, message: "private RPC error" } : null };
      },
    };
  } } });
  return calls;
}
async function page(caseName: string) {
  const { default: Page } = await import(`./page.tsx?case=${caseName}`) as typeof import("./page");
  return Page({ params: Promise.resolve({ id: appId }) });
}

test("authentication is required before caller-scoped application lookup", async (t) => {
  const calls = setup(t, { authDenied: true });
  await assert.rejects(page("auth-denied"), /AUTH_DENIED/);
  assert.deepEqual(calls.map((call) => call.method), ["requireAdmin"]);
});
for (const options of [{ membershipCycle: "other-cycle" }, { role: "BOARD" }, { role: "RECRUITMENT_COMMITTEE" }, { role: "MEMBER" }]) {
  test(`actual application cycle requires RELEASE before diagnostics: ${JSON.stringify(options)}`, async (t) => {
    const calls = setup(t, options);
    await assert.rejects(page(`permission-${JSON.stringify(options)}`), /REDIRECT:\/access-denied/);
    assert.equal(calls.filter((call) => call.method === "rpc").length, 0);
    assert.deepEqual(calls.find((call) => call.method === "eq")?.args, ["id", appId]);
  });
}
test("an absent or RLS-hidden application returns not-found without diagnostic RPC", async (t) => {
  const calls = setup(t, { applicationMissing: true });
  await assert.rejects(page("missing-app"), /NOT_FOUND/);
  assert.equal(calls.filter((call) => call.method === "rpc").length, 0);
});
test("application lookup failure does not masquerade as absence or request evidence", async (t) => {
  const calls = setup(t, { applicationFailure: true });
  await assert.rejects(page("lookup-failure"), /Application lookup is unavailable/);
  assert.equal(calls.filter((call) => call.method === "rpc").length, 0);
});
for (const code of ["42501", "P0002"]) {
  test(`database permission, recusal or missing-application denial ${code} returns not-found`, async (t) => {
    const calls = setup(t, { rpcError: code });
    await assert.rejects(page(`rpc-denial-${code}`), /NOT_FOUND/);
    assert.deepEqual(calls.find((call) => call.method === "rpc")?.args, ["decision_evidence_diagnostics", { target_application_id: appId }]);
  });
}
for (const [name, options] of [
  ["unavailable", { rpcError: "XX000" }], ["thrown", { rpcThrows: true }],
  ["malformed", { rpcData: { ...report, ready: true } }], ["wrong-application", { rpcData: { ...report, applicationId: "different-app" } }],
  ["null", { rpcData: null }],
] satisfies Array<[string, Options]>) {
  test(`diagnostic ${name} renders recovery without false readiness or private diagnostics`, async (t) => {
    setup(t, options);
    const html = renderToStaticMarkup(await page(name));
    assert.match(html, /Evidence could not be checked/);
    assert.match(html, /No readiness or release result is confirmed/);
    assert.match(html, /Keep the outcome blocked/);
    assert.doesNotMatch(html, /Evidence requirements are met|Evidence requirements are not met|Mechanical reasoning|private .* error/);
    assert.match(html, /href="\/admin\?cycleId=actual-cycle"/);
  });
}
test("authorized PANEL reads one canonical report and all recovery/round links use the actual application cycle", async (t) => {
  const calls = setup(t);
  const html = renderToStaticMarkup(await page("valid-report"));
  assert.equal(calls.filter((call) => call.method === "rpc").length, 1);
  assert.deepEqual(calls.find((call) => call.method === "from")?.args, ["applications"]);
  assert.deepEqual(calls.find((call) => call.method === "select")?.args, ["cycle_id"]);
  assert.match(html, /data-nav-cycle="actual-cycle"/);
  assert.match(html, /Evidence requirements are not met/);
  assert.match(html, /Mechanical reasoning/);
  assert.match(html, /Grading is closed but sufficient valid evidence is missing/);
  assert.match(html, /href="\/admin\/rounds\/round-id\?cycleId=actual-cycle"/);
  assert.ok(html.includes(`href="/admin/applications/${appId}?cycleId=actual-cycle"`));
  assert.ok(html.includes(`href="/admin/applications/${appId}/release-evidence?cycleId=actual-cycle"`));
  assert.match(html, /does not release an outcome/);
});
test("authorized OWNER sees met evidence without being told release itself succeeded", async (t) => {
  setup(t, { role: "OWNER", rpcData: { ...report, ready: true, rounds: [{ ...report.rounds[0], validLockedEvaluations: 2, blockers: [], missingRequiredCriteria: ["Irrelevant invalid third observation"] }] } });
  const html = renderToStaticMarkup(await page("ready-owner"));
  assert.match(html, /Evidence requirements are met/);
  assert.match(html, /This round meets the evidence requirement/);
  assert.doesNotMatch(html, /Irrelevant invalid third observation|outcome released/i);
  assert.match(html, /does not release an outcome/);
});
