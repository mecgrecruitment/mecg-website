import { readFileSync } from "node:fs";
import * as nodeModule from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import assert from "node:assert/strict";
import test from "node:test";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as recruitment from "@/lib/public-recruitment";

type LoadResult = { format: string; shortCircuit?: boolean; source?: string };
const registerHooks: unknown = Reflect.get(nodeModule, "registerHooks");
if (typeof registerHooks !== "function") throw new Error("Node JSX test loading is unavailable");
registerHooks({ load(url: string, context: unknown, nextLoad: (url: string, context: unknown) => LoadResult) {
  if (!new URL(url).pathname.endsWith(".tsx")) return nextLoad(url, context);
  return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(fileURLToPath(url), "utf8"), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText };
} });

for (const scenario of ["outage", "no-cycle", "empty-events"]) {
  const unavailable = scenario === "outage";
  test(`Join distinguishes ${scenario} recruitment data`, async (t) => {
    t.mock.module("next/image", { defaultExport: ({ src, alt }: { src: string; alt: string }) => createElement("img", { src, alt }) });
    t.mock.module("next/link", { defaultExport: ({ href, children }: { href: string; children: ReactNode }) => createElement("a", { href }, children) });
    t.mock.module("@/lib/public-recruitment", { namedExports: { ...recruitment, fetchPublicRecruitment: async () => ({ kind: unavailable ? "unavailable" : "available", cycle: scenario === "empty-events" ? { name: "Synthetic cycle", status: "DRAFT", opensAt: null, closesAt: null } : null, events: [] }) } });
    const { default: JoinPage } = await import(`./page.tsx?case=${scenario}`);
    const html = renderToStaticMarkup(await JoinPage());
    if (unavailable) {
      assert.match(html, /We couldn’t load this cycle’s dates/);
      assert.match(html, /Reload dates/);
      assert.match(html, /Email the Board/);
      assert.match(html, /Go to the application/);
      assert.doesNotMatch(html, /The Board has not published events/);
      assert.doesNotMatch(html, /Applications are closed/);
    } else if (scenario === "no-cycle") {
      assert.match(html, /No recruitment cycle is currently published/);
      assert.match(html, /Ask about recruitment/);
      assert.doesNotMatch(html, /join the interest list|get recruitment updates|recruitment-updates/i);
      assert.doesNotMatch(html, /for this cycle yet/);
    } else {
      assert.match(html, /No event dates are published for this cycle yet/);
      assert.match(html, /Join the interest list/);
      assert.doesNotMatch(html, /We couldn’t load this cycle’s dates/);
    }
  });
}
