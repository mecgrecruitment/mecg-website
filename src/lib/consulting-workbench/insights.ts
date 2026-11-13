import type { Finding } from "./engine";
import type { Module, Project } from "./schema";
export const splitIds = (text: string): string[] => [...new Set(text.split(",").map(s => s.trim()).filter(Boolean))];
const normalized = (text: string) => text.trim().toLowerCase().replace(/\s+/g, " ");
export function insights(project: Project, workflow: Module, asOf: string, values: ReadonlyMap<string, number | null>) {
  const lines: string[] = [], findings: Finding[] = [];
  const issue = (id: string, location: string, message: string, severity: Finding["severity"] = "attention") => findings.push({ id: `${workflow}-${id}`, location, message, severity });
  switch (workflow) {
    case "research": {
      const byEntity = new Map<string, string[]>();
      for (const claim of project.records.claims) { const entity = claim.entity?.trim() || "Unspecified entity"; byEntity.set(entity, [...(byEntity.get(entity) ?? []), `${claim.topic}: ${claim.value} [${claim.id}; ${claim.source}]`]); }
      lines.push("COMPARISON BY ENTITY", ...[...byEntity].map(([entity, claims]) => `${entity}\n${claims.join("\n")}`));
      for (const source of project.records.sources) if (!project.records.claims.some(c => c.source === source.id)) lines.push(`Evidence gap: ${source.id} was supplied but no comparison claim cites it.`);
      break;
    }
    case "feedback": {
      const records = project.records.feedback, unique = records.filter((r, i) => r.text.trim() && r.language === "English" && records.findIndex(other => other.segment === r.segment && other.text.trim() === r.text.trim()) === i);
      const coded = unique.filter(r => splitIds(r.codes).some(code => project.records.themes.some(t => t.id === code)));
      lines.push(`CODING COVERAGE: ${coded.length}/${unique.length} eligible deduplicated records have a recognized theme. Frequency is not severity or population prevalence.`);
      for (const theme of project.records.themes) if (theme.keywords?.trim()) {
        const keywords = splitIds(theme.keywords).map(normalized);
        const candidates = unique.filter(r => !splitIds(r.codes).includes(theme.id) && keywords.some(k => normalized(r.text).includes(k)));
        if (candidates.length) lines.push(`UNREVIEWED coding candidates for ${theme.id}: ${candidates.map(r => r.id).join(", ")}. Keyword matches only; inspect the original record before coding.`);
      }
      const themeIds = new Set(project.records.themes.map(t => t.id));
      const pairs = new Map<string, { a: string; b: string; count: number }>();
      for (const row of unique) {
        const codes = splitIds(row.codes).filter(id => themeIds.has(id)).sort();
        for (let i = 0; i < codes.length; i++) for (let j = i + 1; j < codes.length; j++) {
          const a = codes[i], b = codes[j], key = JSON.stringify([a, b]);
          const pair = pairs.get(key); if (pair) pair.count++; else pairs.set(key, { a, b, count: 1 });
        }
      }
      for (const pair of [...pairs.values()].sort((a, b) => b.count - a.count || a.a.localeCompare(b.a)).slice(0, 10)) lines.push(`Theme overlap ${pair.a} + ${pair.b}: ${pair.count}/${unique.length} records. Not a causal relationship.`);
      if (pairs.size > 10) lines.push(`Showing the ten most frequent of ${pairs.size} observed theme pairs; frequency is not priority.`);
      break;
    }
    case "knowledge": {
      for (const source of project.records.sources.filter(s => s.authority === "approved")) {
        const alternatives = project.records.sources.filter(s => s.authority === "approved" && s.id !== source.id && normalized(s.title) === normalized(source.title) && normalized(s.text) !== normalized(source.text));
        if (alternatives.length) issue(`${source.id}-versions`, source.id, `Approved passages share this title but differ (${alternatives.map(s => s.id).join(", ")}). Resolve the governing version before answering.`);
      }
      lines.push("RETRIEVAL METHOD: length-normalized term-frequency / inverse-document-frequency ranking with required quoted phrases. Matching is lexical, not a semantic answer or confidence score."); break;
    }
    case "process": {
      const stages = project.records.stages, ids = new Set(stages.map(s => s.id)), visiting = new Set<string>(), visited = new Set<string>();
      const edges = new Map(stages.map(s => [s.id, splitIds(s.next).filter(id => ids.has(id))]));
      const cycle = new Set<string>();
      const visit = (id: string) => { if (visiting.has(id)) { cycle.add(id); return; } if (visited.has(id)) return; visiting.add(id); for (const next of edges.get(id) ?? []) visit(next); visiting.delete(id); visited.add(id); };
      for (const stage of stages) visit(stage.id);
      if (cycle.size) issue("rework-cycle", "Process map", `Rework/cycle found through ${[...cycle].join(", ")}. Acyclic throughput assumptions are invalid; measure repeat visits.`);
      const incoming = new Set([...edges.values()].flat());
      const starts = stages.filter(s => !incoming.has(s.id)), ends = stages.filter(s => !(edges.get(s.id)?.length));
      lines.push(`MAP CHECK: ${stages.length} stages, ${[...edges.values()].reduce((n, e) => n + e.length, 0)} valid directed edges; starts ${starts.map(s => s.id).join(", ") || "none"}; exits ${ends.map(s => s.id).join(", ") || "none"}.`);
      if (stages.length > 1 && (starts.length !== 1 || ends.length !== 1)) issue("map-boundary", "Process map", "Map has multiple or missing entry/exit points. Confirm scope, branching and disconnected stages with the process owner.");
      for (const stage of stages) {
        const time = Number(stage.minutes), capacity = Number(stage.capacity);
        if (time > 0 && capacity > 0 && Number.isInteger(capacity)) lines.push(`SENSITIVITY ${stage.id}: at half / recorded / double active time, standalone capacity is ${(120 * capacity / time).toFixed(2)} / ${(60 * capacity / time).toFixed(2)} / ${(30 * capacity / time).toFixed(2)} units/hour. Assumption exercise only.`);
      }
      break;
    }
    case "reporting": {
      for (const metric of project.records.metrics) {
        const current = values.get(metric.id); if (current === undefined || current === null) continue;
        const inputs = project.records.observations.filter(r => r.metric === metric.id);
        lines.push(`LINEAGE ${metric.id}: ${inputs.map(r => `${r.id} → ${r.source}`).join("; ")}. Aggregation: ${metric.operation}; ${inputs.length} input rows.`);
        if (metric.expected !== "") lines.push(`RECONCILIATION ${metric.id}: calculated ${current}, independent control ${metric.expected}, difference ${current - Number(metric.expected)} ${metric.unit}.`);
        if (metric.prior?.trim()) {
          const priorSource = project.records.sources.find(s => s.id === metric.priorSource && s.authority === "approved" && s.permission.trim());
          if (!metric.priorPeriod?.trim() || !priorSource) { issue(`${metric.id}-prior-source`, metric.id, "Period comparison needs a named prior period and an approved, permitted prior-period source.", "blocker"); continue; }
          const prior = Number(metric.prior), delta = current - prior;
          lines.push(`PERIOD COMPARISON ${metric.id}: ${metric.priorPeriod} ${prior} → ${metric.period} ${current} ${metric.unit}; change ${delta}; ${prior === 0 ? "relative change undefined from zero baseline" : `${(100 * delta / Math.abs(prior)).toFixed(2)}% relative to magnitude of prior baseline`}. This is an observation, not an explanation.`);
        }
      }
      break;
    }
    case "proposal": {
      lines.push("DRAFT PROJECT SCOPE", `Problem / decision: ${project.question || "Confirm the client decision before release."}`);
      for (const item of project.records.proposal) lines.push(`Deliverable: ${item.deliverable || "Unspecified"}\nRequirement: ${item.requirement}\nAcceptance: ${item.acceptance || "Unspecified"}\nStaffing/review basis: ${item.capacity || "Unconfirmed"}`);
      const unresolved = project.records.requirements.filter(r => r.state === "proposed" || r.state === "awaiting confirmation");
      lines.push(`Not agreed / discovery questions: ${unresolved.map(r => `${r.id}: ${r.text}`).join("; ") || "None recorded — verify completeness."}`, "Exclusions: unapproved commercial terms, unsupported credentials and requirements without an explicit disposition. No commitment is created by this draft.");
      for (const item of project.records.proposal) {
        const r = project.records.requirements.find(r => r.id === item.requirement);
        if (r && (!r.speaker.trim() || !r.source.trim() || !r.quote.trim())) issue(`${item.id}-attribution`, item.id, "Scope reference lacks an attributable source passage/speaker.", "blocker");
      }
      break;
    }
    case "discovery": {
      const counts = new Map<string, number>(); for (const r of project.records.requirements) counts.set(r.state, (counts.get(r.state) ?? 0) + 1);
      lines.push(`SCOPE REGISTER: ${[...counts].map(([state, n]) => `${state}: ${n}`).join("; ") || "empty"}.`);
      for (const r of project.records.requirements) {
        if (r.state === "proposed" || r.state === "awaiting confirmation") lines.push(`FOLLOW-UP ${r.id}: Does the authorized client contact accept “${r.text}”? Confirm the acceptance test and record an attributable reply/signature; do not send automatically.`);
        const conflicting = project.records.requirements.find(other => other.id !== r.id && normalized(other.text) === normalized(r.text) && ["confirmed", "rejected"].includes(other.state) && ["confirmed", "rejected"].includes(r.state) && other.state !== r.state);
        if (conflicting) issue(`${r.id}-state-conflict`, r.id, `Same requirement is both confirmed and rejected (${conflicting.id}); preserve history and resolve the current scope.`, "blocker");
      }
      break;
    }
    case "review": {
      for (const match of project.draft.matchAll(/\[\[claim:([^\]]+)\]\]/g)) {
        const c = project.records.claims.find(c => c.id === match[1]); const source = c && project.records.sources.find(s => s.id === c.source);
        if (!c || c.support !== "supported" || !source || source.authority !== "approved" || !source.permission || !c.quote.trim() || !source.text.includes(c.quote)) issue(`claim-reference-${match[1]}`, "Report text", `Claim ${match[1]} is missing, unreviewed or unsupported; it cannot be rendered as verified text.`, "blocker");
      }
      if (/\b(?:TODO|TBD|FIXME|lorem ipsum)\b|\[insert\b/i.test(project.draft)) issue("unfinished", "Report text", "Unfinished placeholder text remains in the deliverable.", "blocker");
      for (const row of project.records.reviewLog.filter(r => r.state !== "open")) if (!row.reviewer.trim() || !row.evidence.trim() || !/^[a-f0-9]{64}$/i.test(row.snapshot)) issue(`${row.id}-disposition`, row.id, "A disposition needs reviewer, evidence and a valid checked-snapshot hash. It never suppresses automated blockers.");
      lines.push(`REVIEW COVERAGE: ${project.records.claims.length} claims, ${project.records.metrics.length} metrics and ${project.records.requirements.length} scope items supplied. Untagged prose requires independent inspection.`); break;
    }
    case "handoff": {
      const tasks = project.records.handoff;
      lines.push(`HANDOFF READINESS: ${tasks.filter(t => t.outcome === "passed" && t.operator.trim() && t.evidence.trim() && t.owner.trim()).length}/${tasks.length} tasks have self-recorded passing operator evidence and a recipient. This is not independent certification.`);
      for (const task of tasks) {
        if (task.outcome === "passed" && task.builder?.trim() && normalized(task.builder) === normalized(task.operator)) issue(`${task.id}-fresh-operator`, task.id, "The recorded operator is the original builder. Repeat with a fresh operator.", "blocker");
        if (!task.builder?.trim()) issue(`${task.id}-builder`, task.id, "Record the original builder so operator independence can be checked.");
        if (task.supportEnd && task.supportEnd < asOf) issue(`${task.id}-support-end`, task.id, "Recorded support end date has passed; reconfirm the operating arrangement.");
        if (!task.supportEnd) lines.push(`OPEN HANDOFF QUESTION ${task.id}: Agree the support end date and recipient responsibilities. Never assume indefinite support.`);
        if (task.outcome === "failed") lines.push(`RETEST REQUIRED ${task.id}: fix the runbook/dependency problem, then record a new fresh-operator exercise. Preserve the failed evidence.`);
      }
      break;
    }
    default: { const exhaustive: never = workflow; return exhaustive; }
  }
  return { lines, findings };
}
