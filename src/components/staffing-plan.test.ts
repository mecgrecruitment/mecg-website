import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as nodeModule from "node:module";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import type { StaffingPlan } from "@/lib/staffing/model";

type LoadResult = { format: string; shortCircuit?: boolean; source?: string };
type LoadHook = (url: string, context: unknown, nextLoad: (url: string, context: unknown) => LoadResult) => LoadResult;
const { registerHooks } = nodeModule as unknown as { registerHooks: (hooks: { load: LoadHook }) => void };
// node --test cannot compile JSX, so transpile .tsx with the repo's TypeScript.
registerHooks({
  load(url, context, nextLoad) {
    const path = url.split("?")[0]!;
    if (!path.endsWith(".tsx")) return nextLoad(url, context);
    const { outputText } = ts.transpileModule(readFileSync(fileURLToPath(path), "utf8"), {
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
    });
    return { format: "module", shortCircuit: true, source: outputText };
  },
});
const { default: StaffingPlanView } = await import("./staffing-plan.tsx");

const base = { submitted: true, skills: [] as string[], preferredProjectIds: [] as string[], notes: "", revision: 1, updatedAt: "2026-11-18T09:00:00Z", roles: ["MEMBER"] };
const plan: StaffingPlan = {
  cycleId: "fall",
  projects: [{ id: "p1", title: "Pricing study", semester: "", staffCount: 1 }, { id: "p2", title: "Market entry", semester: "", staffCount: 0 }],
  members: [
    { ...base, userId: "u1", name: "Busy Bea", weeklyHours: 4, staffedProjectIds: ["p1"], skills: ["SQL"] },
    { ...base, userId: "u2", name: "Open Ola", weeklyHours: 10, staffedProjectIds: [], skills: ["Financial modeling"], preferredProjectIds: ["p2", "gone"], notes: "Away week 9" },
    { ...base, userId: "u3", name: "Quiet Quinn", submitted: false, weeklyHours: null, staffedProjectIds: [], revision: 0, updatedAt: null },
  ],
};
const render = (skill = "", value: StaffingPlan | null = plan) => renderToStaticMarkup(createElement(StaffingPlanView, { plan: value, cycleId: "fall", skill }));

test("members are listed open first, then staffed, then not submitted", () => {
  const html = render();
  assert.ok(html.indexOf("Open Ola") < html.indexOf("Busy Bea") && html.indexOf("Busy Bea") < html.indexOf("Quiet Quinn"));
  assert.match(html, /Open to staff/);
  assert.match(html, /Not submitted/);
  assert.match(html, /On Pricing study/);
  assert.match(html, /Away week 9/);
});

test("a preference for a deleted project drops out and wanted projects are counted", () => {
  const html = render();
  assert.doesNotMatch(html, /gone/);
  assert.match(html, /Market entry<\/span><span[^>]*> · 1 want · 0 staffed/);
});

test("the skill filter narrows the list and says when nothing matches", () => {
  const filtered = render("model");
  assert.match(filtered, /Open Ola/);
  assert.doesNotMatch(filtered, /Busy Bea/);
  assert.match(render("python"), /No one lists a skill matching/);
});

test("an unreadable plan shows an alert and no data", () => {
  const html = render("", null);
  assert.match(html, /role="alert"/);
  assert.doesNotMatch(html, /Open Ola/);
});
