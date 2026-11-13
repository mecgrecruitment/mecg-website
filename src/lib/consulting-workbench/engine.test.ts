import test from "node:test";
import assert from "node:assert/strict";
import { analyze, evaluationSummary, exportReport, metricValue, renderDraft } from "./engine";
import { blankRow, emptyProject, moduleKeys, parseProject } from "./schema";
import { sampleProject } from "./sample";
import { parseSuggestions } from "./assistant";
const asOf = "2026-11-12";
test("all nine workflows execute on the same importable synthetic project", () => {
  const p = sampleProject(); const parsed = parseProject(JSON.parse(JSON.stringify(p))); assert.equal(parsed.ok, true);
  assert.equal(moduleKeys.length, 9);
  for (const workflow of moduleKeys) {
    const output = analyze(p, workflow, asOf); assert.equal(output.module, workflow);
    assert.ok(output.lines.length); assert.ok(exportReport(p, output, asOf).includes("Not client approval"));
  }
});
test("research separates exact-span, semantic, authority, freshness and possible conflict findings", () => {
  const p = sampleProject(); p.records.claims[0].quote = "fabricated quotation";
  const out = analyze(p, "research", asOf);
  for (const suffix of ["C1-quote", "C2-authority", "C2-support", "C2-stale", "conflict-response target"]) assert.ok(out.findings.some(f => f.id.endsWith(suffix)), suffix);
});
test("removing a source invalidates downstream evidence and retrieval excludes revoked versions", () => {
  const p = sampleProject(); p.records.sources[0].authority = "revoked";
  const out = analyze(p, "knowledge", asOf); assert.ok(!out.lines.some(l => l.startsWith("[S1]")));
  p.records.sources = []; assert.ok(analyze(p, "research", asOf).findings.some(f => f.id.endsWith("C1-source")));
  assert.ok(analyze(p, "knowledge", asOf).lines.some(l => l.startsWith("ABSTAIN")));
});
test("feedback counts exact duplicates once with segment denominators and severe minority visibility", () => {
  const p = sampleProject(); const out = analyze(p, "feedback", asOf);
  assert.ok(out.lines.some(l => l.includes("Deduplicated English denominator: 2")));
  assert.ok(out.lines.some(l => l.includes("delay (Explicit") && l.includes("1/2")));
  assert.ok(out.lines.some(l => l.includes("SEVERE REVIEW: F3")));
  assert.ok(out.findings.some(f => f.id.endsWith("F2-duplicate")));
  p.records.feedback[0].codes = "unknown";
  assert.ok(analyze(p, "feedback", asOf).findings.some(f => f.message.includes("Unknown theme")));
});
test("reporting computes instead of trusting control, binds metric ID and rejects zero ratio denominator", () => {
  const p = sampleProject(); assert.equal(metricValue(p.records.metrics[0], p.records.observations), 30);
  assert.ok(analyze(p, "reporting", asOf).findings.some(f => f.id.endsWith("M1-reconcile")));
  assert.ok(renderDraft(p).includes("30 requests [M1; A+B]"));
  p.records.metrics[0].operation = "ratio";
  p.records.observations.forEach(r => { r.denominator = "0"; });
  assert.equal(metricValue(p.records.metrics[0], p.records.observations), null);
  assert.ok(renderDraft(p).includes("UNAVAILABLE METRIC"));
});
test("scope confirmation needs independent authority and confirmation, proposal catches missing coverage", () => {
  const p = sampleProject(); p.records.requirements[0].confirmation = "";
  assert.ok(analyze(p, "discovery", asOf).findings.some(f => f.id.endsWith("R1-confirmation")));
  assert.ok(analyze(p, "proposal", asOf).findings.some(f => f.id.endsWith("P1-scope")));
  p.records.requirements[0].coverage = "";
  assert.ok(analyze(p, "review", asOf).findings.some(f => f.id.endsWith("R1-coverage")));
});
test("process maps preserve edges and warn about shared resources rather than invent throughput", () => {
  const p = sampleProject(); p.records.stages[0].next = "missing"; p.records.stages[1].resource = p.records.stages[0].resource;
  const out = analyze(p, "process", asOf);
  assert.ok(out.findings.some(f => f.id.endsWith("edge-missing")));
  assert.ok(out.findings.some(f => f.id.endsWith("shared")));
  assert.ok(out.lines.some(l => l.includes("not network throughput")));
});
test("handoff cannot pass without recipient and observed fresh-operator evidence", () => {
  const p = sampleProject(); const out = analyze(p, "handoff", asOf);
  assert.ok(out.findings.some(f => f.id.endsWith("H1-owner")));
  assert.ok(out.findings.some(f => f.id.endsWith("H1-exercise")));
  p.records.handoff[0] = { ...p.records.handoff[0], owner: "Mock recipient", operator: "Mock fresh operator", outcome: "passed", evidence: "Synthetic exercise log" };
  assert.equal(analyze(p, "handoff", asOf).findings.filter(f => f.severity === "blocker").length, 0);
});
test("untrusted imports reject confidential labels, malformed numbers, bad dates, extra fields and duplicate IDs", () => {
  const p = sampleProject();
  assert.equal(parseProject({ ...p, dataClass: "confidential" }).ok, false);
  p.records.observations[0].value = "NaN"; assert.equal(parseProject(p).ok, false);
  p.records.observations[0].value = "3"; p.records.sources[0].date = "2026-02-30"; assert.equal(parseProject(p).ok, false);
  p.records.sources[0].date = "2026-02-20"; p.records.sources[0].extra = "x"; assert.equal(parseProject(p).ok, false);
  delete p.records.sources[0].extra; p.records.sources[1].id = p.records.sources[0].id; assert.equal(parseProject(p).ok, false);
  assert.equal(parseProject(null).ok, false);
});
test("model suggestions cannot import confirmations, approval, semantic support or passed handoffs", () => {
  const p = sampleProject();
  const r = parseSuggestions({ summary: "suggestion", tables: [{ table: "requirements", rows: [p.records.requirements[0]] }] }, "discovery");
  assert.equal(r.ok, true); if (r.ok) { assert.equal(r.value.tables[0].rows[0].state, "proposed"); assert.equal(r.value.tables[0].rows[0].confirmation, ""); }
  const h = parseSuggestions({ summary: "suggestion", tables: [{ table: "handoff", rows: [{ ...p.records.handoff[0], outcome: "passed", operator: "AI", evidence: "made up" }] }] }, "handoff");
  assert.equal(h.ok, true); if (h.ok) assert.equal(h.value.tables[0].rows[0].outcome, "not tested");
  assert.equal(parseSuggestions({ summary: "x", tables: [{ table: "capabilities", rows: p.records.capabilities }] }, "discovery").ok, false);
});
test("evaluation reports counts and uncertainty, never an invented pass", () => {
  const p = emptyProject("test");
  assert.equal(evaluationSummary(p).recall, "not measurable");
  p.records.evaluations = [{ ...blankRow("evaluations"), id: "E1", tool: "review", expected: "yes", actual: "no" }];
  const r = evaluationSummary(p); assert.equal(r.misses, 1); assert.ok(r.recall.includes("0/1")); assert.ok(r.warning.includes("No pass verdict"));
});
test("possible secrets and causal language are visible blockers/warnings", () => {
  const p = sampleProject(); p.draft += " api_key=abcdefghijklmnop";
  const out = analyze(p, "review", asOf);
  assert.ok(out.findings.some(f => f.id.endsWith("secret") && f.severity === "blocker"));
  assert.ok(out.findings.some(f => f.id.endsWith("causal")));
});
test("evaluation effort includes allocated build/upkeep and keeps defect classes separate", () => {
  const p = emptyProject("timings");
  p.records.evaluations = [
    { ...blankRow("evaluations"), id: "E1", tool: "review", class: "numeric", expected: "yes", actual: "yes", manual: "20", generic: "15", specialist: "10", workbench: "5", allocatedBuild: "7", upkeep: "1" },
    { ...blankRow("evaluations"), id: "E2", tool: "research", class: "freshness", expected: "yes", actual: "no" },
  ];
  const out = evaluationSummary(p); assert.equal(out.groups.length, 2);
  assert.ok(out.effort.includes("baseline 10 min")); assert.ok(out.effort.includes("13 min")); assert.ok(out.effort.includes("difference -3 min"));
});
test("duplicate feedback does not hide a severe record", () => {
  const p = sampleProject(); p.records.feedback[1].severity = "severe";
  assert.ok(analyze(p, "feedback", asOf).lines.some(l => l.includes("SEVERE REVIEW: F2")));
});
