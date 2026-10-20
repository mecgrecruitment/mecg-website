import { readFileSync } from "node:fs";
import * as nodeModule from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import assert from "node:assert/strict";
import test from "node:test";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { PublicProjectDetail } from "@/lib/projects/public-types";

type LoadResult = { format: string; shortCircuit?: boolean; source?: string };
const registerHooks: unknown = Reflect.get(nodeModule, "registerHooks");
if (typeof registerHooks !== "function") throw new Error("Node JSX test loading is unavailable");
registerHooks({ load(url: string, context: unknown, nextLoad: (url: string, context: unknown) => LoadResult) {
  if (!new URL(url).pathname.endsWith(".tsx")) return nextLoad(url, context);
  return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(fileURLToPath(url), "utf8"), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText };
} });

const PROJECT: PublicProjectDetail = {
  slug: "synthetic",
  title: "Choosing a second location",
  clientLabel: "Synthetic Bakery",
  industry: "Food & beverage",
  semester: "Fall 2026",
  decision: "Should the bakery open a second store or expand wholesale?",
  methods: ["Interviewed twelve wholesale buyers"],
  deliverables: ["A decision brief"],
  context: "The owner had one year of runway for either path.",
  constraints: [],
  memberWork: ["Built the demand model"],
};

test("a case study leads with its question on the light intro, not white-on-light text", async (t) => {
  t.mock.module("next/link", { defaultExport: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => createElement("a", { href, className }, children) });
  t.mock.module("next/navigation", { namedExports: { notFound: () => { throw new Error("not found"); } } });
  t.mock.module("@/lib/projects/public-projects", { namedExports: { getPublicProject: async () => PROJECT } });
  const { default: ProjectPage } = await import("./page.tsx");
  const html = renderToStaticMarkup(await ProjectPage({ params: Promise.resolve({ slug: "synthetic" }) }));
  assert.match(html, /The question we started from/);
  assert.match(html, /Should the bakery open a second store or expand wholesale\?/);
  assert.match(html, /For Synthetic Bakery/);
  assert.match(html, /bg-public-ground/);
  assert.doesNotMatch(html, /text-white\/70">Synthetic Bakery/);
});
