import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { decisionCategories, decisionOutcomes, filterDecisions, parseDecisionInput, parseDecisionLog, type DecisionInput } from "./model";

const form: DecisionInput = { decidedOn: "2026-11-12", title: "Adopt the spring dues schedule", category: "FINANCE", outcome: "APPROVED", summary: "", votes: { for: 7, against: 1, abstain: 1 }, minutesUrl: "https://docs.example.invalid/m" };

test("a complete form parses and trims its text", () => {
  const parsed = parseDecisionInput({ ...form, title: "  Adopt dues  ", summary: " Kept at $40. ", minutesUrl: " https://docs.example.invalid/m " });
  assert.deepEqual(parsed, { ok: true, value: { ...form, title: "Adopt dues", summary: "Kept at $40.", minutesUrl: "https://docs.example.invalid/m" } });
  assert.equal(parseDecisionInput({ ...form, votes: null, minutesUrl: "" }).ok, true);
});

test("malformed forms are refused with a reason", () => {
  for (const bad of [
    { ...form, extra: 1 },
    { ...form, decidedOn: "2026-02-30" },
    { ...form, decidedOn: "" },
    { ...form, title: "   " },
    { ...form, title: "x".repeat(201) },
    { ...form, category: "SOCIAL" },
    { ...form, outcome: "PASSED" },
    { ...form, summary: "x".repeat(2001) },
    { ...form, votes: { for: 1, against: 1 } },
    { ...form, votes: { for: 1.5, against: 1, abstain: 0 } },
    { ...form, votes: { for: -1, against: 1, abstain: 0 } },
    { ...form, votes: { for: 201, against: 0, abstain: 0 } },
    { ...form, votes: "7-1-1" },
    { ...form, minutesUrl: "http://docs.example.invalid/m" },
    { ...form, minutesUrl: "javascript:alert(1)" },
    { ...form, minutesUrl: "https://has space.example/m" },
    { ...form, minutesUrl: `https://e.invalid/${"x".repeat(500)}` },
    [form],
    null,
  ]) {
    const parsed = parseDecisionInput(bad);
    assert.equal(parsed.ok, false, JSON.stringify(bad));
    if (!parsed.ok) assert.ok(parsed.error.length > 0);
  }
});

const entry = { ...form, id: "00000000-0000-4000-8000-000000000010", revision: 2, createdAt: "2026-11-12T20:00:00Z", updatedAt: "2026-11-13T20:00:00Z", createdByName: "Board", updatedByName: null };

test("the log response parses and malformed responses throw", () => {
  assert.deepEqual(parseDecisionLog({ decisions: [entry] }), { decisions: [entry] });
  for (const bad of [null, {}, { decisions: [{ ...entry, outcome: "PASSED" }] }, { decisions: [{ ...entry, revision: 0 }] }, { decisions: [{ ...entry, minutesUrl: "javascript:x" }] }, { decisions: [{ ...entry, votes: { for: 1 } }] }]) {
    assert.throws(() => parseDecisionLog(bad), JSON.stringify(bad));
  }
});

test("filters match category, outcome and words in the title or summary", () => {
  const list = [entry, { ...entry, id: "b", category: "CLIENTS" as const, outcome: "DEFERRED" as const, title: "Take the clinic project", summary: "Pending scope from the nonprofit." }];
  assert.deepEqual(filterDecisions(list, { category: "CLIENTS", outcome: "", query: "" }).map((d) => d.id), ["b"]);
  assert.deepEqual(filterDecisions(list, { category: "", outcome: "APPROVED", query: "" }).map((d) => d.id), [entry.id]);
  assert.deepEqual(filterDecisions(list, { category: "", outcome: "", query: "  NONPROFIT " }).map((d) => d.id), ["b"]);
  assert.equal(filterDecisions(list, { category: "", outcome: "", query: "" }).length, 2);
});

test("categories and outcomes match the migration", () => {
  const sql = readFileSync(new URL("../../../supabase/migrations/20261118130000_board_decision_log.sql", import.meta.url), "utf8");
  const list = (column: string) => sql.match(new RegExp(`${column} text not null check \\(${column} in \\(([^)]*)\\)\\)`))?.[1]?.split(",").map((value) => value.replace(/'/g, "").trim());
  assert.deepEqual(list("category"), [...decisionCategories]);
  assert.deepEqual(list("outcome"), [...decisionOutcomes]);
  for (const value of [...decisionCategories, ...decisionOutcomes]) assert.equal((sql.match(new RegExp(`'${value}'`, "g")) ?? []).length, 2, value);
});
