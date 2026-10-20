import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as nodeModule from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import ts from "typescript";
import { workspaceCycleFixture } from "@/lib/workspace-cycle-fixture";

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

test("shared workspace primary/member/admin navigation carries the actual selected authorized cohort", async (t) => {
  t.mock.module("server-only", { namedExports: {} });
  t.mock.module("next/headers", { namedExports: { headers: async () => new Headers() } });
  t.mock.module("next/navigation", { namedExports: { usePathname: () => "/admin/settings", useSearchParams: () => new URLSearchParams("cycleId=old-cycle"), notFound: () => { throw new Error("NOT_FOUND"); } } });
  // Next's image component is compiled by its bundler; this Node-only test
  // verifies cohort navigation, so retain the native image at that boundary.
  t.mock.module("next/image", { defaultExport: ({ src, alt }: { src: string; alt: string }) => createElement("img", { src, alt }) });
  t.mock.module("@/lib/workspace-context", { namedExports: { loadWorkspaceContext: async () => ({ data: { cycleId: "old-cycle", hasGroupCaseWork: true, hasSpeedDatingRound: true, hasGradingEvent: true }, error: null }) } });
  const { default: Nav } = await import("./workspace-nav");
  const user = { ...workspaceCycleFixture, memberships: workspaceCycleFixture.memberships.map((membership) => membership.cycleId === "draft-cycle" ? { ...membership, role: "MEMBER" as const } : membership) };
  const html = renderToStaticMarkup(await Nav({ user, cycleId: "old-cycle", current: "/admin/settings" }));
  for (const path of ["/member", "/admin", "/admin/rounds", "/member/group-case", "/member/speed-dating", "/admin/settings", "/admin/people", "/admin/messages"]) assert.ok(html.includes(`href="${path}?cycleId=old-cycle"`), path);
  assert.match(html, /value="old-cycle" selected/);
  assert.match(html, /value="live-cycle"/);
  assert.doesNotMatch(html, /value="draft-cycle"/, "settings switcher excludes cohorts without manage-cycle capability");
});
