import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  availableActions, budgetCategories, formatCents, orderForBoard, parseActionPayload, parseBudgetRequestInput, parseBudgetRequestList,
  parseDollars, requestKinds, requestStatuses, summarizeRequests, type BudgetRequest, type BudgetRequestInput,
} from "./model";

const form: BudgetRequestInput = { kind: "REIMBURSEMENT", title: "Pizza for the case workshop", category: "EVENTS", amountCents: 8450, spentOn: "2026-11-10", receiptUrl: "https://drive.example.invalid/r", notes: "" };

test("dollar amounts become whole cents without float rounding", () => {
  assert.equal(parseDollars("84.5"), 8450);
  assert.equal(parseDollars("$1,234.56"), 123456);
  assert.equal(parseDollars(" 12 "), 1200);
  assert.equal(parseDollars("0.29"), 29);
  assert.equal(parseDollars("10000"), 1_000_000);
  for (const bad of ["", "0", "0.00", "-5", "1.234", "abc", "10000.01", "1,23", "1e3", "12."]) assert.equal(parseDollars(bad), null, bad);
  assert.equal(formatCents(123456), "$1,234.56");
});

test("a complete form parses and trims its text", () => {
  assert.deepEqual(parseBudgetRequestInput({ ...form, title: "  Pizza  ", notes: " Tip included. ", receiptUrl: " https://drive.example.invalid/r " }),
    { ok: true, value: { ...form, title: "Pizza", notes: "Tip included." } });
  assert.equal(parseBudgetRequestInput({ ...form, kind: "PURCHASE", spentOn: null, receiptUrl: "" }).ok, true);
});

test("malformed forms are refused with a reason", () => {
  for (const bad of [
    { ...form, extra: 1 },
    { ...form, kind: "GIFT" },
    { ...form, title: "  " },
    { ...form, title: "x".repeat(201) },
    { ...form, category: "PARTY" },
    { ...form, amountCents: 0 },
    { ...form, amountCents: 84.5 },
    { ...form, amountCents: "8450" },
    { ...form, amountCents: 1_000_001 },
    { ...form, spentOn: null },
    { ...form, spentOn: "2026-02-30" },
    { ...form, receiptUrl: "http://drive.example.invalid/r" },
    { ...form, receiptUrl: "javascript:alert(1)" },
    { ...form, notes: "x".repeat(2001) },
    [form],
    null,
  ]) {
    const parsed = parseBudgetRequestInput(bad);
    assert.equal(parsed.ok, false, JSON.stringify(bad));
    if (!parsed.ok) assert.ok(parsed.error.length > 0);
  }
});

test("action payloads match their action", () => {
  assert.deepEqual(parseActionPayload("WITHDRAW", {}), { ok: true, value: {} });
  assert.deepEqual(parseActionPayload("APPROVE", { note: " ok " }), { ok: true, value: { note: "ok" } });
  assert.deepEqual(parseActionPayload("APPROVE", { note: "" }), { ok: true, value: { note: "" } });
  assert.deepEqual(parseActionPayload("MARK_PAID", { paidOn: "2026-11-14", paymentNote: " Venmo " }), { ok: true, value: { paidOn: "2026-11-14", paymentNote: "Venmo" } });
  for (const [action, payload] of [
    ["WITHDRAW", { note: "" }], ["DENY", { note: "  " }], ["APPROVE", {}], ["APPROVE", { note: "x".repeat(1001) }],
    ["MARK_PAID", { paidOn: "2026-13-01", paymentNote: "" }], ["MARK_PAID", { paidOn: "2026-11-14" }], ["MARK_PAID", { paidOn: "2026-11-14", paymentNote: "x".repeat(201) }],
    ["APPROVE", null],
  ] as const) assert.equal(parseActionPayload(action, payload).ok, false, `${action} ${JSON.stringify(payload)}`);
});

const entry: BudgetRequest = { ...form, id: "00000000-0000-4000-8000-000000000010", status: "SUBMITTED", isMine: false, requesterName: "Member", decisionNote: "", decidedAt: null, decidedByName: null, paidOn: null, paymentNote: "", paidRecordedByName: null, revision: 1, createdAt: "2026-11-12T20:00:00Z", updatedAt: "2026-11-12T20:00:00Z" };

test("the list response parses and malformed responses throw", () => {
  assert.deepEqual(parseBudgetRequestList({ requests: [entry] }), { requests: [entry] });
  for (const bad of [null, {}, { requests: [{ ...entry, status: "OPEN" }] }, { requests: [{ ...entry, revision: 0 }] }, { requests: [{ ...entry, receiptUrl: "javascript:x" }] },
    { requests: [{ ...entry, isMine: "no" }] }, { requests: [{ ...entry, status: "PAID" }] }, { requests: [{ ...entry, paidOn: "2026-11-14" }] }, { requests: [{ ...entry, title: " padded " }] }]) {
    assert.throws(() => parseBudgetRequestList(bad), JSON.stringify(bad));
  }
});

test("the summary and board order follow status", () => {
  const list: BudgetRequest[] = [
    { ...entry, id: "paid", status: "PAID", paidOn: "2026-11-14", amountCents: 1000, createdAt: "2026-11-15T00:00:00Z" },
    { ...entry, id: "old-wait", amountCents: 500, createdAt: "2026-11-01T00:00:00Z" },
    { ...entry, id: "approved", status: "APPROVED", amountCents: 300 },
    { ...entry, id: "new-wait", amountCents: 200, createdAt: "2026-11-13T00:00:00Z" },
    { ...entry, id: "denied", status: "DENIED", amountCents: 9999 },
  ];
  assert.deepEqual(summarizeRequests(list), { waiting: { count: 2, cents: 700 }, approvedUnpaid: { count: 1, cents: 300 }, paid: { count: 1, cents: 1000 } });
  assert.deepEqual(orderForBoard(list).map((r) => r.id), ["new-wait", "old-wait", "approved", "paid", "denied"]);
});

test("nobody acts on their own request except to withdraw it", () => {
  assert.deepEqual(availableActions(entry, "board"), ["APPROVE", "DENY"]);
  assert.deepEqual(availableActions({ ...entry, isMine: true }, "board"), []);
  assert.deepEqual(availableActions({ ...entry, status: "APPROVED" }, "board"), ["MARK_PAID"]);
  assert.deepEqual(availableActions({ ...entry, status: "PAID", paidOn: "2026-11-14" }, "board"), []);
  assert.deepEqual(availableActions({ ...entry, isMine: true }, "member"), ["WITHDRAW"]);
  assert.deepEqual(availableActions({ ...entry, isMine: true, status: "APPROVED" }, "member"), ["WITHDRAW"]);
  assert.deepEqual(availableActions({ ...entry, isMine: true, status: "DENIED" }, "member"), []);
});

test("kinds, categories and statuses match the migration", () => {
  const sql = readFileSync(new URL("../../../supabase/migrations/20261118190000_budget_requests.sql", import.meta.url), "utf8");
  const list = (column: string) => sql.match(new RegExp(`${column} text not null (?:default '[A-Z]+' )?check \\(${column} in \\(([^)]*)\\)\\)`))?.[1]?.split(",").map((value) => value.replace(/'/g, "").trim());
  assert.deepEqual(list("kind"), [...requestKinds]);
  assert.deepEqual(list("category"), [...budgetCategories]);
  assert.deepEqual(list("status"), [...requestStatuses]);
  for (const value of budgetCategories) assert.equal((sql.match(new RegExp(`'${value}'`, "g")) ?? []).length, 2, `${value} in the table and the save check`);
});
