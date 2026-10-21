import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as nodeModule from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";
import type { ComponentType, ReactElement } from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

type LoadResult = { format: string; shortCircuit?: boolean; source?: string };
type LoadHook = (url: string, context: unknown, nextLoad: (url: string, context: unknown) => LoadResult) => LoadResult;
const { registerHooks } = nodeModule as unknown as { registerHooks: (hooks: { load: LoadHook }) => void };

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

type PickerProps = Parameters<typeof import("./grad-term-picker.js")["default"]>[0];

async function render(value: string) {
  const specifier = "./grad-term-picker.tsx";
  const { default: Picker } = await import(specifier) as { default: ComponentType<PickerProps> };
  return renderToStaticMarkup(createElement(Picker, { id: "gradTerm", name: "gradTerm", value, onChange() {}, baseYear: 2026, legend: "Expected graduation" }) as ReactElement);
}

const selected = (markup: string) => [...markup.matchAll(/<option value="([^"]*)" selected="">/g)].map((match) => match[1]);

test("a structured value selects its term and year", async () => {
  const markup = await render("Fall 2027");
  assert.deepEqual(selected(markup), ["Fall", "2027"]);
  assert.match(markup, /<input type="hidden" name="gradTerm" value="Fall 2027"\/>/);
});

test("free text saved before the picker stays visible as entered", async () => {
  const markup = await render("May 2028");
  assert.match(markup, />May 2028 \(as entered\)</);
  assert.deepEqual(selected(markup), ["__as_entered__", ""]);
  assert.match(markup, /value="May 2028"\/>/);
});

test("the two selects sit under one labelled group", async () => {
  const markup = await render("");
  assert.match(markup, /<fieldset[^>]*><legend>Expected graduation<\/legend>/);
  assert.match(markup, /Graduation term/);
  assert.match(markup, /Graduation year/);
  assert.doesNotMatch(markup, /as entered/);
});

test("the partial-pick hint is a polite live region the selects point at", async () => {
  const markup = await render("Fall 2027");
  assert.match(markup, /<p id="gradTerm-hint" aria-live="polite"[^>]*><\/p>/);
  assert.match(markup, /aria-describedby="gradTerm-hint"/);
});
