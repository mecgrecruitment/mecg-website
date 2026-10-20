import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as nodeModule from "node:module";
import { fileURLToPath } from "node:url";
import test, { type TestContext } from "node:test";
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
const owner = { id: "owner", active: true, email: "owner@example.invalid", name: "Owner", memberships: [
  { id: "membership", cycleId: "actual-cycle", role: "OWNER", active: true,
    cycle: { id: "actual-cycle", name: "Actual", status: "OPEN", createdAt: new Date() } },
] };
const fixture = { id: "42000000-0000-4000-8000-000000000001", cycle_id: "actual-cycle", email: "synthetic-owner-review@example.invalid",
  clerk_user_id: null, app_user_id: null, phase: "IDENTITY_LINK", clerk_cleanup_failed: true, profile_cleanup_failed: false,
  created_at: "2026-10-16T12:00:00Z", resolved_at: null };

function fakeClient({ fail = false } = {}) {
  const filters: Array<{ table: string; key: string; value: unknown }> = [];
  const ranges: Array<[number, number]> = [];
  return { filters, ranges, client: { from(table: string) {
    return { select() {
      const chain = {
        eq(key: string, value: unknown) { filters.push({ table, key, value }); return chain; },
        is(key: string, value: unknown) { filters.push({ table, key, value }); return chain; },
        order() { return chain; },
        async single() { return { data: { id: "actual-cycle", name: "Actual cycle", status: "OPEN" }, error: null }; },
        async range(start: number, end: number) { ranges.push([start, end]); return { data: fail ? null : [fixture], error: fail ? { message: "private diagnostic" } : null, count: fail ? null : 104 }; },
      };
      return chain;
    } };
  } } };
}
async function loadPage(caseName: string): Promise<typeof import("./page")> { return import(`./page.tsx?case=${caseName}`); }
function chrome(t: TestContext) {
  t.mock.module("server-only", { namedExports: {} });
  t.mock.module("next/headers", { namedExports: { headers: async () => new Headers() } });
  t.mock.module("next/navigation", { namedExports: { notFound: () => { throw new Error("NOT_FOUND"); }, redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); }, useRouter: () => ({ refresh() {} }) } });
  t.mock.module("@/components/workspace-nav", { defaultExport: () => null });
  t.mock.module("@/components/workspace-header", { defaultExport: ({ title }: { title: string }) => createElement("h1", null, title) });
}

test("nonowners cannot load incident data or render provider identity information", async (t) => {
  chrome(t);
  t.mock.module("@/lib/auth", { namedExports: { requireAdmin: async () => ({ ...owner, memberships: [{ ...owner.memberships[0], role: "BOARD" }] }) } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => { throw new Error("must not query incident data"); } } });
  const { default: Page } = await loadPage("unauthorized");
  await assert.rejects(Page({ searchParams: Promise.resolve({}) }), /REDIRECT:\/access-denied/);
});
test("the owner queue scopes caller reads to the actual cycle and paginates100 oldest unresolved records", async (t) => {
  chrome(t); const fake = fakeClient();
  t.mock.module("@/lib/auth", { namedExports: { requireAdmin: async () => owner } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => fake.client } });
  const { default: Page } = await loadPage("owner");
  const markup = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ page: "2" }) }));
  assert.deepEqual(fake.ranges, [[100, 199]]);
  assert.ok(fake.filters.some((filter) => filter.table === "provisioning_incidents" && filter.key === "cycle_id" && filter.value === "actual-cycle"));
  assert.ok(fake.filters.some((filter) => filter.table === "provisioning_incidents" && filter.key === "resolved_at" && filter.value === null));
  assert.match(markup, /synthetic-owner-review@example.invalid/);
  assert.match(markup, /Not available/); assert.match(markup, /check Clerk/);
  assert.match(markup, /Clerk cleanup needs review/); assert.match(markup, /Mark resolved/);
  assert.match(markup, /does not repair accounts or send emails/);
  assert.match(markup, /Previous page/); assert.match(markup, /First page/);
});
test("an incident outage renders recovery without claiming an empty or resolved queue", async (t) => {
  chrome(t); const fake = fakeClient({ fail: true });
  t.mock.module("@/lib/auth", { namedExports: { requireAdmin: async () => owner } });
  t.mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => fake.client } });
  const { default: Page } = await loadPage("unavailable");
  const markup = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
  assert.match(markup, /incidents could not be loaded/);
  assert.doesNotMatch(markup, /No unresolved incidents|Mark resolved|private diagnostic/);
});
