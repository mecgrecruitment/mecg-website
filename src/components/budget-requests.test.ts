import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as nodeModule from "node:module";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import type { BudgetRequest, BudgetRequestList } from "@/lib/budget/model";

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

const waiting: BudgetRequest = { id: "r1", kind: "REIMBURSEMENT", title: "Pizza for the case workshop", category: "EVENTS", amountCents: 8450, spentOn: "2026-11-10", receiptUrl: "https://drive.example.invalid/r", notes: "Paid on my card.", status: "SUBMITTED", isMine: false, requesterName: "Morgan", decisionNote: "", decidedAt: null, decidedByName: null, paidOn: null, paymentNote: "", paidRecordedByName: null, revision: 1, createdAt: "2026-11-11T20:00:00Z", updatedAt: "2026-11-11T20:00:00Z" };
const approved: BudgetRequest = { ...waiting, id: "r2", kind: "PURCHASE", title: "Banner", spentOn: null, receiptUrl: "", status: "APPROVED", decidedAt: "2026-11-12T20:00:00Z", decidedByName: "Bailey", amountCents: 12000 };
const paid: BudgetRequest = { ...waiting, id: "r3", title: "Coffee", status: "PAID", decidedAt: "2026-11-12T20:00:00Z", decidedByName: "Bailey", paidOn: "2026-11-14", paymentNote: "Club Venmo", paidRecordedByName: "Olivia", amountCents: 2500, createdAt: "2026-11-13T20:00:00Z" };
const denied: BudgetRequest = { ...waiting, id: "r4", title: "Hoodies", status: "DENIED", decidedAt: "2026-11-12T20:00:00Z", decidedByName: "Bailey", decisionNote: "Not in this term's budget." };

async function load(t: test.TestContext) {
  t.mock.module("next/navigation", { namedExports: { useRouter: () => ({ refresh() {} }) } });
  return import(`./budget-requests.tsx?${Math.random()}`);
}

test("unavailable lists show an alert and no form", async (t) => {
  const { MyBudgetRequests, BudgetRequestLog } = await load(t);
  for (const component of [MyBudgetRequests, BudgetRequestLog]) {
    const html = renderToStaticMarkup(createElement(component, { list: null }));
    assert.match(html, /role="alert"/);
    assert.doesNotMatch(html, /<form/);
  }
});

test("a member sees the form, their requests and only their own next steps", async (t) => {
  const { MyBudgetRequests, formatDay } = await load(t);
  const mine = (request: BudgetRequest) => ({ ...request, isMine: true });
  const list: BudgetRequestList = { requests: [mine(waiting), mine(approved), mine(denied)] };
  const html = renderToStaticMarkup(createElement(MyBudgetRequests, { list }));
  assert.equal(formatDay("2026-11-10"), "Nov 10, 2026", "calendar day, no time zone shift");
  assert.match(html, /\$84\.50/);
  assert.match(html, /Denied<\/span> .* by Bailey: Not in this term&#x27;s budget\./, "the member sees why");
  assert.doesNotMatch(html, /Approve<span/, "members never see approve");
  assert.doesNotMatch(html, /Record as paid/);
  // New request form, edit + withdraw on the waiting one, receipt + withdraw on the approved one; nothing on the denied one.
  assert.equal((html.match(/<form/g) ?? []).length, 5);
  assert.match(html, /Save receipt link/);
  assert.equal((html.match(/Withdraw request/g) ?? []).length, 2);
  assert.equal((html.match(/tabindex="-1" role="status"/gi) ?? []).length, 1, "one page-level saved notice");
});

test("an empty member list explains what appears there", async (t) => {
  const { MyBudgetRequests } = await load(t);
  const html = renderToStaticMarkup(createElement(MyBudgetRequests, { list: { requests: [] } }));
  assert.match(html, /haven’t sent any requests/);
  assert.equal((html.match(/<form/g) ?? []).length, 1);
});

test("the board sees totals, the queue first and no steps on its own request", async (t) => {
  const { BudgetRequestLog } = await load(t);
  const own = { ...waiting, id: "r5", title: "Printer paper", isMine: true, createdAt: "2026-11-15T20:00:00Z" };
  const html = renderToStaticMarkup(createElement(BudgetRequestLog, { list: { requests: [paid, denied, approved, waiting, own] } }));
  assert.match(html, /\$169\.00/, "two waiting requests: 84.50 + 84.50");
  assert.match(html, /\$120\.00/);
  assert.match(html, /\$25\.00/);
  const order = ["Printer paper", "Pizza for the case workshop", "Banner", "Coffee", "Hoodies"].map((title) => html.indexOf(`>${title}</h3>`));
  assert.deepEqual([...order].sort((a, b) => a - b), order, "waiting, approved, paid, denied");
  assert.match(html, /This is your own request/);
  assert.equal((html.match(/Approve<span/g) ?? []).length, 1, "only the other member's waiting request");
  assert.equal((html.match(/Record as paid/g) ?? []).length, 1);
  assert.match(html, /Paid<\/span> <time datetime="2026-11-14">Nov 14, 2026<\/time> · Club Venmo · recorded by Olivia/i);
  assert.match(html, /href="https:\/\/drive.example.invalid\/r" target="_blank" rel="noopener noreferrer"/);
  assert.match(html, /5 requests/);
  assert.equal((html.match(/<summary class="flex min-h-11/g) ?? []).length, 2, "disclosures meet the 44px target");
});
