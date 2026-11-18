import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as nodeModule from "node:module";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import type { Decision, DecisionLog as Log } from "@/lib/decisions/model";

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

const entry: Decision = { id: "d1", decidedOn: "2026-11-01", title: "Adopt the spring dues schedule", category: "FINANCE", outcome: "APPROVED", summary: "Dues stay at $40.", votes: { for: 7, against: 1, abstain: 1 }, minutesUrl: "https://docs.example.invalid/m", revision: 2, createdAt: "2026-11-01T20:00:00Z", updatedAt: "2026-11-02T20:00:00Z", createdByName: "Bailey", updatedByName: "Morgan" };
const consensus: Decision = { ...entry, id: "d2", title: "Book the union room", category: "RECRUITMENT", outcome: "NOTED", summary: "", votes: null, minutesUrl: "", revision: 1 };

async function render(t: test.TestContext, log: Log | null) {
  t.mock.module("next/navigation", { namedExports: { useRouter: () => ({ refresh() {} }) } });
  const { default: DecisionLog, formatDecisionDate } = await import(`./decision-log.tsx?${Math.random()}`);
  return { html: renderToStaticMarkup(createElement(DecisionLog, { log })), formatDecisionDate };
}

test("an unavailable log shows an alert and no form", async (t) => {
  const { html } = await render(t, null);
  assert.match(html, /role="alert"/);
  assert.doesNotMatch(html, /<form/);
});

test("an empty log offers the form and says nothing is recorded", async (t) => {
  const { html } = await render(t, { decisions: [] });
  assert.equal((html.match(/<form/g) ?? []).length, 1);
  assert.match(html, /No decisions recorded yet/);
  assert.doesNotMatch(html, /type="search"/);
});

test("entries show date, outcome, vote, minutes link and edit history", async (t) => {
  const { html, formatDecisionDate } = await render(t, { decisions: [entry, consensus] });
  assert.equal(formatDecisionDate("2026-11-01"), "Nov 1, 2026", "calendar day, no time zone shift");
  assert.match(html, /<time datetime="2026-11-01">Nov 1, 2026<\/time>/i);
  assert.match(html, /7 for · 1 against · 1 abstained/);
  assert.match(html, /No vote recorded/);
  assert.match(html, /href="https:\/\/docs.example.invalid\/m" target="_blank" rel="noopener noreferrer"/);
  assert.match(html, /edited .* by Morgan/);
  assert.equal((html.match(/edited /g) ?? []).length, 1, "only the revised entry says edited");
  assert.equal((html.match(/<form/g) ?? []).length, 3, "one record form and one edit form per entry");
  assert.match(html, /2 decisions/);
  assert.equal((html.match(/<dt/g) ?? []).length, (html.match(/<dd/g) ?? []).length);
  assert.equal((html.match(/<summary class="flex min-h-11/g) ?? []).length, 2, "edit disclosures meet the 44px target");
  assert.equal((html.match(/<button type="submit"/g) ?? []).length, 3);
  assert.equal((html.match(/tabindex="-1" role="status"/gi) ?? []).length, 3, "one persistent saved-notice region per form, outside the form that remounts");
});
