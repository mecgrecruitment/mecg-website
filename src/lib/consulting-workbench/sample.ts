import { blankRow, emptyProject, type Project, type Row, type TableKey } from "./schema";
export function sampleProject(): Project {
  const p = emptyProject("synthetic-service-study");
  p.title = "Synthetic service study"; p.question = "What is the approved response target?";
  const row = (table: TableKey, values: Row): Row => ({ ...blankRow(table), ...values });
  p.records.sources = [
    row("sources", { id: "S1", title: "Synthetic service policy", text: "The response target is 24 hours. The intake team has one reviewer.", locator: "Synthetic case, policy paragraph 1", date: "2026-11-01", authority: "approved", permission: "Synthetic data authored for this demo" }),
    row("sources", { id: "S2", title: "Synthetic older draft", text: "The response target is 48 hours.", locator: "Synthetic case, superseded draft", date: "2025-01-01", authority: "superseded", permission: "Synthetic demo" }),
    row("sources", { id: "S3", title: "Synthetic operating extract", text: "Period A: 12 completed requests. Period B: 18 completed requests. Intake takes 10 minutes; review takes 20 minutes.", locator: "Synthetic case, table A", date: "2026-11-01", authority: "approved", permission: "Synthetic demo" }),
  ];
  p.records.claims = [row("claims", { id: "C1", topic: "Response target", value: "24 hours", source: "S1", quote: "The response target is 24 hours.", maxAge: "90", support: "supported" }), row("claims", { id: "C2", topic: "Response target", value: "48 hours", source: "S2", quote: "The response target is 48 hours.", maxAge: "90", support: "unreviewed" })];
  p.records.themes = [row("themes", { id: "delay", definition: "Explicit report of slow response or waiting" }), row("themes", { id: "access", definition: "Unable to use or access the service" })];
  p.records.feedback = [row("feedback", { id: "F1", text: "I waited too long for a response.", segment: "new", codes: "delay" }), row("feedback", { id: "F2", text: "I waited too long for a response.", segment: "new", codes: "delay" }), row("feedback", { id: "F3", text: "I cannot access the essential service.", segment: "returning", codes: "access", severity: "severe" })];
  p.records.requirements = [row("requirements", { id: "R1", text: "Document the response target and current service volume.", source: "S1", quote: "The response target is 24 hours.", speaker: "Mock client", authority: "Synthetic exercise sponsor", state: "confirmed", confirmation: "Mock signed scope v1", coverage: "Report section 1 and metric M1" }), row("requirements", { id: "R2", text: "Consider a live dashboard.", source: "S1", quote: "The intake team has one reviewer.", speaker: "Mock participant", state: "awaiting confirmation" })];
  p.records.stages = [row("stages", { id: "intake", name: "Intake", resource: "Analyst", minutes: "10", capacity: "1", basis: "reported", source: "S3", next: "review" }), row("stages", { id: "review", name: "Review", resource: "Reviewer", minutes: "20", capacity: "1", basis: "assumed" })];
  p.records.metrics = [row("metrics", { id: "M1", name: "Completed requests in periods A and B", unit: "requests", period: "A+B", owner: "Mock metric owner", operation: "sum", expected: "31" })];
  p.records.observations = [row("observations", { id: "O1", metric: "M1", value: "12", source: "S3" }), row("observations", { id: "O2", metric: "M1", value: "18", source: "S3" })];
  p.records.capabilities = [row("capabilities", { id: "CAP1", statement: "Prepare a source-linked service assessment.", evidence: "Synthetic capability; not a real MECG credential", approver: "Mock approver", expires: "2099-01-01" })];
  p.records.proposal = [row("proposal", { id: "P1", requirement: "R1", capability: "CAP1", deliverable: "Service assessment and reproducible workbook", acceptance: "Mock owner verifies target and reconciliation", capacity: "Synthetic two-person exercise; not a real staffing commitment" })];
  p.records.handoff = [row("handoff", { id: "H1", task: "Recompute the reporting pack", steps: "Import the synthetic project. Open reporting. Reconcile the independent control, then export the report.", owner: "", cost: "No model calls required for deterministic checks", shutdown: "Export project if needed; clear saved local draft and delete downloads.", outcome: "not tested" })];
  p.draft = "Completed volume: [[metric:M1]]. This increase was caused by the new workflow. This is a seeded unsupported causal statement.";
  return p;
}
