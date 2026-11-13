import { insights } from "./insights";
import { retrieve } from "./retrieval";
import { modules, type Module, type Project, type Row } from "./schema";
export type Finding = { id: string; severity: "blocker" | "attention"; location: string; message: string };
export type Analysis = { module: Module; findings: Finding[]; lines: string[]; coverage: string; status: "needs review" | "checks found blockers" };
const list = (s: string): string[] => [...new Set(s.split(",").map(s => s.trim()).filter(Boolean))];
const contains = (s: string, fragment: string) => fragment.trim().length > 0 && s.includes(fragment);
export function metricValue(metric: Row, rows: Row[]): number | null {
  const input = rows.filter(r => r.metric === metric.id);
  if (!input.length || input.some(r => r.value === "" || (metric.operation === "ratio" && r.denominator === ""))) return null;
  const numerator = input.reduce((n, r) => n + Number(r.value), 0);
  const denominator = input.reduce((n, r) => n + Number(r.denominator), 0);
  const value = metric.operation === "sum" ? numerator : metric.operation === "mean" ? numerator / input.length : denominator === 0 ? null : numerator / denominator;
  return value !== null && Number.isFinite(value) ? value : null;
}
export function analyze(project: Project, module: Module, asOf: string): Analysis {
  const findings: Finding[] = []; const lines: string[] = [];
  const add = (id: string, severity: Finding["severity"], location: string, message: string) => findings.push({ id: `${module}-${id}`, severity, location, message });
  const source = (id: string) => project.records.sources.find(s => s.id === id);
  const evidence = (row: Row, location: string, quote = true) => {
    const s = source(row.source);
    if (!s) { add(`${location}-source`, "blocker", location, `Missing source ${row.source || "ID"}.`); return; }
    if (s.authority !== "approved") add(`${location}-authority`, "blocker", location, `Source ${s.id} is ${s.authority}; it cannot substantiate released work.`);
    if (!s.permission.trim()) add(`${location}-permission`, "blocker", location, "Record the source-use permission or licence.");
    if (quote && !contains(s.text, row.quote)) add(`${location}-quote`, "blocker", location, "Quote is missing or is not an exact substring of the source.");
  };
  const claims = () => {
    const topics = new Map<string, Set<string>>();
    for (const row of project.records.claims) {
      evidence(row, row.id);
      if (!row.topic.trim() || !row.value.trim()) add(`${row.id}-definition`, "blocker", row.id, "Define a comparison topic and claim value.");
      if (row.support !== "supported") add(`${row.id}-support`, "blocker", row.id, "A person must check whether the quote actually supports the claim.");
      const s = source(row.source);
      if (!s?.date || !row.maxAge || Number(row.maxAge) < 0) add(`${row.id}-freshness`, "attention", row.id, "Set a source as-of date and nonnegative freshness threshold.");
      else {
        const days = (Date.parse(asOf) - Date.parse(s.date)) / 86400000;
        if (days < 0) add(`${row.id}-future`, "attention", row.id, "Source date is after the review date.");
        if (days > Number(row.maxAge)) add(`${row.id}-stale`, "attention", row.id, `Source is ${Math.floor(days)} days old; threshold is ${row.maxAge}. Recheck.`);
      }
      const topicKey = `${row.entity?.trim().toLowerCase() ? row.entity.trim().toLowerCase() + " / " : ""}${row.topic.trim().toLowerCase()}`;
      const values = topics.get(topicKey) ?? new Set<string>(); values.add(row.value.trim().toLowerCase()); topics.set(topicKey, values);
      lines.push(`${row.id}: ${row.topic} — ${row.value} [${row.source}] “${row.quote}”`);
    }
    for (const [topic, values] of topics) if (values.size > 1) add(`conflict-${topic}`, "attention", topic, "Different values share this topic. Check entities, definitions and dates; this is a possible conflict, not an established contradiction.");
    if (!project.records.claims.length) add("empty-claims", "attention", "Research", "Add bounded comparison claims. Empty input is not a successful review.");
  };
  const reporting = () => {
    const inputKeys = new Set<string>();
    for (const row of project.records.observations) {
      const inputKey = JSON.stringify([row.metric, row.value, row.denominator, row.source]);
      if (inputKeys.has(inputKey)) add(`${row.id}-duplicate-input`, "attention", row.id, "Identical metric/value/source input found. Confirm whether it is a distinct observation; counts are not silently deduplicated.");
      inputKeys.add(inputKey);
      if (!project.records.metrics.some(m => m.id === row.metric)) add(`${row.id}-metric`, "blocker", row.id, "Input references an unknown metric.");
      evidence(row, row.id, false);
    }
    for (const metric of project.records.metrics) {
      if (![metric.name, metric.unit, metric.period, metric.owner].every(s => s.trim())) add(`${metric.id}-dictionary`, "blocker", metric.id, "Complete definition, unit, period and definition owner.");
      const value = metricValue(metric, project.records.observations);
      if (value === null) add(`${metric.id}-input`, "blocker", metric.id, "No complete inputs, non-finite result or zero aggregate denominator.");
      if (metric.expected === "") add(`${metric.id}-control`, "blocker", metric.id, "Enter an independently established control total.");
      else if (value !== null && Math.abs(value - Number(metric.expected)) > 1e-9 * Math.max(1, Math.abs(value), Math.abs(Number(metric.expected)))) add(`${metric.id}-reconcile`, "blocker", metric.id, `Computed ${value} does not reconcile with control ${metric.expected}.`);
      lines.push(`${metric.id}: ${metric.name} = ${value === null ? "UNAVAILABLE" : value} ${metric.unit}; period ${metric.period}; ${metric.operation}; owner ${metric.owner}.`);
    }
    if (!project.records.metrics.length) add("empty-metrics", "attention", "Metrics", "No metric definitions provided.");
  };
  const discovery = () => {
    for (const row of project.records.requirements) {
      evidence(row, row.id);
      if (!row.text.trim()) add(`${row.id}-text`, "blocker", row.id, "Specify the need and acceptance criterion.");
      if (row.state === "confirmed" && ![row.speaker, row.authority, row.confirmation].every(s => s.trim())) add(`${row.id}-confirmation`, "blocker", row.id, "Confirmed scope needs attributed speaker, authority evidence and confirmation evidence.");
      if (row.state === "proposed" || row.state === "awaiting confirmation") add(`${row.id}-tentative`, "attention", row.id, "This is tentative scope, not an agreed commitment.");
      lines.push(`${row.id} [${row.state}]: ${row.text}; speaker ${row.speaker || "uncertain"}; confirmation ${row.confirmation || "none"}.`);
    }
    if (!project.records.requirements.length) add("empty-requirements", "attention", "Scope", "No requirements recorded.");
  };
  switch (module) {
    case "research": claims(); break;
    case "feedback": {
      const seen = new Set<string>(); const unique: Row[] = [];
      for (const row of project.records.feedback) {
        if (!row.text.trim()) { add(`${row.id}-empty`, "blocker", row.id, "Feedback text is empty."); continue; }
        if (row.severity === "severe") lines.push(`LOW-COUNT / SEVERE REVIEW: ${row.id} — “${row.text}”`);
        const key = `${row.segment}\u0000${row.text.trim()}`;
        if (seen.has(key)) { add(`${row.id}-duplicate`, "attention", row.id, "Exact text/segment duplicate excluded from coded counts. This does not identify unique customers."); continue; }
        seen.add(key);
        if (row.language !== "English") { add(`${row.id}-language`, "attention", row.id, "Unsupported language excluded from coded counts; needs separate review."); continue; }
        unique.push(row);
        for (const code of list(row.codes)) if (!project.records.themes.some(t => t.id === code)) add(`${row.id}-${code}`, "blocker", row.id, `Unknown theme ${code}.`);
        if (!row.codes.trim()) add(`${row.id}-uncoded`, "attention", row.id, "Record has not been coded.");
      }
      lines.unshift(`Raw records: ${project.records.feedback.length}. Deduplicated English denominator: ${unique.length}. Counts represent records, not people; multi-label totals may exceed denominator.`);
      for (const theme of project.records.themes) {
        if (!theme.definition.trim()) add(`${theme.id}-definition`, "blocker", theme.id, "Define the coding rule.");
        const coded = unique.filter(r => list(r.codes).includes(theme.id));
        lines.push(`${theme.id} (${theme.definition}): ${coded.length}/${unique.length}; records ${coded.map(r => r.id).join(", ") || "none"}.`);
        for (const segment of new Set(unique.map(r => r.segment || "unspecified"))) { const base = unique.filter(r => (r.segment || "unspecified") === segment); lines.push(`  ${segment}: ${base.filter(r => list(r.codes).includes(theme.id)).length}/${base.length}`); }
        for (const row of coded.slice(0, 3)) lines.push(`  ${row.id}: “${row.text}”`);
      }
      if (!project.records.themes.length || !project.records.feedback.length) add("empty", "attention", "Feedback", "Add a codebook and authorized feedback records.");
      break;
    }
    case "knowledge": {
      const matches = retrieve(project);
      lines.push("Exact passage retrieval only; lexical relevance is not semantic support or a synthesized answer.");
      if (!matches.length) lines.push("ABSTAIN: No approved, permitted matching passage found. Try a more specific question or add evidence.");
      for (const { source: s, matched } of matches) lines.push(`[${s.id}] ${s.title} (${s.date || "date unknown"}): “${s.text}” — ${s.locator}; matched terms: ${matched.join(", ")}`);
      for (const s of project.records.sources.filter(s => s.authority !== "approved")) lines.push(`Excluded ${s.id}: ${s.authority}.`);
      add("semantic", "attention", "Question", "A person must decide whether retrieved passages answer the question and whether versions conflict."); break;
    }
    case "process": {
      const stages = project.records.stages;
      lines.push("Simple independent-stage capacity estimates, not network throughput or a simulation. Shared resources and rework invalidate a simple bottleneck conclusion.");
      for (const row of stages) {
        const minutes = Number(row.minutes), capacity = Number(row.capacity);
        if (!row.minutes || minutes <= 0 || !row.capacity || capacity <= 0 || !Number.isInteger(capacity)) add(`${row.id}-capacity`, "blocker", row.id, "Positive active time and positive integer parallel capacity are required.");
        else lines.push(`${row.id}: ${row.name}; resource ${row.resource || "unknown"}; ${minutes} min/unit × ${capacity} parallel → ${(60 * capacity / minutes).toFixed(2)} units/hour [${row.basis}]. Next/rework: ${row.next || "unspecified"}.`);
        if (row.basis !== "assumed") evidence(row, row.id, false);
        else add(`${row.id}-assumption`, "attention", row.id, "Assumed timing: collect observations and test sensitivity before a recommendation.");
        for (const id of list(row.next)) if (!stages.some(s => s.id === id)) add(`${row.id}-edge-${id}`, "blocker", row.id, `Unknown next stage ${id}.`);
        if (row.resource && stages.filter(s => s.resource === row.resource).length > 1) add(`${row.id}-shared`, "attention", row.id, "Resource is shared across stages; independent-stage capacity is not end-to-end throughput.");
      }
      if (!stages.length) add("empty", "attention", "Process", "No stages mapped.");
      lines.push("Measurement plan: confirm every stage, resource and rework edge with a process owner; collect timestamped arrivals, active work, waiting and completions before proposing an intervention."); break;
    }
    case "reporting": reporting(); break;
    case "discovery": discovery(); break;
    case "proposal": {
      for (const row of project.records.proposal) {
        const requirement = project.records.requirements.find(r => r.id === row.requirement);
        const capability = project.records.capabilities.find(c => c.id === row.capability);
        if (!requirement || requirement.state !== "confirmed" || !requirement.confirmation || !requirement.authority) add(`${row.id}-scope`, "blocker", row.id, "Proposal needs an attributable confirmed requirement.");
        if (!capability || !capability.statement || !capability.evidence || !capability.approver || !capability.expires || capability.expires < asOf) add(`${row.id}-capability`, "blocker", row.id, "Capability is missing, unsupported, unapproved or due for recheck.");
        if (![row.deliverable, row.acceptance, row.capacity].every(s => s.trim())) add(`${row.id}-deliverable`, "blocker", row.id, "Add deliverable, acceptance test and capacity evidence.");
        lines.push(`${row.id}: ${row.deliverable}; requirement ${row.requirement}; capability ${capability?.statement || "UNSUPPORTED"}; acceptance ${row.acceptance}; staffing ${row.capacity}.`);
      }
      for (const row of project.records.requirements.filter(r => r.state === "confirmed")) if (!project.records.proposal.some(p => p.requirement === row.id)) add(`${row.id}-missing`, "attention", row.id, "Confirmed requirement is not included in a proposal item. Explicitly disposition it.");
      if (!project.records.proposal.length) add("empty", "attention", "Proposal", "No scoped proposal items.");
      lines.push("Commercial terms, dates and commitments: NOT GENERATED. Authorized officer review required. This draft is not an agreement."); break;
    }
    case "review": {
      claims(); reporting(); discovery();
      for (const row of project.records.requirements.filter(r => r.state === "confirmed")) if (!row.coverage.trim()) add(`${row.id}-coverage`, "blocker", row.id, "Confirmed requirement has no deliverable evidence. A text match is not proof of completion.");
      for (const token of project.draft.matchAll(/\[\[metric:([^\]]+)\]\]/g)) if (!project.records.metrics.some(m => m.id === token[1])) add(`unknown-${token[1]}`, "blocker", "Draft", `Unknown metric reference ${token[1]}.`);
      const withoutTokens = project.draft.replace(/\[\[(?:metric|claim):[^\]]+\]\]/g, "");
      if (/\d/.test(withoutTokens)) add("free-numbers", "attention", "Draft", "Unbound numbers present. Bind quantitative values with [[metric:ID]] or inspect dates and other non-metric numerals manually.");
      if (/\b(doubled|tripled|driven by|caused|because|guarantee|no other club|best in the country)\b/i.test(project.draft)) add("causal", "attention", "Draft", "Causal, quantitative or superiority wording needs explicit evidence; this heuristic is not exhaustive.");
      if (!project.draft.trim()) add("empty-draft", "attention", "Draft", "No report text supplied; only structured records were inspected.");
      lines.push("Report text:", renderDraft(project)); break;
    }
    case "handoff": {
      for (const row of project.records.handoff) {
        for (const key of ["task", "steps", "owner", "cost", "shutdown"]) if (!row[key].trim()) add(`${row.id}-${key}`, "blocker", row.id, `Missing ${key}; unknown ongoing dependencies cannot be silently accepted.`);
        if (row.outcome !== "passed" || !row.operator.trim() || !row.evidence.trim()) add(`${row.id}-exercise`, "blocker", row.id, "A fresh operator must pass the task and record observed evidence.");
        lines.push(`${row.id}: ${row.task}\nSteps: ${row.steps}\nOwner: ${row.owner}; cost/renewal: ${row.cost}\nRestore/shutdown: ${row.shutdown}\nExercise: ${row.outcome}; operator ${row.operator}; evidence ${row.evidence}`);
      }
      if (!project.records.handoff.length) add("empty", "blocker", "Handoff", "Define operator tasks before claiming a successful handoff."); break;
    }
    default: { const exhaustive: never = module; return exhaustive; }
  }
  const extra = insights(project, module, asOf, new Map(project.records.metrics.map(m => [m.id, metricValue(m, project.records.observations)])));
  lines.push(...extra.lines); findings.push(...extra.findings);
  const scanned = JSON.stringify({ records: project.records, draft: project.draft });
  if (/(?:sk-[A-Za-z0-9_-]{16,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|(?:password|api[_ -]?key)\s*[:=]\s*\S{6,})/i.test(scanned)) add("secret", "blocker", "Project", "Possible embedded secret detected. Remove it and rotate any real exposed credential. Pattern scanning is not exhaustive.");
  if (/ignore (?:all |previous |prior )?instructions|exfiltrate|reveal (?:the )?system prompt/i.test(scanned)) add("untrusted", "attention", "Imported text", "Instruction-like content found. Treat it as source data, never as authority.");
  return { module, findings, lines, status: findings.some(f => f.severity === "blocker") ? "checks found blockers" : "needs review", coverage: `${modules[module].scale}. Manual form entries and pasted text only; no PDF, chart, image or original-file extraction inspected. No findings is not approval.` };
}
export function renderDraft(project: Project): string {
  return project.draft.replace(/\[\[metric:([^\]]+)\]\]/g, (_, id: string) => {
    const metric = project.records.metrics.find(m => m.id === id); const value = metric ? metricValue(metric, project.records.observations) : null;
    return metric && value !== null ? `${value} ${metric.unit} [${id}; ${metric.period}]` : `[UNAVAILABLE METRIC ${id}]`;
  }).replace(/\[\[claim:([^\]]+)\]\]/g, (_, id: string) => {
    const claim = project.records.claims.find(c => c.id === id);
    const source = claim && project.records.sources.find(s => s.id === claim.source);
    return claim && claim.support === "supported" && source?.authority === "approved" && source.permission.trim() && claim.quote.trim() && source.text.includes(claim.quote) ? `${claim.value} [${id}; ${source.id}; ${source.locator}]` : `[UNAVAILABLE CLAIM ${id}]`;
  });
}
export function exportReport(project: Project, result: Analysis, asOf: string): string {
  return [`# ${project.title} — ${modules[result.module].title}`, `Public/synthetic working draft · revision ${project.revision} · as of ${asOf}`, "Not client approval or a performance claim.", `## Coverage\n${result.coverage}`, `## Results\n${result.lines.join("\n\n")}`, `## Review dispositions (self-recorded; do not suppress automated blockers)\n${project.records.reviewLog.map(r => `${r.finding}: ${r.state}; snapshot ${r.snapshot}; reviewer ${r.reviewer}; ${r.evidence}`).join("\n")}`, `## Findings\n${result.findings.map(f => `- ${f.severity.toUpperCase()} ${f.id} (${f.location}): ${f.message}`).join("\n") || "No automated findings. Human review is still required."}`].join("\n\n");
}
export function evaluationSummary(project: Project) {
  const cases = project.records.evaluations.filter(r => r.actual !== "not run");
  const tp = cases.filter(r => r.expected === "yes" && r.actual === "yes").length;
  const fp = cases.filter(r => r.expected === "no" && r.actual === "yes").length;
  const fn = cases.filter(r => r.expected === "yes" && r.actual === "no").length;
  const interval = (hits: number, total: number) => {
    if (!total) return "not measurable";
    const z = 1.96, p = hits / total, d = 1 + z * z / total;
    const center = (p + z * z / (2 * total)) / d;
    const half = z * Math.sqrt(p * (1 - p) / total + z * z / (4 * total * total)) / d;
    return `${hits}/${total}; 95% Wilson interval ${(100 * Math.max(0, center - half)).toFixed(1)}–${(100 * Math.min(1, center + half)).toFixed(1)}%`;
  };
  const groups = [...new Set(cases.map(r => `${r.tool} / ${r.class}`))].map(key => {
    const group = cases.filter(r => `${r.tool} / ${r.class}` === key);
    const hits = group.filter(r => r.expected === "yes" && r.actual === "yes").length;
    const misses = group.filter(r => r.expected === "yes" && r.actual === "no").length;
    const falseAlerts = group.filter(r => r.expected === "no" && r.actual === "yes").length;
    return `${key}: recall ${interval(hits, hits + misses)}; precision ${interval(hits, hits + falseAlerts)}.`;
  });
  const timed = cases.filter(r => [r.manual, r.generic, r.workbench, r.allocatedBuild, r.upkeep].every(v => v !== "" && Number(v) >= 0) && (r.specialist === "" || Number(r.specialist) >= 0));
  const baselineMinutes = timed.reduce((sum, r) => sum + Math.min(Number(r.manual), Number(r.generic), ...(r.specialist === "" ? [] : [Number(r.specialist)])), 0);
  const toolMinutes = timed.reduce((sum, r) => sum + Number(r.workbench) + Number(r.allocatedBuild) + Number(r.upkeep), 0);
  const effort = timed.length ? `${timed.length} complete timing observations: strongest entered baseline ${baselineMinutes} min; workbench including allocated build/upkeep ${toolMinutes} min; difference ${baselineMinutes - toolMinutes} min. Not a generalized saving or pass.` : "No complete nonnegative timing observations; include allocated build and upkeep.";
  return { effort, groups, recorded: cases.length, notRun: project.records.evaluations.length - cases.length, recall: interval(tp, tp + fn), precision: interval(tp, tp + fp), falsePositives: fp, misses: fn, warning: "Self-entered observations, not an independent benchmark. No pass verdict until class counts, lower-bound rules, baseline selection, costs and reviewer capacity are pre-registered." };
}
