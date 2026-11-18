import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as nodeModule from "node:module";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { PIPELINE_STAGES, PIPELINE_TRACKS, type Rollup } from "@/lib/opportunities/model";

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
const { default: PipelineRollup } = await import("./pipeline-rollup.tsx");

const cells = PIPELINE_STAGES.flatMap((stage) => PIPELINE_TRACKS.map((track) => ({
  stage, track, count: stage === "Proposal" ? (track === "Client" ? 2 : 1) : 0, overdue: stage === "Proposal" && track === "Client" ? 1 : 0,
})));
const board: Rollup = { cycleId: "fall", asOf: "2026-11-18", total: 3, overdue: 1, unclassified: 0, canReview: false, overdueRecords: null, cells };
const reviewer: Rollup = { ...board, canReview: true, overdueRecords: [{ id: "r1", title: "Acme Robotics", stage: "Proposal", track: "Client", nextDate: "2026-11-10", ownerName: "Avery" }] };

test("an unavailable rollup shows an alert and no counts", () => {
  const html = renderToStaticMarkup(createElement(PipelineRollup, { rollup: null, cycleId: "fall" }));
  assert.match(html, /role="alert"/);
  assert.doesNotMatch(html, /<table|<dt/);
});

test("board view shows the stage grid and says names stay private", () => {
  const html = renderToStaticMarkup(createElement(PipelineRollup, { rollup: board, cycleId: "fall" }));
  assert.equal((html.match(/<th scope="row"/g) ?? []).length, PIPELINE_STAGES.length);
  assert.match(html, /Board rank shows counts only/);
  assert.doesNotMatch(html, /Past-due next actions|Open the pipeline/);
  assert.equal((html.match(/<dt/g) ?? []).length, (html.match(/<dd/g) ?? []).length);
});

test("reviewer view lists overdue titles and links to the pipeline", () => {
  const html = renderToStaticMarkup(createElement(PipelineRollup, { rollup: reviewer, cycleId: "fall" }));
  assert.match(html, /Acme Robotics/);
  assert.match(html, /Nov 10, 2026/);
  assert.match(html, /href="\/member\/tools\/pipeline\?cycleId=fall"/);
  assert.doesNotMatch(html, /Board rank shows counts only/);
});

test("an empty cycle says so instead of an all-zero table", () => {
  const empty = { ...board, total: 0, overdue: 0, cells: cells.map((c) => ({ ...c, count: 0, overdue: 0 })) };
  const html = renderToStaticMarkup(createElement(PipelineRollup, { rollup: empty, cycleId: "fall" }));
  assert.doesNotMatch(html, /<table/);
  assert.match(html, /No member has added/);
});
