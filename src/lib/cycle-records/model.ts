// Cycle records export, archive and retention dry run. The database functions
// in 20261118170000_cycle_records_export.sql are the authority; these parse
// their responses so a malformed read shows the unavailable state, and build
// the CSV downloads from the JSON export.

export const toolKinds = ["pipeline", "evidence", "lab"] as const;
export type ToolKind = typeof toolKinds[number];
export const toolLabels: Record<ToolKind, string> = { pipeline: "Pipeline", evidence: "Evidence library", lab: "AI lab" };

export const retentionCategories = ["member_tool_records", "audit_events"] as const;
export type RetentionCategory = typeof retentionCategories[number];
export const retentionLabels: Record<RetentionCategory, string> = {
  member_tool_records: "Member-tool records in archived cycles",
  audit_events: "Activity log entries",
};
export const retentionClock: Record<RetentionCategory, string> = {
  member_tool_records: "counted from the day the cycle was archived",
  audit_events: "counted from the day the entry was written",
};
export const RETENTION_MAX_MONTHS = 240;

const cycleStatuses = ["DRAFT", "OPEN", "IN_PROCESS", "DECISION_LOCK", "CLOSED", "ARCHIVED"] as const;
export type CycleStatus = typeof cycleStatuses[number];

export type Overview = {
  cycle: { id: string; name: string | null; status: CycleStatus; archivedAt: string | null };
  tools: { kind: ToolKind; records: number; full: boolean }[];
  projects: number;
  lastExportAt: string | null;
  exportedSinceClose: string | null;
  canArchive: boolean;
};

export type ExportRecord = {
  id: string; kind: ToolKind; ownerId: string; ownerName: string | null; revision: number; createdAt: string; updatedAt: string;
  verification: string | null; sharing: string | null; contentWithheld: boolean;
  content: Record<string, unknown> | null; review: Record<string, unknown> | null;
};
export type CycleExport = {
  format: "mecg-cycle-records/1";
  exportedAt: string;
  cycle: { id: string; name: string | null; status: string };
  fullContentTools: ToolKind[];
  memberToolRecords: ExportRecord[];
  reviewerGrants: unknown[];
  projects: Record<string, unknown>[];
  projectMembers: { projectId: string; userId: string; name: string | null; roleLabel: string }[];
};

export type RetentionCategoryReport = {
  category: RetentionCategory; keepMonths: number | null; revision: number; updatedAt: string;
  eligible: number | null;
  byCycle: { cycleId: string; cycleName: string | null; archivedAt: string; records: number }[] | null;
};
export type RetentionReport = { generatedAt: string; categories: RetentionCategoryReport[] };

const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const isCount = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const isText = (value: unknown): value is string => typeof value === "string";
const isTextOrNull = (value: unknown): value is string | null => value === null || typeof value === "string";
const isOneOf = <T extends string>(list: readonly T[], value: unknown): value is T => typeof value === "string" && (list as readonly string[]).includes(value);

export function parseOverview(raw: unknown): Overview | null {
  if (!isObject(raw) || !isObject(raw.cycle) || !Array.isArray(raw.tools)) return null;
  const { cycle } = raw;
  if (!isText(cycle.id) || !isTextOrNull(cycle.name) || !isOneOf(cycleStatuses, cycle.status) || !isTextOrNull(cycle.archivedAt)) return null;
  const tools: Overview["tools"] = [];
  for (const tool of raw.tools) {
    if (!isObject(tool) || !isOneOf(toolKinds, tool.kind) || !isCount(tool.records) || typeof tool.full !== "boolean") return null;
    tools.push({ kind: tool.kind, records: tool.records, full: tool.full });
  }
  if (!isCount(raw.projects) || !isTextOrNull(raw.lastExportAt) || !isTextOrNull(raw.exportedSinceClose)) return null;
  return {
    cycle: { id: cycle.id, name: cycle.name, status: cycle.status, archivedAt: cycle.archivedAt },
    tools, projects: raw.projects, lastExportAt: raw.lastExportAt, exportedSinceClose: raw.exportedSinceClose,
    canArchive: cycle.status === "CLOSED" && raw.exportedSinceClose !== null,
  };
}

export function parseExport(raw: unknown): CycleExport | null {
  if (!isObject(raw) || raw.format !== "mecg-cycle-records/1" || !isText(raw.exportedAt) || !isObject(raw.cycle)) return null;
  if (!isText(raw.cycle.id) || !isTextOrNull(raw.cycle.name) || !isText(raw.cycle.status)) return null;
  if (!Array.isArray(raw.fullContentTools) || !raw.fullContentTools.every((kind) => isOneOf(toolKinds, kind))) return null;
  if (!Array.isArray(raw.memberToolRecords) || !Array.isArray(raw.reviewerGrants) || !Array.isArray(raw.projects) || !Array.isArray(raw.projectMembers)) return null;
  const records: ExportRecord[] = [];
  for (const record of raw.memberToolRecords) {
    if (!isObject(record) || !isText(record.id) || !isOneOf(toolKinds, record.kind) || !isText(record.ownerId) || !isTextOrNull(record.ownerName)) return null;
    if (!isCount(record.revision) || !isText(record.createdAt) || !isText(record.updatedAt) || !isTextOrNull(record.verification) || !isTextOrNull(record.sharing)) return null;
    if (typeof record.contentWithheld !== "boolean") return null;
    // A withheld record must carry no content; a full one must carry an object.
    if (record.contentWithheld ? record.content !== null || record.review !== null : !isObject(record.content) || !isObject(record.review)) return null;
    records.push({
      id: record.id, kind: record.kind, ownerId: record.ownerId, ownerName: record.ownerName, revision: record.revision,
      createdAt: record.createdAt, updatedAt: record.updatedAt, verification: record.verification, sharing: record.sharing,
      contentWithheld: record.contentWithheld, content: record.content as Record<string, unknown> | null, review: record.review as Record<string, unknown> | null,
    });
  }
  if (!raw.projects.every(isObject)) return null;
  const members: CycleExport["projectMembers"] = [];
  for (const member of raw.projectMembers) {
    if (!isObject(member) || !isText(member.projectId) || !isText(member.userId) || !isTextOrNull(member.name) || !isText(member.roleLabel)) return null;
    members.push({ projectId: member.projectId, userId: member.userId, name: member.name, roleLabel: member.roleLabel });
  }
  return {
    format: raw.format, exportedAt: raw.exportedAt, cycle: { id: raw.cycle.id, name: raw.cycle.name, status: raw.cycle.status },
    fullContentTools: raw.fullContentTools as ToolKind[], memberToolRecords: records, reviewerGrants: raw.reviewerGrants,
    projects: raw.projects as Record<string, unknown>[], projectMembers: members,
  };
}

export function parseRetentionReport(raw: unknown): RetentionReport | null {
  if (!isObject(raw) || !isText(raw.generatedAt) || !Array.isArray(raw.categories)) return null;
  const categories: RetentionCategoryReport[] = [];
  for (const entry of raw.categories) {
    if (!isObject(entry) || !isOneOf(retentionCategories, entry.category) || !isCount(entry.revision) || !isText(entry.updatedAt)) return null;
    if (entry.keepMonths !== null && !isCount(entry.keepMonths)) return null;
    if (entry.eligible !== null && !isCount(entry.eligible)) return null;
    let byCycle: RetentionCategoryReport["byCycle"] = null;
    if (entry.byCycle !== null && entry.byCycle !== undefined) {
      if (!Array.isArray(entry.byCycle)) return null;
      byCycle = [];
      for (const row of entry.byCycle) {
        if (!isObject(row) || !isText(row.cycleId) || !isTextOrNull(row.cycleName) || !isText(row.archivedAt) || !isCount(row.records)) return null;
        byCycle.push({ cycleId: row.cycleId, cycleName: row.cycleName, archivedAt: row.archivedAt, records: row.records });
      }
    }
    categories.push({ category: entry.category, keepMonths: entry.keepMonths, revision: entry.revision, updatedAt: entry.updatedAt, eligible: entry.eligible, byCycle });
  }
  return { generatedAt: raw.generatedAt, categories };
}

export type RetentionInput = { category: RetentionCategory; keepMonths: number | null; revision: number };
export function parseRetentionInput(raw: unknown): { ok: true; value: RetentionInput } | { ok: false; error: string } {
  if (!isObject(raw) || Object.keys(raw).some((key) => !["category", "keepMonths", "revision"].includes(key))) return { ok: false, error: "Invalid form." };
  if (!isOneOf(retentionCategories, raw.category)) return { ok: false, error: "Unknown retention category." };
  const { keepMonths, revision } = raw;
  if (keepMonths !== null && (typeof keepMonths !== "number" || !Number.isInteger(keepMonths) || keepMonths < 1 || keepMonths > RETENTION_MAX_MONTHS)) {
    return { ok: false, error: `Keep for 1 to ${RETENTION_MAX_MONTHS} whole months, or leave blank.` };
  }
  if (typeof revision !== "number" || !Number.isSafeInteger(revision) || revision < 1) return { ok: false, error: "Invalid revision." };
  return { ok: true, value: { category: raw.category, keepMonths, revision } };
}

// Spreadsheet apps run a cell that starts with = + - or @; prefix those so an
// export opened in Excel or Sheets never runs a member's text as a formula.
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = typeof value === "boolean" ? (value ? "yes" : "no") : typeof value === "object" ? JSON.stringify(value) : String(value);
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}
const csvBody = (header: string[], rows: unknown[][]) => `${[header.join(","), ...rows.map((row) => row.map(csvCell).join(","))].join("\n")}\n`;

function keysInOrder(objects: (Record<string, unknown> | null)[]): string[] {
  const keys: string[] = [];
  for (const object of objects) for (const key of Object.keys(object ?? {})) if (!keys.includes(key)) keys.push(key);
  return keys;
}

export function recordsCsv(data: CycleExport): string {
  const contentKeys = keysInOrder(data.memberToolRecords.map((record) => record.content));
  const reviewKeys = keysInOrder(data.memberToolRecords.map((record) => record.review));
  const header = ["id", "tool", "owner", "owner_id", "revision", "created_at", "updated_at", "verification", "sharing", "content_withheld",
    ...contentKeys.map((key) => `content_${key}`), ...reviewKeys.map((key) => `review_${key}`)];
  const rows = data.memberToolRecords.map((record) => [
    record.id, record.kind, record.ownerName, record.ownerId, record.revision, record.createdAt, record.updatedAt, record.verification, record.sharing, record.contentWithheld,
    ...contentKeys.map((key) => record.content?.[key]), ...reviewKeys.map((key) => record.review?.[key]),
  ]);
  return csvBody(header, rows);
}

const projectColumns = ["id", "slug", "title", "client_label", "is_public"] as const;
export function projectsCsv(data: CycleExport): string {
  const rows = data.projects.map((project) => [
    ...projectColumns.map((column) => project[column]),
    data.projectMembers.filter((member) => member.projectId === project.id)
      .map((member) => `${member.name ?? member.userId}${member.roleLabel ? ` (${member.roleLabel})` : ""}`).join("; "),
  ]);
  return csvBody([...projectColumns, "team"], rows);
}

export type ExportSection = "all" | "records" | "projects";
export function exportFilename(info: { id: string; exportedAt: string }, section: ExportSection, format: "json" | "csv"): string {
  const slug = info.id.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "cycle";
  const day = /^\d{4}-\d{2}-\d{2}/.exec(info.exportedAt)?.[0] ?? "undated";
  return `mecg-cycle-${slug}-${section}-${day}.${format}`;
}
