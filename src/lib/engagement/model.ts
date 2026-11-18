// Engagement tracker: delivery state for each client project. The database
// functions in 20261118030000_engagement_tracker.sql are the authority; these
// checks mirror them so a bad form fails before a round trip, and parse the
// response so a malformed read shows the unavailable state instead of guesses.

export const deliveryStatuses = ["SCOPING", "ACTIVE", "FINAL", "CLOSED"] as const;
export type DeliveryStatus = typeof deliveryStatuses[number];
export const statusLabels: Record<DeliveryStatus, string> = { SCOPING: "Scoping", ACTIVE: "Active", FINAL: "Final", CLOSED: "Closed" };

export const healthFlags = ["ON_TRACK", "AT_RISK", "OFF_TRACK"] as const;
export type HealthFlag = typeof healthFlags[number];
export const healthLabels: Record<HealthFlag, string> = { ON_TRACK: "On track", AT_RISK: "At risk", OFF_TRACK: "Off track" };

export const riskKinds = ["RISK", "BLOCKER"] as const;
export const riskStatuses = ["OPEN", "RESOLVED"] as const;
export type Milestone = { id: string; title: string; due: string; done: string };
export type Risk = { id: string; kind: typeof riskKinds[number]; text: string; status: typeof riskStatuses[number] };

export type DeliveryInput = {
  status: DeliveryStatus;
  milestones: Milestone[];
  risks: Risk[];
  lastContactOn: string;
  lastContactNote: string;
};

export type ProjectDelivery = DeliveryInput & {
  projectId: string;
  title: string;
  clientLabel: string;
  semester: string;
  leadId: string | null;
  leadName: string | null;
  leadStaffed: boolean;
  health: HealthFlag | null;
  healthNote: string;
  healthSetAt: string | null;
  healthSetByName: string | null;
  revision: number;
  updatedAt: string | null;
  isLead: boolean;
  staff: { id: string; name: string }[];
};

export type Tracker = { canManage: boolean; projects: ProjectDelivery[] };

export const LIST_LIMIT = 30;
export const NOTE_LIMIT = 1000;
const HEALTH_FRESH_MS = 7 * 24 * 60 * 60 * 1000;
const itemId = /^[A-Za-z0-9-]{1,64}$/;

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function onlyKeys(value: Record<string, unknown>, keys: readonly string[]) {
  return Object.keys(value).every((key) => keys.includes(key));
}
function includes<T extends string>(list: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (list as readonly string[]).includes(value);
}

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function parseMilestone(value: unknown): Milestone | null {
  if (!isObject(value) || !onlyKeys(value, ["id", "title", "due", "done"])) return null;
  const { id, title, due, done } = value;
  if (typeof id !== "string" || !itemId.test(id) || typeof title !== "string" || typeof due !== "string" || typeof done !== "string") return null;
  const text = title.trim();
  if (!text || text.length > 200 || !isIsoDate(due) || (done !== "" && !isIsoDate(done))) return null;
  return { id, title: text, due, done };
}

function parseRisk(value: unknown): Risk | null {
  if (!isObject(value) || !onlyKeys(value, ["id", "kind", "text", "status"])) return null;
  const { id, kind, text, status } = value;
  if (typeof id !== "string" || !itemId.test(id) || !includes(riskKinds, kind) || !includes(riskStatuses, status) || typeof text !== "string") return null;
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > NOTE_LIMIT) return null;
  return { id, kind, text: trimmed, status };
}

function parseList<T>(value: unknown, parse: (item: unknown) => T | null): T[] | null {
  if (!Array.isArray(value) || value.length > LIST_LIMIT) return null;
  const items = value.map(parse);
  return items.every((item): item is T => item !== null) ? items : null;
}

export function parseDeliveryInput(input: unknown): Parsed<DeliveryInput> {
  if (!isObject(input) || !onlyKeys(input, ["status", "milestones", "risks", "lastContactOn", "lastContactNote"])) {
    return { ok: false, error: "Invalid delivery form." };
  }
  if (!includes(deliveryStatuses, input.status)) return { ok: false, error: "Choose a delivery status." };
  const milestones = parseList(input.milestones, parseMilestone);
  if (!milestones) return { ok: false, error: `Give each milestone a title and a due date (up to ${LIST_LIMIT}).` };
  const risks = parseList(input.risks, parseRisk);
  if (!risks) return { ok: false, error: `Describe each risk or blocker (up to ${LIST_LIMIT}).` };
  const { lastContactOn, lastContactNote } = input;
  if (typeof lastContactOn !== "string" || (lastContactOn !== "" && !isIsoDate(lastContactOn))) return { ok: false, error: "Check the last client contact date." };
  if (typeof lastContactNote !== "string" || lastContactNote.trim().length > NOTE_LIMIT) return { ok: false, error: "Shorten the client contact note." };
  return { ok: true, value: { status: input.status, milestones, risks, lastContactOn, lastContactNote: lastContactNote.trim() } };
}

export function parseHealthInput(input: unknown): Parsed<{ health: HealthFlag; note: string }> {
  if (!isObject(input) || !onlyKeys(input, ["health", "note"]) || !includes(healthFlags, input.health) || typeof input.note !== "string") {
    return { ok: false, error: "Choose a health flag." };
  }
  const note = input.note.trim();
  if (note.length > NOTE_LIMIT) return { ok: false, error: "Shorten the health note." };
  if (input.health !== "ON_TRACK" && !note) return { ok: false, error: "Say what puts the project at risk." };
  return { ok: true, value: { health: input.health, note } };
}

export function healthIsStale(healthSetAt: string | null, now: Date): boolean {
  if (!healthSetAt) return true;
  const setAt = Date.parse(healthSetAt);
  return !Number.isFinite(setAt) || now.getTime() - setAt > HEALTH_FRESH_MS;
}

export function overdueMilestones(milestones: readonly Milestone[], today: string): Milestone[] {
  return milestones.filter((milestone) => !milestone.done && milestone.due < today);
}

export function openBlockers(risks: readonly Risk[]): Risk[] {
  return risks.filter((risk) => risk.kind === "BLOCKER" && risk.status === "OPEN");
}

function text(value: unknown): string {
  if (typeof value !== "string") throw new Error("Invalid delivery response");
  return value;
}
function nullableText(value: unknown): string | null {
  return value === null ? null : text(value);
}

function parseProject(value: unknown): ProjectDelivery {
  if (!isObject(value)) throw new Error("Invalid delivery response");
  if (!includes(deliveryStatuses, value.status)) throw new Error("Invalid delivery status");
  if (value.health !== null && !includes(healthFlags, value.health)) throw new Error("Invalid health flag");
  const milestones = parseList(value.milestones, parseMilestone);
  const risks = parseList(value.risks, parseRisk);
  if (!milestones || !risks) throw new Error("Invalid delivery lists");
  if (typeof value.revision !== "number" || !Number.isSafeInteger(value.revision) || value.revision < 0) throw new Error("Invalid revision");
  if (typeof value.leadStaffed !== "boolean" || typeof value.isLead !== "boolean" || !Array.isArray(value.staff)) throw new Error("Invalid delivery response");
  return {
    projectId: text(value.projectId),
    title: text(value.title),
    clientLabel: text(value.clientLabel),
    semester: text(value.semester),
    status: value.status,
    leadId: nullableText(value.leadId),
    leadName: nullableText(value.leadName),
    leadStaffed: value.leadStaffed,
    health: value.health,
    healthNote: text(value.healthNote),
    healthSetAt: nullableText(value.healthSetAt),
    healthSetByName: nullableText(value.healthSetByName),
    lastContactOn: text(value.lastContactOn),
    lastContactNote: text(value.lastContactNote),
    milestones,
    risks,
    revision: value.revision,
    updatedAt: nullableText(value.updatedAt),
    isLead: value.isLead,
    staff: value.staff.map((member) => {
      if (!isObject(member)) throw new Error("Invalid staff");
      return { id: text(member.id), name: text(member.name) };
    }),
  };
}

export function parseTracker(value: unknown): Tracker {
  if (!isObject(value) || typeof value.canManage !== "boolean" || !Array.isArray(value.projects)) throw new Error("Invalid tracker response");
  return { canManage: value.canManage, projects: value.projects.map(parseProject) };
}

// Milestone dates are club-local calendar days.
export function detroitToday(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Detroit", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
