export const toolKinds = ["pipeline", "evidence", "lab"] as const;
export type ToolKind = typeof toolKinds[number];
type Field = { key: string; label: string; required?: boolean; type?: "url" | "date" | "textarea"; options?: readonly string[]; hint?: string };
export const tools = {
  pipeline: {
    title: "Client & sponsor pipeline", action: "Add opportunity",
    description: "Keep a business problem, relationship and next step together. Client opportunities and sponsorship asks stay separate.",
    fields: [
      { key: "title", label: "Company or organization", required: true },
      { key: "track", label: "Opportunity type", options: ["Client", "Sponsor"], required: true },
      { key: "stage", label: "Stage", options: ["Research", "Qualified", "Conversation", "Proposal", "Agreed", "Dormant", "Closed"], required: true },
      { key: "problem", label: "Business problem or support ask", type: "textarea", required: true },
      { key: "source", label: "Source link", type: "url", required: true },
      { key: "introduction", label: "Contact or warm introduction route", hint: "Record a route, not an assumed introduction or permission to send." },
      { key: "qualification", label: "Qualification or stage evidence", type: "textarea", hint: "Required beyond Research. For Agreed, link the written agreement here." },
      { key: "lastConversation", label: "Last meaningful conversation", type: "date" },
      { key: "nextAction", label: "Next action", required: true },
      { key: "nextDate", label: "Next-action date", type: "date", hint: "Leave blank unless agreed." },
    ] satisfies readonly Field[],
  },
  evidence: {
    title: "Project evidence library", action: "Submit project evidence",
    description: "Capture the problem, deliverable and supported result. Verification and permission to share are reviewed separately.",
    fields: [
      { key: "title", label: "Project title", required: true },
      { key: "problem", label: "Problem and context", type: "textarea", required: true },
      { key: "approach", label: "Approach and your contribution", type: "textarea", required: true },
      { key: "source", label: "Original deliverable link", type: "url", required: true },
      { key: "result", label: "Result or deliverable produced", type: "textarea", required: true, hint: "Distinguish measured results, client reports and estimates. Unknown impact is acceptable." },
      { key: "measurement", label: "Measurement method, baseline and limitations", type: "textarea", required: true },
      { key: "feedback", label: "Client feedback source", type: "url" },
      { key: "permission", label: "Permission source", type: "url", hint: "Optional. Submission does not authorize sharing." },
      { key: "allowedUse", label: "Requested or documented sharing scope", type: "textarea", hint: "Specify audience, channels, names, logos, quotes and restrictions." },
    ] satisfies readonly Field[],
  },
  lab: {
    title: "AI consulting lab", action: "Save sprint submission",
    description: "Build a useful demo, compare it with a manual baseline and explain where it fails. Start with the synthetic case below.",
    fields: [
      { key: "title", label: "Demo title", required: true },
      { key: "problem", label: "User, decision and scope", type: "textarea", required: true },
      { key: "source", label: "Demo or recorded fallback link", type: "url", required: true },
      { key: "setup", label: "Reproduction steps and tool/model version", type: "textarea", required: true },
      { key: "evaluation", label: "Evaluation report link", type: "url", required: true, hint: "Question-by-question baseline, AI output, citation, expected result and observed error." },
      { key: "baseline", label: "Manual baseline and observed comparison", type: "textarea", required: true },
      { key: "effort", label: "Setup, verification effort and cost assumptions", type: "textarea", required: true },
      { key: "limits", label: "Failures, risks and maintenance handoff", type: "textarea", required: true },
      { key: "recommendation", label: "Recommendation", options: ["Adopt", "Revise", "Do not adopt"], required: true },
    ] satisfies readonly Field[],
  },
} satisfies Record<ToolKind, { title: string; action: string; description: string; fields: readonly Field[] }>;

export function isToolKind(value: unknown): value is ToolKind { return toolKinds.some((kind) => kind === value); }
export function fieldsFor(kind: ToolKind): readonly Field[] { return tools[kind].fields; }
export type ToolContent = Readonly<Record<string, string>>;
export type ToolRecord = { id: string; kind: ToolKind; ownerId: string; ownerName: string; revision: number; content: ToolContent; review: Review; updatedAt: string };
export const verificationStates = ["Pending", "Needs changes", "Verified"] as const;
export const sharingStates = ["Restricted", "Cleared for specified use", "Withdrawn"] as const;
export type Review = { verification: typeof verificationStates[number]; sharing: typeof sharingStates[number]; note: string; source: string; scope: string; reviewerId: string | null };
export const pendingReview: Review = { verification: "Pending", sharing: "Restricted", note: "", source: "", scope: "", reviewerId: null };
export function isObject(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value); }
export function safeLink(value: string): boolean {
  // Match the database boundary: HTTPS host, no credentials, ports or whitespace.
  return /^https:\/\/[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?(?:[/?#][^\s]*)?$/.test(value);
}
export function parseContent(kind: ToolKind, input: unknown): { ok: true; value: ToolContent } | { ok: false; error: string } {
  if (!isObject(input)) return { ok: false, error: "Invalid form data." };
  const fields = fieldsFor(kind);
  if (Object.keys(input).some((key) => !fields.some((field) => field.key === key))) return { ok: false, error: "Unknown field." };
  const value: Record<string, string> = {};
  for (const field of fields) {
    const raw = input[field.key] ?? "";
    if (typeof raw !== "string") return { ok: false, error: `${field.label} must be text.` };
    const text = raw.trim();
    if ((field.required && !text) || text.length > (field.type === "textarea" ? 4000 : 1000)) return { ok: false, error: `Check ${field.label.toLowerCase()}.` };
    if (text && field.options && !field.options.includes(text)) return { ok: false, error: `Choose a valid ${field.label.toLowerCase()}.` };
    if (text && field.type === "url" && !safeLink(text)) return { ok: false, error: `${field.label} must be an HTTPS link without credentials.` };
    if (text && field.type === "date" && (!/^\d{4}-\d{2}-\d{2}$/.test(text) || !Number.isFinite(Date.parse(text)) || new Date(text).toISOString().slice(0, 10) !== text)) return { ok: false, error: `Check ${field.label.toLowerCase()}.` };
    value[field.key] = text;
  }
  if (kind === "pipeline" && value.stage !== "Research" && !value.qualification) return { ok: false, error: "Add evidence for this stage." };
  return { ok: true, value };
}
export function parseReview(input: unknown): Review | null {
  if (!isObject(input) || !verificationStates.some((v) => v === input.verification) || !sharingStates.some((v) => v === input.sharing)) return null;
  const { verification, sharing, note, source, scope, reviewerId } = input;
  if (verification !== "Pending" && verification !== "Needs changes" && verification !== "Verified") return null;
  if (sharing !== "Restricted" && sharing !== "Cleared for specified use" && sharing !== "Withdrawn") return null;
  if (typeof note !== "string" || typeof source !== "string" || typeof scope !== "string" || !(reviewerId === null || typeof reviewerId === "string")) return null;
  if (note.length > 4000 || scope.length > 4000 || source.length > 1000 || (source && !safeLink(source))) return null;
  if (verification !== "Pending" && !note.trim()) return null;
  if (sharing === "Cleared for specified use" && (verification !== "Verified" || !safeLink(source) || !scope.trim())) return null;
  return { verification, sharing, note, source, scope, reviewerId };
}
export function parseRecords(input: unknown): ToolRecord[] {
  if (!Array.isArray(input)) throw new Error("Invalid tool records");
  return input.map((row: unknown) => {
    if (!isObject(row) || typeof row.id !== "string" || !isToolKind(row.kind) || typeof row.owner_id !== "string" || typeof row.owner_name !== "string" || !Number.isSafeInteger(row.revision) || typeof row.revision !== "number" || typeof row.updated_at !== "string") throw new Error("Invalid tool record");
    const content = parseContent(row.kind, row.content); const review = parseReview(row.review);
    if (!content.ok || !review) throw new Error("Invalid tool record content");
    return { id: row.id, kind: row.kind, ownerId: row.owner_id, ownerName: row.owner_name, revision: row.revision, content: content.value, review, updatedAt: row.updated_at };
  });
}
