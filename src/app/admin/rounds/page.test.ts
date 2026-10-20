import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as nodeModule from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { applications, groupAssignments, speedAssignments } from "./coverage-fixture";

type LoadResult = { format: string; shortCircuit?: boolean; source?: string };
type LoadHook = (url: string, context: unknown, next: (url: string, context: unknown) => LoadResult) => LoadResult;
const { registerHooks } = nodeModule as unknown as { registerHooks: (hooks: { load: LoadHook }) => void };
registerHooks({ load(url, context, next) {
  const path = url.split("?")[0]!;
  if (!path.endsWith(".tsx")) return next(url, context);
  if (path.endsWith("/workspace-nav.tsx") || path.endsWith("/logout-button.tsx")) return { format: "module", shortCircuit: true, source: "export default function Stub() {return null;}" };
  return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(fileURLToPath(path), "utf8"), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText };
} });

function setup(t: test.TestContext, options: { failure?: string } = {}) {
  const selections: string[] = [];
  t.mock.module("server-only", { namedExports: {} });
  t.mock.module("next/headers", { namedExports: { headers: async () => new Headers() } });
  t.mock.module("next/navigation", { namedExports: { redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); }, notFound: () => { throw new Error("NOT_FOUND"); } } });
  t.mock.module("@/lib/auth", { namedExports: { requireAdmin: async () => ({ name: "Synthetic operator", memberships: [] }) } });
  t.mock.module("@/lib/authorization", { namedExports: { hasPermission: () => true } });
  t.mock.module("@/lib/cycles", { namedExports: { selectAuthorizedCycleId: () => "cycle" } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => ({ from(table: string) {
    const rounds = [{ id: "group", kind: "GROUP_CASE", name: "Group Case round", status: "ACTIVE", weight: 40 }, { id: "speed", kind: "SPEED_DATING", name: "Speed Dating round", status: "ACTIVE", weight: 30 }, { id: "screen", kind: "APPLICATION_SCREEN", name: "Application screening", status: "ACTIVE", weight: 30 }];
    const assignments = [...groupAssignments.map((row, i) => ({ ...row, id: `group-${i}`, round_id: "group" })), ...speedAssignments.map((row, i) => ({ ...row, id: `speed-${i}`, round_id: "speed" }))];
    const data = table === "rush_cycles" ? { id: "cycle", name: "Synthetic cycle", status: "IN_PROCESS" } : table === "rounds" ? rounds : table === "applications" ? applications : table === "evaluation_assignments" ? assignments : [];
    const result = { data, error: table === options.failure ? new Error("Staffing service unavailable") : null };
    const query = { select(fields: string) { selections.push(fields); return query; }, eq() {return query;}, neq() {return query;}, order() {return query;}, single() {return Promise.resolve(result);}, then: Promise.resolve(result).then.bind(Promise.resolve(result)) };
    return query;
  } }) } });
  return selections;
}

async function markup(caseName: string) {
  const { default: Page } = await import(`./page.tsx?case=${caseName}`) as typeof import("./page");
  return renderToStaticMarkup(await Page());
}

test("actual rounds overview separates round-specific staffing from evidence validity", async (t) => {
  const selections = setup(t);
  const html = await markup("mixed-stage-staffing");
  const group = html.slice(html.indexOf('href="/admin/rounds/group?cycleId=cycle"'), html.indexOf('href="/admin/rounds/speed?cycleId=cycle"'));
  const speed = html.slice(html.indexOf('href="/admin/rounds/speed?cycleId=cycle"'), html.indexOf('href="/admin/screening?cycleId=cycle"'));
  assert.match(group, /2\/3 with 2\+ assigned/);
  assert.match(group, /Submitted forms/);
  assert.match(group, /3\/4/);
  assert.match(speed, /2\/4 with 2\+ assigned/);
  assert.match(speed, /2\/5/);
  assert.match(html, /Submitted forms may contain partial observations/);
  assert.doesNotMatch(html, /Coverage|twice|valid evidence ready/i);
  assert.ok(selections.every((fields) => !fields.includes("scores") && !fields.includes("evaluations(")), "overview does not acquire scoring/evaluation evidence access");
});

test("application screening uses its own workspace rather than unrelated interview assignment counts", async (t) => {
  setup(t);
  const html = await markup("screening-workspace");
  const screen = html.slice(html.indexOf('href="/admin/screening?cycleId=cycle"'), html.indexOf("Interview events"));
  assert.match(screen, /Screening assignments and progress are in the application review workspace/);
  assert.doesNotMatch(screen, /with 2\+ assigned|Submitted forms/);
});

test("failed assignment data does not render a false zero-coverage overview", async (t) => {
  setup(t, { failure: "evaluation_assignments" });
  await assert.rejects(markup("staffing-failure"), /Staffing service unavailable/);
});
