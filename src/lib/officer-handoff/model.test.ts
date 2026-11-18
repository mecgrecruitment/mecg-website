import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describeAccess, handoffStatuses, itemKinds, parseHandoffBoard, parseHandoffInput, progress, starterItems, type HandoffInput } from "./model";

const out = "00000000-0000-4000-8000-000000000002";
const inc = "00000000-0000-4000-8000-000000000006";
const itemId = "00000000-0000-4000-8000-000000000010";
const form: HandoffInput = {
  roleTitle: "Treasurer", outgoingId: out, incomingId: inc, dueOn: "2026-12-15", status: "OPEN", notes: "",
  items: [{ id: null, kind: "ACCOUNT", label: "Bank signatory", detail: "", done: false }, { id: itemId, kind: "ACCESS", label: "Owner role", detail: "", done: true }],
};

test("a complete form parses and trims its text", () => {
  const parsed = parseHandoffInput({ ...form, roleTitle: "  Treasurer ", notes: " Branch visit. ", items: [{ ...form.items[0], label: " Bank signatory ", detail: " Tuesday " }] });
  assert.deepEqual(parsed, { ok: true, value: { ...form, notes: "Branch visit.", items: [{ ...form.items[0], detail: "Tuesday" }] } });
  assert.equal(parseHandoffInput({ ...form, incomingId: null, dueOn: null, items: [] }).ok, true);
});

test("malformed forms are refused with a reason", () => {
  const item = form.items[0];
  for (const bad of [
    { ...form, extra: 1 },
    { ...form, roleTitle: "  " },
    { ...form, roleTitle: "x".repeat(81) },
    { ...form, outgoingId: "board" },
    { ...form, incomingId: out },
    { ...form, incomingId: out.toUpperCase() },
    { ...form, dueOn: "2026-02-30" },
    { ...form, dueOn: "" },
    { ...form, status: "DONE" },
    { ...form, notes: "x".repeat(2001) },
    { ...form, items: "none" },
    { ...form, items: Array.from({ length: 41 }, () => item) },
    { ...form, items: [{ ...item, kind: "BANK" }] },
    { ...form, items: [{ ...item, label: "" }] },
    { ...form, items: [{ ...item, detail: "x".repeat(1001) }] },
    { ...form, items: [{ ...item, done: "yes" }] },
    { ...form, items: [{ ...item, id: "x" }] },
    { ...form, items: [{ ...item, extra: true }] },
    { ...form, items: [form.items[1], form.items[1]] },
    { ...form, status: "COMPLETE" },
    { ...form, status: "COMPLETE", incomingId: null, items: [] },
    [form],
  ]) {
    const parsed = parseHandoffInput(bad);
    assert.equal(parsed.ok, false, JSON.stringify(bad).slice(0, 120));
    if (!parsed.ok) assert.ok(parsed.error.length > 0);
  }
  assert.equal(parseHandoffInput({ ...form, status: "COMPLETE", items: [form.items[1]] }).ok, true);
});

test("status and item kind lists match the migration", () => {
  const sql = readFileSync(new URL("../../../supabase/migrations/20261118150000_officer_handoff.sql", import.meta.url), "utf8");
  const list = (values: readonly string[]) => values.map((value) => `'${value}'`).join(",");
  assert.ok(sql.includes(`status in (${list(handoffStatuses)})`));
  assert.ok(sql.includes(`kind in (${list(itemKinds)})`));
});

const access = { roles: [{ cycleId: "fall", cycleName: "Fall 2026", role: "OWNER" }], reviewerGrants: [{ cycleId: "fall", cycleName: null, tool: "evidence" }] };
const response = {
  handoffs: [{
    ...form, id: "00000000-0000-4000-8000-0000000000aa", outgoingName: "Bailey", incomingName: "Morgan",
    items: [{ id: itemId, kind: "ACCESS", label: "Owner role", detail: "", done: true, doneAt: "2026-11-18T15:00:00Z", doneByName: "Bailey" }],
    access: { outgoing: access, incoming: null }, revision: 2, completedAt: null, createdAt: "2026-11-18T15:00:00Z", updatedAt: "2026-11-18T16:00:00Z", createdByName: "Bailey", updatedByName: null,
  }],
  people: [{ id: inc, name: "Morgan" }],
};

test("a board response parses, and malformed responses throw", () => {
  const board = parseHandoffBoard(response);
  assert.equal(board.handoffs[0]?.items[0]?.doneByName, "Bailey");
  assert.deepEqual(board.people, [{ id: inc, name: "Morgan" }]);
  for (const bad of [
    null, { handoffs: [] }, { ...response, people: [{ id: "x", name: "y" }] },
    { ...response, handoffs: [{ ...response.handoffs[0], revision: 0 }] },
    { ...response, handoffs: [{ ...response.handoffs[0], items: [{ ...response.handoffs[0]!.items[0], id: null }] }] },
    { ...response, handoffs: [{ ...response.handoffs[0], access: { outgoing: { roles: [] }, incoming: null } }] },
    { ...response, handoffs: [{ ...response.handoffs[0], status: "DONE" }] },
  ]) assert.throws(() => parseHandoffBoard(bad));
});

test("access reads as one line per role or grant, falling back to the cycle id", () => {
  assert.deepEqual(describeAccess(access), ["Owner · Fall 2026", "Evidence reviewer · fall"]);
  assert.deepEqual(progress(form.items), { done: 1, total: 2 });
});

test("the starter checklist is valid as a new handoff", () => {
  const parsed = parseHandoffInput({ ...form, items: starterItems.map((item) => ({ ...item, id: null, done: false })) });
  assert.equal(parsed.ok, true);
});
