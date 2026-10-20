import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as nodeModule from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { workspaceCycleFixture } from "@/lib/workspace-cycle-fixture";

type LoadResult = { format: string; shortCircuit?: boolean; source?: string };
type LoadHook = (url: string, context: unknown, next: (url: string, context: unknown) => LoadResult) => LoadResult;
const { registerHooks } = nodeModule as unknown as { registerHooks: (hooks: { load: LoadHook }) => void };
registerHooks({ load(url, context, next) {
  const path = url.split("?")[0]!;
  if (!path.endsWith(".tsx")) return next(url, context);
  const source = readFileSync(fileURLToPath(path), "utf8");
  if (source.startsWith('"use client"') || path.endsWith("/workspace-nav.tsx")) return { format: "module", shortCircuit: true, source: "export default function Stub() {return null;} export function AddApplicantForm() {return null;} export function CloneCycleForm(){return null;} export function CycleControls(){return null;} export function AssignmentControls(){return null;} export function RoundControls(){return null;} export function CaseGroupAssignmentForm(){return null;} export function AdvanceRoundForm(){return null;} export function CreateCaseGroupForm(){return null;}" };
  return { format: "module", shortCircuit: true, source: ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText };
} });

let requestSelection: string[] = [];
type Filter = { table: string; key: string; value: unknown };
function setup(t: test.TestContext, selection: string[] = [], options: { roundCycle?: string; memberOnlyDraft?: boolean } = {}) {
  requestSelection = selection;
  const filters: Filter[] = [];
  const reads: { table: string; fields: string }[] = [];
  const rpcCalls: { name: string; args: unknown }[] = [];
  const user = options.memberOnlyDraft ? { ...workspaceCycleFixture, memberships: workspaceCycleFixture.memberships.map((membership) => membership.cycleId === "draft-cycle" ? { ...membership, role: "MEMBER" as const } : membership) } : workspaceCycleFixture;
  t.mock.module("server-only", { namedExports: {} });
  t.mock.module("next/headers", { namedExports: { headers: async () => new Headers({ "x-mecg-workspace-cycle": JSON.stringify(requestSelection) }) } });
  t.mock.module("next/navigation", { namedExports: { notFound: () => { throw new Error("NOT_FOUND"); }, redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); } } });
  t.mock.module("@/lib/auth", { namedExports: { requireAdmin: async () => user, requireMember: async () => user } });
  const client = { from(table: string) {
    let fields = ""; const conditions = new Map<string, unknown>();
    const result = () => {
      const cycleId = conditions.get("id");
      const cycle = user.memberships.find((membership) => membership.cycleId === cycleId)?.cycle;
      const oldRound = { id: "old-round", name: "Previous cohort round", cycle_id: options.roundCycle ?? "old-cycle", status: "FROZEN", kind: "GROUP_CASE", weight: 40, evaluation_assignments: [] };
      const data = table === "rush_cycles" ? cycle ?? [] : table === "rounds" && conditions.has("id") ? fields === "cycle_id" ? { cycle_id: oldRound.cycle_id } : oldRound : [];
      return { data, count: table === "rush_cycles" ? 3 : 0, error: null };
    };
    const query = {
      select(value: string) { fields = value; reads.push({ table, fields }); return query; },
      eq(key: string, value: unknown) { conditions.set(key, value); filters.push({ table, key, value }); return query; },
      neq() {return query;}, not() {return query;}, order() {return query;}, limit() {return query;},
      single: async () => result(), maybeSingle: async () => result(),
      get then() { const promise = Promise.resolve(result()); return promise.then.bind(promise); },
    };
    return query;
  }, rpc: async (name: string, args: unknown) => { rpcCalls.push({ name, args }); return { data: [], error: null }; } };
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => client } });
  t.mock.module("@/lib/screening-rpc", { namedExports: { screeningRpc: async (_client: unknown, name: string, args: unknown) => {
    rpcCalls.push({ name, args });
    return { data: name === "recruitment_analytics" ? { available: false, minimumCohort: 5 } : name === "group_case_results" ? { roundId: "old-round", roundName: "Previous cohort round", roundStatus: "FROZEN", criteria: [], applicants: [], graders: [], summary: { applicants: 0, graded: 0, graders: 0, evaluations: 0, saved: 0, savedEvaluations: 0 } } : [], error: null };
  } } });
  return { filters, reads, rpcCalls };
}

async function pageMarkup(path: string, key: string) {
  const { default: Page } = await import(`${path}?case=${key}`) as { default: () => Promise<React.ReactElement> };
  return renderToStaticMarkup(await Page());
}

test("actual settings page edits the explicit next draft rather than the higher-priority current cohort", async (t) => {
  const { filters, rpcCalls } = setup(t, ["draft-cycle"]);
  const html = await pageMarkup("./settings/page.tsx", "draft-settings");
  assert.match(html, /Next cohort draft/);
  assert.ok(filters.some((filter) => filter.table === "rush_cycles" && filter.key === "id" && filter.value === "draft-cycle"));
  assert.ok(rpcCalls.some((call) => call.name === "cycle_application_questions" && JSON.stringify(call.args).includes("draft-cycle")));
  assert.ok(!filters.some((filter) => filter.value === "live-cycle"));
});

test("dashboard and interview overview retain an explicitly selected authorized older cohort", async (t) => {
  const { filters } = setup(t, ["old-cycle"]);
  const dashboard = await pageMarkup("./page.tsx", "old-dashboard");
  assert.match(dashboard, /Previous cohort/);
  const overview = await pageMarkup("./rounds/page.tsx", "old-overview");
  assert.match(overview, /Previous cohort/);
  assert.match(overview, /\/admin\/events\/new\?cycleId=old-cycle/);
  assert.ok(filters.filter((filter) => filter.key === "cycle_id" || filter.key === "rounds.cycle_id").every((filter) => filter.value === "old-cycle"));
});

test("an explicit older round derives its own authorized context despite a different selected default", async (t) => {
  const { filters } = setup(t, ["live-cycle"]);
  const specifier = "./round-board.tsx?case=old-authorized-round";
  const { default: RoundBoard } = await import(specifier) as typeof import("./round-board");
  const html = renderToStaticMarkup(await RoundBoard({ roundId: "old-round" }));
  assert.match(html, /Previous cohort/);
  assert.match(html, /Previous cohort round/);
  const sectionNav = html.slice(html.indexOf('aria-label="Round sections"'), html.indexOf("</nav>", html.indexOf('aria-label="Round sections"')));
  assert.doesNotMatch(sectionNav, /<section|<details|<table/);
  assert.ok(html.indexOf('id="round-overview"') < html.indexOf('id="round-evidence"'));
  for (const [, target] of sectionNav.matchAll(/href="#([^" ]+)"/g)) assert.ok(html.includes(`id="${target}"`), `section link ${target} has a target`);
  assert.match(html, /\/admin\/rounds\?cycleId=old-cycle/);
  assert.ok(filters.some((filter) => filter.key === "id" && filter.value === "old-round"));
  assert.ok(filters.some((filter) => filter.table === "rush_cycles" && filter.value === "old-cycle"));
  assert.ok(!filters.some((filter) => filter.table === "rush_cycles" && filter.value === "live-cycle"));
});

test("a foreign round cannot turn a valid default membership into access", async (t) => {
  const { reads } = setup(t, [], { roundCycle: "foreign-cycle" });
  const specifier = "./round-board.tsx?case=foreign-round";
  const { default: RoundBoard } = await import(specifier) as typeof import("./round-board");
  await assert.rejects(RoundBoard({ roundId: "foreign-round" }), /NOT_FOUND/);
  assert.deepEqual(reads, [{ table: "rounds", fields: "cycle_id" }]);
});

test("explicit unauthorized cohort and insufficient selected-cohort capabilities never fall back", async (t) => {
  const { reads } = setup(t, ["draft-cycle"], { memberOnlyDraft: true });
  await assert.rejects(pageMarkup("./settings/page.tsx", "draft-no-manage"), /NOT_FOUND/);
  assert.deepEqual(reads, []);
});
