import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

registerHooks({ load(url, context, next) {
  const path = url.split("?")[0];
  if (!path.endsWith(".tsx")) return next(url, context);
  return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(fileURLToPath(path), "utf8"), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText };
} });

const batch = {
  id: "batch", status: "DRAFT", releasedAt: null,
  approved: 1, pending: 1, rejected: 0, assigned: 6, submitted: 0, packets: 2,
  reviewers: [{ id: "reader", name: "Synthetic reader", assigned: 6, submitted: 0 }],
};

async function markup(t, changes, canRelease = true) {
  // Keep the real component and mutation hook; only supply the absent Next router.
  t.mock.module("next/navigation", { namedExports: { useRouter: () => ({ refresh() {} }) } });
  const { default: Controls } = await import("./screening-controls.tsx");
  return renderToStaticMarkup(createElement(Controls, {
    cycleId: "cycle", members: [], submittedCount: 2, batch: { ...batch, ...changes }, canRelease,
    packetList: createElement("p", null, "Synthetic packet approval content"),
  }));
}

test("pending packet approval focuses the approval phase and withholds distribution", async (t) => {
  const html = await markup(t, {});
  assert.match(html, /Synthetic packet approval content/);
  assert.doesNotMatch(html, /<button[^>]*>\s*Assign readers and open review/);
  assert.doesNotMatch(html, /Close review and rank|Release internal ranking to Board/);
});

test("approved draft makes distribution available before tracking", async (t) => {
  const html = await markup(t, { pending: 0, approved: 2 });
  assert.match(html, /<button[^>]*>\s*Assign readers and open review/);
  assert.doesNotMatch(html, /Close review and rank|Release internal ranking to Board/);
});

test("published review tracks unfinished work and prevents closing early", async (t) => {
  const html = await markup(t, { status: "PUBLISHED", approved: 2, pending: 0, submitted: 3 });
  assert.match(html, /3 of 6 reviews submitted/);
  assert.match(html, /<button[^>]*disabled=""[^>]*>\s*Close review and rank/);
  assert.doesNotMatch(html, /Synthetic packet approval content|Release internal ranking to Board/);
});

test("frozen ranking exposes Owner release without offering freeze again", async (t) => {
  const html = await markup(t, { status: "FROZEN", approved: 2, pending: 0, submitted: 6 });
  assert.match(html, /Release internal ranking to Board/);
  assert.match(html, /Applicant outcomes are unchanged/);
  assert.doesNotMatch(html, /Close review and rank/);
});

test("internal release stays owner-only", async (t) => {
  const frozen = { status: "FROZEN", approved: 2, pending: 0, submitted: 6 };
  const nonOwner = await markup(t, frozen, false);
  assert.doesNotMatch(nonOwner, /<button[^>]*>Release internal ranking to Board/);
});

test("a released ranking shows its visibility without offering release again", async (t) => {
  const released = await markup(t, { status: "FROZEN", approved: 2, pending: 0, submitted: 6, releasedAt: "2026-10-17T12:00:00Z" });
  assert.match(released, /Internal ranking is visible to Board and Recruitment Committee/);
  assert.doesNotMatch(released, /<button[^>]*>Release internal ranking to Board/);
});
