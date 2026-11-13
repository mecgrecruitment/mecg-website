/** The editable field catalogue is also the import and AI-response schema authority. */
export type Field = { key: string; label: string; type?: "text" | "long" | "number" | "date"; options?: readonly string[] };
const field = (key: string, label: string, type: Field["type"] = "text"): Field => ({ key, label, type });
const choice = (key: string, label: string, options: readonly string[]): Field => ({ key, label, options });
export const tables = {
  sources: { title: "Source passages", fields: [field("id", "Source ID"), field("title", "Title"), field("text", "Exact passage", "long"), field("locator", "URL, page or row"), field("date", "As-of date", "date"), choice("authority", "Authority", ["approved", "draft", "superseded", "revoked"]), field("permission", "Source-use permission or licence")] },
  claims: { title: "Research claims", fields: [field("id", "Claim ID"), field("topic", "Comparison topic"), field("value", "Claim / comparison value", "long"), field("source", "Source ID"), field("quote", "Exact supporting quote", "long"), field("maxAge", "Maximum age in days", "number"), choice("support", "Human semantic review", ["unreviewed", "supported", "unsupported"])] },
  feedback: { title: "Feedback records", fields: [field("id", "Record ID"), field("text", "Original feedback", "long"), field("segment", "Segment"), field("codes", "Theme IDs, comma separated"), choice("severity", "Severity", ["ordinary", "severe"]), choice("language", "Language", ["English", "Other"])] },
  themes: { title: "Theme codebook", fields: [field("id", "Theme ID"), field("definition", "Coding definition", "long")] },
  requirements: { title: "Discovery and scope", fields: [field("id", "Requirement ID"), field("text", "Need / acceptance criterion", "long"), field("source", "Source ID"), field("quote", "Exact note excerpt", "long"), field("speaker", "Attributed speaker"), field("authority", "Authority evidence"), choice("state", "State", ["proposed", "awaiting confirmation", "confirmed", "rejected", "superseded"]), field("confirmation", "Confirmation evidence"), field("coverage", "Deliverable evidence", "long")] },
  stages: { title: "Process stages", fields: [field("id", "Stage ID"), field("name", "Stage"), field("resource", "Resource"), field("minutes", "Active minutes per unit", "number"), field("capacity", "Parallel capacity", "number"), choice("basis", "Evidence basis", ["observed", "reported", "assumed"]), field("source", "Evidence source ID"), field("next", "Next stage IDs / rework", "long")] },
  metrics: { title: "Reporting metrics", fields: [field("id", "Metric ID"), field("name", "Definition and population", "long"), field("unit", "Unit"), field("period", "Period"), field("owner", "Definition owner"), choice("operation", "Calculation", ["sum", "mean", "ratio"]), field("expected", "Independent control total", "number")] },
  observations: { title: "Metric inputs", fields: [field("id", "Input ID"), field("metric", "Metric ID"), field("value", "Value / numerator", "number"), field("denominator", "Ratio denominator", "number"), field("source", "Source ID")] },
  capabilities: { title: "Capability register", fields: [field("id", "Capability ID"), field("statement", "Permitted capability wording", "long"), field("evidence", "Evidence / reference permission", "long"), field("approver", "Approver"), field("expires", "Recheck date", "date")] },
  proposal: { title: "Proposal scope", fields: [field("id", "Proposal item ID"), field("requirement", "Requirement ID"), field("capability", "Capability ID"), field("deliverable", "Proposed deliverable", "long"), field("acceptance", "Acceptance test", "long"), field("capacity", "Staffing / review capacity evidence", "long")] },
  handoff: { title: "Handoff tasks", fields: [field("id", "Task ID"), field("task", "Operator task", "long"), field("steps", "Steps, dependencies and safe credential location", "long"), field("owner", "Accepted recipient / maintainer"), field("cost", "Recurring cost and renewal / none"), field("shutdown", "Restore and shutdown procedure", "long"), field("operator", "Fresh operator"), choice("outcome", "Observed result", ["not tested", "passed", "failed"]), field("evidence", "Exercise evidence", "long")] },
  reviewLog: { title: "Review dispositions", fields: [field("id", "Review entry ID"), field("finding", "Finding ID"), field("snapshot", "Checked snapshot SHA-256"), field("reviewer", "Reviewer"), choice("state", "Disposition", ["open", "fix proposed", "fixed on recheck", "waived with reason"]), field("evidence", "Evidence, reason and recheck snapshot", "long")] },
  evaluations: { title: "Pilot evaluation cases", fields: [field("id", "Case ID"), field("tool", "Tool ID"), field("class", "Defect / task class"), field("reference", "Independent ground truth", "long"), choice("expected", "Expected alert", ["yes", "no"]), choice("actual", "Observed alert", ["not run", "yes", "no"]), field("manual", "Manual minutes", "number"), field("generic", "Generic AI baseline minutes", "number"), field("specialist", "Configured specialist minutes", "number"), field("workbench", "Workbench + review minutes", "number"), field("allocatedBuild", "Allocated build / training minutes", "number"), field("upkeep", "Allocated upkeep minutes", "number"), field("run", "Input/model/prompt revision and evaluator", "long")] },
} satisfies Record<string, { title: string; fields: Field[] }>;
export type TableKey = keyof typeof tables;
export const tableKeys = Object.keys(tables).filter(isTableKey);
export function isTableKey(value: unknown): value is TableKey { return typeof value === "string" && Object.hasOwn(tables, value); }
/** Values are textual form cells, validated using the catalogue at the import boundary. */
export type Row = Record<string, string>;
export type Project = { version: 1; id: string; title: string; dataClass: "public-synthetic"; question: string; draft: string; revision: number; records: Record<TableKey, Row[]> };
export const modules = {
  research: { title: "Research & competitors", description: "Compare bounded claims, inspect their evidence and surface conflicts.", tables: ["sources", "claims"], limit: "One bounded question set; no exhaustive market or live monitoring claim.", scale: "Source passages and decision questions" },
  feedback: { title: "Customer feedback", description: "Code feedback, verify denominators and preserve rare severe issues.", tables: ["themes", "feedback"], limit: "English records; no cross-channel customer identity inference.", scale: "Deduplicated records, themes and segments" },
  knowledge: { title: "Document questions", description: "Find exact passages in an approved corpus; abstain when evidence is missing.", tables: ["sources"], limit: "One public/synthetic corpus; no client permission-security claim.", scale: "Passages and independently answered questions" },
  process: { title: "Process mapping", description: "Map stages and show capacity assumptions before proposing a change.", tables: ["stages", "sources"], limit: "Simple stage calculations; not a simulation or causal diagnosis.", scale: "Stages, resources and explicit rework edges" },
  reporting: { title: "Business reporting", description: "Calculate defined metrics and reconcile them to independent controls.", tables: ["metrics", "observations", "sources"], limit: "One structured dataset; no financial assurance or source-data guarantee.", scale: "Input rows, metrics and reporting periods" },
  proposal: { title: "Proposal preparation", description: "Map scope to supported capabilities and explicit acceptance tests.", tables: ["proposal", "capabilities", "requirements"], limit: "Internal drafts only; no generated prices, dates or commitments.", scale: "Requirements, capability claims and proposal items" },
  discovery: { title: "Discovery & scope", description: "Keep tentative needs separate from attributable client confirmation.", tables: ["requirements", "sources"], limit: "Pasted notes only; no recording, sending or inferred authority.", scale: "Note passages, requirements and confirmation decisions" },
  review: { title: "Deliverable review", description: "Check claims, calculations and scope against an inspectable evidence bundle.", tables: ["claims", "metrics", "observations", "requirements"], limit: "Text and structured cells; visual, legal and semantic review remain human.", scale: "Report words, checked claims, table cells and requirements" },
  handoff: { title: "Project handoff", description: "Prepare a runbook and record a fresh operator completing the agreed tasks.", tables: ["handoff"], limit: "Only exercised tasks count; no indefinite support or automatic credential transfer.", scale: "Operator tasks, dependencies and fresh-operator minutes" },
} satisfies Record<string, { title: string; description: string; tables: TableKey[]; limit: string; scale: string }>;
export type Module = keyof typeof modules;
export function isModule(value: unknown): value is Module { return typeof value === "string" && Object.hasOwn(modules, value); }
export const moduleKeys = Object.keys(modules).filter(isModule);
export function blankRow(key: TableKey): Row { return Object.fromEntries(tables[key].fields.map(f => [f.key, f.options?.[0] ?? ""])); }
export function emptyProject(id: string): Project { return { version: 1, id, title: "Untitled consulting project", question: "", draft: "", dataClass: "public-synthetic", revision: 1, records: { sources: [], claims: [], feedback: [], themes: [], requirements: [], stages: [], metrics: [], observations: [], capabilities: [], proposal: [], handoff: [], reviewLog: [], evaluations: [] } }; }
export function object(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value); }
export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };
export function parseRows(key: TableKey, value: unknown): Parsed<Row[]> {
  if (!Array.isArray(value) || value.length > 300) return { ok: false, error: `${tables[key].title}: maximum 300 rows.` };
  const rows: Row[] = []; const ids = new Set<string>();
  for (const input of value) {
    if (!object(input) || Object.keys(input).some(k => !tables[key].fields.some(f => f.key === k))) return { ok: false, error: `${tables[key].title}: unrecognized fields.` };
    const row: Row = {};
    for (const f of tables[key].fields) {
      const cell = input[f.key];
      if (typeof cell !== "string" || cell.length > 8000) return { ok: false, error: `${tables[key].title}: check ${f.label}.` };
      if (f.options && !f.options.includes(cell)) return { ok: false, error: `Choose a valid ${f.label}.` };
      if (cell && f.type === "number" && (!/^-?(?:\d+\.?\d*|\.\d+)$/.test(cell) || !Number.isFinite(Number(cell)) || Math.abs(Number(cell)) > 1e12)) return { ok: false, error: `${f.label} must be a finite decimal between -1e12 and 1e12.` };
      if (cell && f.type === "date" && (!/^\d{4}-\d{2}-\d{2}$/.test(cell) || !Number.isFinite(Date.parse(cell)) || new Date(cell).toISOString().slice(0, 10) !== cell)) return { ok: false, error: `Check ${f.label}.` };
      row[f.key] = cell;
    }
    if (!row.id.trim() || ids.has(row.id)) return { ok: false, error: `${tables[key].title}: every row needs a unique ID.` };
    ids.add(row.id); rows.push(row);
  }
  return { ok: true, value: rows };
}
export function parseProject(input: unknown): Parsed<Project> {
  if (!object(input) || input.version !== 1 || input.dataClass !== "public-synthetic" || !object(input.records)) return { ok: false, error: "Import a version 1 public/synthetic project. Confidential data is not supported." };
  if (Object.keys(input).some(k => !["version", "id", "title", "question", "draft", "dataClass", "revision", "records"].includes(k)) || Object.keys(input.records).some(k => !isTableKey(k))) return { ok: false, error: "Unrecognized project fields." };
  if (typeof input.id !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(input.id) || typeof input.title !== "string" || input.title.length > 200 || typeof input.question !== "string" || input.question.length > 2000 || typeof input.draft !== "string" || input.draft.length > 30000 || typeof input.revision !== "number" || !Number.isSafeInteger(input.revision) || input.revision < 1) return { ok: false, error: "Check project title, ID, revision, question or report length." };
  const project = emptyProject(input.id);
  for (const key of tableKeys) { const parsed = parseRows(key, input.records[key]); if (!parsed.ok) return parsed; project.records[key] = parsed.value; }
  return { ok: true, value: { ...project, title: input.title, question: input.question, draft: input.draft, revision: input.revision } };
}
export function validateProject(project: Project): Parsed<Project> { return parseProject(project); }
