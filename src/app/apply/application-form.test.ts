import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as nodeModule from "node:module";
import test, { type TestContext } from "node:test";
import { fileURLToPath } from "node:url";
import type { ComponentType, ReactElement } from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

type LoadResult = { format: string; shortCircuit?: boolean; source?: string };
type LoadHook = (url: string, context: unknown, nextLoad: (url: string, context: unknown) => LoadResult) => LoadResult;
// registerHooks is newer than the installed @types/node.
const { registerHooks } = nodeModule as unknown as { registerHooks: (hooks: { load: LoadHook }) => void };

// Same trick as src/app/apply/page.test.ts: node --test only strips types, so JSX
// is transpiled with the TypeScript already in devDependencies.
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

type FormProps = Parameters<typeof import("./application-form.js")["default"]>[0];
const BASE: FormProps = {
  initialName: "Ada",
  email: "ada@umich.edu",
  userId: "u1",
  cycleOpen: false,
  preOpenLabel: null,
  cycleId: null,
  cycleName: "Fall 2026",
  questions: [],
  initialDraft: null,
};

async function renderForm(t: TestContext, props: Partial<FormProps>, caseName: string) {
  // useRouter throws outside the app router provider; nothing under test calls it.
  t.mock.module("next/navigation", { namedExports: { useRouter: () => ({ replace() {}, refresh() {} }) } });
  // A variable specifier keeps the cache-busting query out of tsc's resolver.
  const specifier = `./application-form.tsx?case=${caseName}`;
  const { default: ApplicationForm } = await import(specifier) as { default: ComponentType<FormProps> };
  return renderToStaticMarkup(createElement(ApplicationForm, { ...BASE, ...props }) as ReactElement);
}

// Before 20:00 the applicant already sees an amber "Applications open at ..." badge and a live
// countdown. The form used to print a red "Applications are currently closed." panel directly
// under both of them.
test("before the open time the form matches the badge instead of saying closed", async (t) => {
  const markup = await renderForm(t, { preOpenLabel: "Applications open at 8:00 PM" }, "pre-open");
  assert.doesNotMatch(markup, /currently closed/);
  assert.match(markup, /Applications open at 8:00 PM/);
});

test("after the deadline the form still says applications are closed", async (t) => {
  const markup = await renderForm(t, { preOpenLabel: null }, "closed");
  assert.match(markup, /Applications are currently closed/);
});

// There is no DOM in this runner, so the Continue button cannot be clicked. This pins the control
// flow instead: move() must not gate changeStep on the save result. Gating it meant one 429 from
// the autosave rate limit stranded a student on a step until the window rolled over.
test("move advances the step even when the draft save fails", () => {
  const source = readFileSync(new URL("./application-form.tsx", import.meta.url), "utf8");
  const move = /async function move\(next: Step\) \{([\s\S]*?)\n  \}/.exec(source)?.[1];
  assert.ok(move, "move() not found in application-form.tsx");
  assert.doesNotMatch(move, /if\s*\([^)]*saveDraft/);
  assert.match(move, /saveDraft\(\{ \.\.\.draftPayload, currentStep: next \}\);\n\s*changeStep\(next\);/);
  assert.doesNotMatch(move, /await saveDraft/);
});

test("submission does not wait for autosave and reconciles an ambiguous response", () => {
  const source = readFileSync(new URL("./application-form.tsx", import.meta.url), "utf8");
  const submit = /async function submit\(\) \{([\s\S]*?)\n  \}\n\n  \/\//.exec(source)?.[1];
  assert.ok(submit, "submit() not found in application-form.tsx");
  assert.doesNotMatch(submit, /saveQueue|await saveDraft/);
  assert.match(submit, /reconcileSubmittedApplication\(\)/);
  assert.match(submit, /\[502, 503, 504\]\.includes\(response\.status\)/);
});

test("question URL validation rejects whitespace before the database does", () => {
  const source = readFileSync(new URL("./application-form.tsx", import.meta.url), "utf8");
  assert.match(source, /if \(\/\\s\/\.test\(trimmed\)/);
});

test("resume selection allows browsers that omit the PDF MIME type", () => {
  const source = readFileSync(new URL("./application-form.tsx", import.meta.url), "utf8");
  assert.ok(source.includes('!file.type && file.name.toLowerCase().endsWith(".pdf")'));
});
