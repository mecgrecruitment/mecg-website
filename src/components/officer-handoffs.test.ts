import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as nodeModule from "node:module";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import type { Handoff, HandoffBoard } from "@/lib/officer-handoff/model";

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


const outgoing = "00000000-0000-4000-8000-000000000002";
const incoming = "00000000-0000-4000-8000-000000000006";
const open: Handoff = {
  id: "00000000-0000-4000-8000-0000000000aa", roleTitle: "Treasurer", outgoingId: outgoing, incomingId: incoming, outgoingName: "Bailey", incomingName: "Morgan",
  dueOn: "2026-12-01", status: "OPEN", notes: "Branch visit needs both officers.",
  items: [
    { id: "00000000-0000-4000-8000-000000000011", kind: "ACCOUNT", label: "Bank signatory", detail: "", done: true, doneAt: "2026-11-18T15:00:00Z", doneByName: "Bailey" },
    { id: "00000000-0000-4000-8000-000000000012", kind: "OPEN_ITEM", label: "Pending reimbursements", detail: "Two receipts", done: false, doneAt: null, doneByName: null },
  ],
  access: { outgoing: { roles: [{ cycleId: "fall", cycleName: "Fall 2026", role: "OWNER" }], reviewerGrants: [{ cycleId: "fall", cycleName: "Fall 2026", tool: "evidence" }] }, incoming: { roles: [], reviewerGrants: [] } },
  revision: 2, completedAt: null, createdAt: "2026-11-17T15:00:00Z", updatedAt: "2026-11-18T15:00:00Z", createdByName: "Bailey", updatedByName: "Bailey",
};
// The outgoing officer of the finished handoff has left, so they are not in the people list.
const finished: Handoff = { ...open, id: "00000000-0000-4000-8000-0000000000bb", roleTitle: "President", status: "COMPLETE", completedAt: "2026-06-01T15:00:00Z", outgoingId: "00000000-0000-4000-8000-000000000009", outgoingName: "Casey", items: [open.items[0]!], access: { outgoing: { roles: [], reviewerGrants: [] }, incoming: null }, incomingId: incoming };
const people = [{ id: outgoing, name: "Bailey" }, { id: incoming, name: "Morgan" }];

async function render(t: test.TestContext, board: HandoffBoard | null) {
  t.mock.module("next/navigation", { namedExports: { useRouter: () => ({ refresh() {} }) } });
  const { default: OfficerHandoffs, formatDueDate } = await import(`./officer-handoffs.tsx?${Math.random()}`);
  return { html: renderToStaticMarkup(createElement(OfficerHandoffs, { board })), formatDueDate };
}

test("unavailable handoffs show an alert and no form", async (t) => {
  const { html } = await render(t, null);
  assert.match(html, /role="alert"/);
  assert.doesNotMatch(html, /<form/);
});

test("with no handoffs, the start form offers the starter checklist", async (t) => {
  const { html } = await render(t, { handoffs: [], people });
  assert.equal((html.match(/<form/g) ?? []).length, 1);
  assert.match(html, /No handoffs in progress/);
  assert.match(html, /Member-tool reviewer grants/);
  assert.match(html, /0 of 7 done/);
  assert.match(html, /Never write passwords/);
  assert.doesNotMatch(html, /Finished/);
});

test("handoffs show progress, people, live access and edit history", async (t) => {
  const { html, formatDueDate } = await render(t, { handoffs: [open, finished], people });
  assert.equal(formatDueDate("2026-12-01"), "Dec 1, 2026", "calendar day, no time zone shift");
  assert.match(html, /<time datetime="2026-12-01">Dec 1, 2026<\/time>/i);
  assert.match(html, /1 of 2 done/);
  assert.match(html, /Owner · Fall 2026/);
  assert.match(html, /Evidence reviewer · Fall 2026/);
  assert.match(html, /No elevated roles or reviewer grants yet/);
  assert.match(html, /Ticked .* by Bailey/);
  assert.match(html, /Casey \(no longer active\)/, "a departed officer stays selectable on their own handoff");
  assert.match(html, /Finished/);
  assert.equal((html.match(/<form/g) ?? []).length, 3, "the open handoff, the finished one in a disclosure, and the start form");
  assert.equal((html.match(/<summary class="flex min-h-11/g) ?? []).length, 1, "only the finished handoff hides its form");
  assert.equal((html.match(/<dt/g) ?? []).length, (html.match(/<dd/g) ?? []).length);
  assert.equal((html.match(/tabindex="-1" role="status"/gi) ?? []).length, 2, "one page-level notice for card saves and one for the start form, outside the forms that remount");
  assert.ok(html.indexOf("Treasurer") < html.indexOf("Start a handoff") && html.indexOf("Start a handoff") < html.indexOf("President"));
});
