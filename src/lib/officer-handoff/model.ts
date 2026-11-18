// Officer handoff checklists. The database functions in
// 20261118150000_officer_handoff.sql are the authority; these checks mirror
// them so a bad form fails before a round trip, and parse the response so a
// malformed read shows the unavailable state instead of guesses.

export const handoffStatuses = ["OPEN", "COMPLETE", "CANCELLED"] as const;
export type HandoffStatus = typeof handoffStatuses[number];
export const statusLabels: Record<HandoffStatus, string> = { OPEN: "In progress", COMPLETE: "Complete", CANCELLED: "Cancelled" };

export const itemKinds = ["ACCOUNT", "ACCESS", "OPEN_ITEM"] as const;
export type ItemKind = typeof itemKinds[number];
export const kindLabels: Record<ItemKind, string> = { ACCOUNT: "Accounts", ACCESS: "Access to reassign", OPEN_ITEM: "Open items" };

export const ROLE_LIMIT = 80;
export const NOTES_LIMIT = 2000;
export const LABEL_LIMIT = 200;
export const DETAIL_LIMIT = 1000;
export const ITEM_LIMIT = 40;

export type ItemInput = { id: string | null; kind: ItemKind; label: string; detail: string; done: boolean };
export type HandoffInput = {
  roleTitle: string;
  outgoingId: string;
  incomingId: string | null;
  dueOn: string | null;
  status: HandoffStatus;
  notes: string;
  items: ItemInput[];
};
export type Item = ItemInput & { id: string; doneAt: string | null; doneByName: string | null };
export type RoleGrant = { cycleId: string; cycleName: string | null; role: string };
export type ReviewerGrant = { cycleId: string; cycleName: string | null; tool: string };
export type PersonAccess = { roles: RoleGrant[]; reviewerGrants: ReviewerGrant[] };
export type Handoff = Omit<HandoffInput, "items"> & {
  id: string;
  outgoingName: string | null;
  incomingName: string | null;
  items: Item[];
  access: { outgoing: PersonAccess; incoming: PersonAccess | null };
  revision: number;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdByName: string | null;
  updatedByName: string | null;
};
export type Person = { id: string; name: string };
export type HandoffBoard = { handoffs: Handoff[]; people: Person[] };

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const inputKeys = ["roleTitle", "outgoingId", "incomingId", "dueOn", "status", "notes", "items"] as const;
const itemKeys = ["id", "kind", "label", "detail", "done"] as const;

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function hasExactly(value: Record<string, unknown>, keys: readonly string[]) {
  const own = Object.keys(value);
  return own.length === keys.length && own.every((key) => keys.includes(key));
}
function includes<T extends string>(list: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (list as readonly string[]).includes(value);
}
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && uuid.test(value);
}
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < "0001-01-01") return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function parseItem(value: unknown): ItemInput | string {
  const bad = "Check the checklist items.";
  if (!isObject(value) || !hasExactly(value, itemKeys)) return bad;
  if (value.id !== null && !isUuid(value.id)) return bad;
  if (!includes(itemKinds, value.kind)) return bad;
  if (typeof value.label !== "string" || !value.label.trim() || value.label.trim().length > LABEL_LIMIT) return `Give every item a label (up to ${LABEL_LIMIT} characters).`;
  if (typeof value.detail !== "string" || value.detail.trim().length > DETAIL_LIMIT) return `Shorten item details to ${DETAIL_LIMIT} characters.`;
  if (typeof value.done !== "boolean") return bad;
  return { id: value.id, kind: value.kind, label: value.label.trim(), detail: value.detail.trim(), done: value.done };
}

export function parseHandoffInput(input: unknown): Parsed<HandoffInput> {
  if (!isObject(input) || !hasExactly(input, inputKeys)) return { ok: false, error: "Invalid handoff form." };
  if (typeof input.roleTitle !== "string" || !input.roleTitle.trim() || input.roleTitle.trim().length > ROLE_LIMIT) return { ok: false, error: `Name the role being handed over (up to ${ROLE_LIMIT} characters).` };
  if (!isUuid(input.outgoingId)) return { ok: false, error: "Choose the outgoing officer." };
  if (input.incomingId !== null && !isUuid(input.incomingId)) return { ok: false, error: "Choose the incoming officer." };
  if (input.incomingId !== null && input.incomingId.toLowerCase() === input.outgoingId.toLowerCase()) return { ok: false, error: "The incoming officer must be someone other than the outgoing officer." };
  if (input.dueOn !== null && !isIsoDate(input.dueOn)) return { ok: false, error: "Check the due date." };
  if (!includes(handoffStatuses, input.status)) return { ok: false, error: "Choose a status." };
  if (typeof input.notes !== "string" || input.notes.trim().length > NOTES_LIMIT) return { ok: false, error: `Shorten the notes to ${NOTES_LIMIT} characters.` };
  if (!Array.isArray(input.items) || input.items.length > ITEM_LIMIT) return { ok: false, error: `A handoff holds up to ${ITEM_LIMIT} checklist items.` };
  const items: ItemInput[] = [];
  for (const raw of input.items) {
    const item = parseItem(raw);
    if (typeof item === "string") return { ok: false, error: item };
    items.push(item);
  }
  const ids = items.flatMap((item) => item.id ? [item.id.toLowerCase()] : []);
  if (new Set(ids).size !== ids.length) return { ok: false, error: "Check the checklist items." };
  if (input.status === "COMPLETE" && (input.incomingId === null || items.some((item) => !item.done))) {
    return { ok: false, error: "A handoff is complete only when it names the incoming officer and every item is ticked." };
  }
  return {
    ok: true,
    value: { roleTitle: input.roleTitle.trim(), outgoingId: input.outgoingId, incomingId: input.incomingId, dueOn: input.dueOn, status: input.status, notes: input.notes.trim(), items },
  };
}

function text(value: unknown): string {
  if (typeof value !== "string") throw new Error("Invalid handoff response");
  return value;
}
function nullableText(value: unknown): string | null {
  return value === null ? null : text(value);
}

function parseAccess(value: unknown): PersonAccess {
  if (!isObject(value) || !Array.isArray(value.roles) || !Array.isArray(value.reviewerGrants)) throw new Error("Invalid handoff access");
  return {
    roles: value.roles.map((role: unknown) => {
      if (!isObject(role)) throw new Error("Invalid handoff access");
      return { cycleId: text(role.cycleId), cycleName: nullableText(role.cycleName), role: text(role.role) };
    }),
    reviewerGrants: value.reviewerGrants.map((grant: unknown) => {
      if (!isObject(grant)) throw new Error("Invalid handoff access");
      return { cycleId: text(grant.cycleId), cycleName: nullableText(grant.cycleName), tool: text(grant.tool) };
    }),
  };
}

function parseHandoff(value: unknown): Handoff {
  if (!isObject(value) || !Array.isArray(value.items) || !isObject(value.access)) throw new Error("Invalid handoff response");
  const {
    id, outgoingName, incomingName, items, access, revision, completedAt, createdAt, updatedAt, createdByName, updatedByName, ...rest
  } = value;
  const itemList = (items as unknown[]).map((item) => {
    if (!isObject(item)) throw new Error("Invalid handoff item");
    const { doneAt, doneByName, ...input } = item;
    const parsed = parseItem(input);
    if (typeof parsed === "string" || parsed.id === null) throw new Error("Invalid handoff item");
    return { ...parsed, id: parsed.id, doneAt: nullableText(doneAt), doneByName: nullableText(doneByName) };
  });
  const input = parseHandoffInput({ ...rest, items: itemList.map(({ id: itemId, kind, label, detail, done }) => ({ id: itemId, kind, label, detail, done })) });
  if (!input.ok) throw new Error(`Invalid handoff response: ${input.error}`);
  if (typeof revision !== "number" || !Number.isSafeInteger(revision) || revision < 1) throw new Error("Invalid revision");
  const accessObject = access as Record<string, unknown>;
  return {
    ...input.value, id: text(id), outgoingName: nullableText(outgoingName), incomingName: nullableText(incomingName), items: itemList,
    access: { outgoing: parseAccess(accessObject.outgoing), incoming: accessObject.incoming === null ? null : parseAccess(accessObject.incoming) },
    revision, completedAt: nullableText(completedAt), createdAt: text(createdAt), updatedAt: text(updatedAt),
    createdByName: nullableText(createdByName), updatedByName: nullableText(updatedByName),
  };
}

export function parseHandoffBoard(value: unknown): HandoffBoard {
  if (!isObject(value) || !Array.isArray(value.handoffs) || !Array.isArray(value.people)) throw new Error("Invalid handoff response");
  return {
    handoffs: value.handoffs.map(parseHandoff),
    people: value.people.map((person: unknown) => {
      if (!isObject(person) || !isUuid(person.id)) throw new Error("Invalid handoff person");
      return { id: person.id, name: text(person.name) };
    }),
  };
}

export function progress(items: readonly { done: boolean }[]): { done: number; total: number } {
  return { done: items.filter((item) => item.done).length, total: items.length };
}

const roleLabels: Record<string, string> = { BOARD: "Board", OWNER: "Owner", PANEL: "Panel", RECRUITMENT_COMMITTEE: "Recruitment committee" };
const toolLabels: Record<string, string> = { pipeline: "Pipeline", evidence: "Evidence", lab: "AI lab" };

// One line per role or reviewer grant, e.g. "Owner · Fall 2026".
export function describeAccess(access: PersonAccess): string[] {
  const cycle = (grant: { cycleId: string; cycleName: string | null }) => grant.cycleName ?? grant.cycleId;
  return [
    ...access.roles.map((role) => `${roleLabels[role.role] ?? role.role} · ${cycle(role)}`),
    ...access.reviewerGrants.map((grant) => `${toolLabels[grant.tool] ?? grant.tool} reviewer · ${cycle(grant)}`),
  ];
}

// A starting checklist for a new handoff. Every line can be edited or removed.
export const starterItems: readonly Omit<ItemInput, "id" | "done">[] = [
  { kind: "ACCOUNT", label: "Shared drive folders and documents owned by the outgoing officer", detail: "" },
  { kind: "ACCOUNT", label: "Club email, mailing lists and calendars", detail: "" },
  { kind: "ACCOUNT", label: "Social and vendor accounts (move logins to the club password manager)", detail: "" },
  { kind: "ACCESS", label: "Cycle roles in Settings (Owner, Board, Recruitment committee)", detail: "" },
  { kind: "ACCESS", label: "Member-tool reviewer grants", detail: "" },
  { kind: "OPEN_ITEM", label: "Open client projects and contacts", detail: "" },
  { kind: "OPEN_ITEM", label: "Pending reimbursements and payments", detail: "" },
];
