import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as nodeModule from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

type LoadResult = { format: string; shortCircuit?: boolean; source?: string };
type LoadHook = (url: string, context: unknown, next: (url: string, context: unknown) => LoadResult) => LoadResult;
const { registerHooks } = nodeModule as unknown as { registerHooks: (hooks: { load: LoadHook }) => void };
registerHooks({ load(url, context, next) {
  const path = url.split("?")[0]!;
  if (!path.endsWith(".tsx")) return next(url, context);
  if (path.endsWith("/logout-button.tsx")) return { format: "module", shortCircuit: true, source: "export default function Stub() {return null;}" };
  if (path.endsWith("/pill-nav.tsx")) return { format: "module", shortCircuit: true, source: `import {createElement} from 'react'; export default function Stub({links}) {return createElement('nav',null,links.map(([href,label])=>createElement('a',{href,key:href},label)));}` };
  if (path.endsWith("/workspace-more-menu.tsx")) return { format: "module", shortCircuit: true, source: `import {createElement} from 'react'; export default function Stub({myTools,adminTools}) {return createElement('nav',null,[...myTools,...adminTools].map(([href,label])=>createElement('a',{href,key:href},label)));}` };
  if (path.endsWith("/workspace-cycle-switcher.tsx")) return { format: "module", shortCircuit: true, source: `import {createElement} from 'react'; export default function Stub({cycles,cycleId}) {return createElement('select',{'aria-label':'Cohort',defaultValue:cycleId},cycles.map(cycle=>createElement('option',{key:cycle.id,value:cycle.id},cycle.name)));}` };
  return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(fileURLToPath(path), "utf8"), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText };
} });

test("resource page checks membership before exposing Drive links", async (t) => {
  t.mock.module("server-only", { namedExports: {} });
  let signedIn = false;
  let member = false;
  t.mock.module("@/lib/auth", { namedExports: { requireMember: async () => {
    if (!signedIn) throw new Error("SIGN_IN_REQUIRED");
    return { id: "fixture" };
  } } });
  t.mock.module("@/lib/workspace-cycle", { namedExports: { selectWorkspaceMembership: async () => member ? { cycleId: "fixture" } : null } });
  t.mock.module("@/components/workspace-nav", { defaultExport: () => null });
  const { default: ResourcesPage } = await import("./page.tsx");
  await assert.rejects(ResourcesPage(), /SIGN_IN_REQUIRED/);
  signedIn = true;
  assert.equal(await ResourcesPage(), null);
  member = true;
  const html = renderToStaticMarkup(await ResourcesPage());
  assert.match(html, /Consulting templates/);
  assert.match(html, /Workshop materials/);
  assert.match(html, /Neither is designated as the master/);
  assert.match(html, /Website membership does not grant Drive access/);
  assert.equal((html.match(/target="_blank"/g) ?? []).length, 23);
  assert.equal((html.match(/<article/g) ?? []).length, 22);
  const filtered = renderToStaticMarkup(await ResourcesPage({ searchParams: Promise.resolve({ q: "Excel", category: "analysis-skills" }) }));
  assert.equal((filtered.match(/<article/g) ?? []).length, 1);
  assert.match(filtered, /Microsoft Excel/);
  assert.ok(!filtered.includes("BCG case interview"));
  const empty = renderToStaticMarkup(await ResourcesPage({ searchParams: Promise.resolve({ q: "no-matching-resource" }) }));
  assert.match(empty, /No resources match/);
  assert.ok(!empty.includes("<article"));
  for (const excluded of ["Full Membership Roster", "MECG Contacts", "Copy of Copy of"]) assert.ok(!html.includes(excluded));
});
