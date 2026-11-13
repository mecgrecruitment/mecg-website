import test from "node:test";
import assert from "node:assert/strict";
import { analyze, renderDraft } from "./engine";
import { blankRow, moduleKeys, parseProject } from "./schema";
import { sampleProject } from "./sample";
import { importCsv, readCsv } from "./csv";
import { retrieve } from "./retrieval";
import { suggestionFormat } from "./assistant";
const date = "2026-11-12";
test("research distinguishes competitors instead of treating different companies as conflicting facts", () => {
  const p = sampleProject(); p.records.claims[0].entity = "Alpha"; p.records.claims[1].entity = "Beta";
  assert.ok(!analyze(p, "research", date).findings.some(f => f.id.includes("conflict-")));
  p.records.claims[1].entity = "Alpha";
  assert.ok(analyze(p, "research", date).findings.some(f => f.id.includes("conflict-alpha / response target")));
});
test("feedback suggests keyword coding without mutating or silently counting it", () => {
  const p = sampleProject(); p.records.themes[0].keywords = "waited"; p.records.feedback[0].codes = "";
  const output = analyze(p, "feedback", date);
  assert.ok(output.lines.some(l => l.includes("UNREVIEWED coding candidates for delay: F1")));
  assert.equal(p.records.feedback[0].codes, "");
  assert.ok(output.lines.some(l => l.includes("CODING COVERAGE: 1/2")));
});
test("document retrieval enforces quoted phrases, permissions, authority and no-results abstention", () => {
  const p = sampleProject(); p.question = '"response target"';
  assert.equal(retrieve(p)[0]?.source.id, "S1");
  p.records.sources[0].permission = ""; assert.equal(retrieve(p).length, 0);
  p.question = '"unavailable exact phrase"'; assert.ok(analyze(p, "knowledge", date).lines.some(l => l.startsWith("ABSTAIN")));
});
test("process mapping exposes rework cycles and explicit sensitivity ranges", () => {
  const p = sampleProject(); p.records.stages[1].next = "intake";
  const output = analyze(p, "process", date);
  assert.ok(output.findings.some(f => f.id.endsWith("rework-cycle")));
  assert.ok(output.lines.some(l => l.includes("SENSITIVITY intake:")));
  assert.ok(output.lines.every(l => !l.includes("Infinity")));
});
test("reporting requires prior-period evidence and handles zero baselines without invented growth", () => {
  const p = sampleProject(); p.records.metrics[0].prior = "0";
  assert.ok(analyze(p, "reporting", date).findings.some(f => f.id.endsWith("M1-prior-source")));
  p.records.metrics[0].priorSource = "S3"; p.records.metrics[0].priorPeriod = "Prior";
  const output = analyze(p, "reporting", date);
  assert.ok(output.lines.some(l => l.includes("relative change undefined from zero baseline")));
  assert.ok(output.lines.some(l => l.includes("LINEAGE M1: O1 → S3; O2 → S3")));
});
test("proposal produces an acceptance-based scope and leaves tentative requests out of commitments", () => {
  const output = analyze(sampleProject(), "proposal", date);
  assert.ok(output.lines.includes("DRAFT PROJECT SCOPE"));
  assert.ok(output.lines.some(l => l.includes("Not agreed / discovery questions: R2")));
  assert.ok(output.lines.some(l => l.startsWith("Deliverable:") && l.includes("Acceptance:")));
});
test("discovery detects the same requirement marked both confirmed and rejected", () => {
  const p = sampleProject(); p.records.requirements.push({ ...p.records.requirements[0], id: "R3", state: "rejected" });
  assert.ok(analyze(p, "discovery", date).findings.some(f => f.id.endsWith("R1-state-conflict")));
});
test("deliverable claim interpolation checks sources and never renders unsupported quotations as verified", () => {
  const p = sampleProject(); p.draft = "[[claim:C1]] TODO: finish this paragraph.";
  assert.ok(renderDraft(p).includes("24 hours [C1; S1;"));
  assert.ok(analyze(p, "review", date).findings.some(f => f.id.endsWith("unfinished")));
  p.records.sources[0].authority = "revoked";
  assert.ok(renderDraft(p).includes("UNAVAILABLE CLAIM C1"));
  assert.ok(analyze(p, "review", date).findings.some(f => f.id.endsWith("claim-reference-C1")));
});
test("handoff rejects self-testing by the original builder and flags ended support", () => {
  const p = sampleProject(); p.records.handoff[0] = { ...p.records.handoff[0], builder: "Builder", operator: " builder ", outcome: "passed", supportEnd: "2026-01-01" };
  const output = analyze(p, "handoff", date);
  assert.ok(output.findings.some(f => f.id.endsWith("fresh-operator") && f.severity === "blocker"));
  assert.ok(output.findings.some(f => f.id.endsWith("support-end")));
});
test("CSV supports BOM CRLF escaped quotes multiline fields, generated IDs and aliases", () => {
  const parsed = importCsv("feedback", '\uFEFFOriginal feedback,Segment\r\n"It said ""waiting"", then\nfailed",new\r\n', []);
  assert.equal(parsed.ok, true);
  if (parsed.ok) { assert.equal(parsed.value[0].text, 'It said "waiting", then\nfailed'); assert.equal(parsed.value[0].id, "feedback-import-1"); assert.equal(parsed.value[0].language, "English"); }
});
test("CSV import is atomic on unknown headers, duplicate IDs, malformed quoting and nonnumeric cells", () => {
  const p = sampleProject();
  assert.equal(importCsv("feedback", "id,text\nF1,changed", p.records.feedback).ok, false);
  assert.equal(p.records.feedback[0].text, "I waited too long for a response.");
  assert.equal(importCsv("feedback", "unknown\nvalue", []).ok, false);
  assert.equal(importCsv("feedback", "id,Record ID\nx,x", []).ok, false);
  assert.equal(readCsv('id,text\nx,"unclosed').ok, false);
  assert.equal(readCsv('id,text\nx,"done"oops').ok, false);
  assert.equal(importCsv("observations", "value\nNaN", []).ok, false);
});
test("deployed version-one project files remain importable with additive fields defaulted", () => {
  const p = sampleProject();
  for (const r of p.records.claims) delete r.entity;
  for (const r of p.records.themes) delete r.keywords;
  for (const r of p.records.handoff) { delete r.builder; delete r.supportEnd; }
  for (const r of p.records.metrics) { delete r.prior; delete r.priorPeriod; delete r.priorSource; }
  const output = parseProject(JSON.parse(JSON.stringify(p))); assert.equal(output.ok, true);
  if (output.ok) { assert.equal(output.value.records.claims[0].entity, ""); assert.equal(output.value.records.metrics[0].prior, ""); }
});
test("all nine AI schemas require exact catalogue fields and restrict table variants", () => {
  for (const workflow of moduleKeys) {
    const format = suggestionFormat(workflow); assert.equal(format.type, "json_schema"); assert.equal(format.strict, true);
    assert.equal(format.schema.additionalProperties, false);
    for (const variant of format.schema.properties.tables.items.anyOf) { assert.equal(variant.additionalProperties, false); assert.ok(variant.properties.rows.items.required.includes("id")); assert.equal(variant.properties.rows.items.additionalProperties, false); }
  }
  const r = blankRow("reviewLog"); assert.equal(r.state, "open");
});
