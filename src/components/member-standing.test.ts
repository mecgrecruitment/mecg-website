import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as nodeModule from "node:module";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import type { Standing } from "@/lib/standing/model";

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
const { default: MemberStanding } = await import("./member-standing.tsx");

const standing: Standing = {
  cycleId: "fall",
  thresholds: { minAttendancePct: 50, minProjects: 1, requireOnboarding: true, revision: 0, updatedAt: null, configured: false },
  members: [
    { userId: "u1", name: "Avery", roles: ["MEMBER"], eventsAttended: 2, eventsHeld: 2, projects: 1, onboardingDone: 5, onboardingTotal: 5 },
    { userId: "u2", name: "Zoe", roles: ["BOARD", "MEMBER"], eventsAttended: 0, eventsHeld: 2, projects: 0, onboardingDone: null, onboardingTotal: null },
  ],
};

test("an unavailable rollup shows an alert and no rows", () => {
  const html = renderToStaticMarkup(createElement(MemberStanding, { standing: null, cycleId: "fall" }));
  assert.match(html, /role="alert"/);
  assert.doesNotMatch(html, /<li/);
});

test("at-risk members lead with their reasons; untracked onboarding is not flagged", () => {
  const html = renderToStaticMarkup(createElement(MemberStanding, { standing, cycleId: "fall" }));
  assert.ok(html.indexOf("Zoe") < html.indexOf("Avery"), "at-risk member first");
  assert.match(html, /At risk · Low attendance, Not staffed/);
  assert.doesNotMatch(html, /Not staffed, Onboarding open/);
  assert.match(html, /Not tracked/);
  assert.match(html, /These are the default thresholds/);
  assert.match(html, /href="\/admin\/settings\?cycleId=fall#member-standing"/);
});
