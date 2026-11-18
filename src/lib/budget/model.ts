// Budget and reimbursement log. The database functions in
// 20261118190000_budget_requests.sql are the authority; these checks mirror
// them so a bad form fails before a round trip, and parse responses so a
// malformed read shows the unavailable state instead of guesses.
// This is an approval log only: nothing here moves money.

export const requestKinds = ["REIMBURSEMENT", "PURCHASE"] as const;
export type RequestKind = typeof requestKinds[number];
export const kindLabels: Record<RequestKind, string> = {
  REIMBURSEMENT: "Pay me back", PURCHASE: "Approve before I buy",
};

export const budgetCategories = ["EVENTS", "RECRUITMENT", "CLIENT_WORK", "MARKETING", "OPERATIONS", "OTHER"] as const;
export type BudgetCategory = typeof budgetCategories[number];
export const categoryLabels: Record<BudgetCategory, string> = {
  EVENTS: "Events", RECRUITMENT: "Recruitment", CLIENT_WORK: "Client work", MARKETING: "Marketing", OPERATIONS: "Operations", OTHER: "Other",
};

export const requestStatuses = ["SUBMITTED", "APPROVED", "DENIED", "PAID", "WITHDRAWN"] as const;
export type RequestStatus = typeof requestStatuses[number];
export const statusLabels: Record<RequestStatus, string> = {
  SUBMITTED: "Waiting for a decision", APPROVED: "Approved, not paid", DENIED: "Denied", PAID: "Paid", WITHDRAWN: "Withdrawn",
};

export const actions = ["WITHDRAW", "APPROVE", "DENY", "MARK_PAID"] as const;
export type BudgetAction = typeof actions[number];

export type BudgetRequestInput = {
  kind: RequestKind;
  title: string;
  category: BudgetCategory;
  amountCents: number;
  spentOn: string | null;
  receiptUrl: string;
  notes: string;
};
export type BudgetRequest = BudgetRequestInput & {
  id: string;
  status: RequestStatus;
  isMine: boolean;
  requesterName: string | null;
  decisionNote: string;
  decidedAt: string | null;
  decidedByName: string | null;
  paidOn: string | null;
  paymentNote: string;
  paidRecordedByName: string | null;
  revision: number;
  createdAt: string;
  updatedAt: string;
};
export type BudgetRequestList = { requests: BudgetRequest[] };

export const TITLE_LIMIT = 200;
export const NOTES_LIMIT = 2000;
export const URL_LIMIT = 500;
export const DECISION_NOTE_LIMIT = 1000;
export const PAYMENT_NOTE_LIMIT = 200;
export const MAX_CENTS = 1_000_000;
const inputKeys = ["kind", "title", "category", "amountCents", "spentOn", "receiptUrl", "notes"] as const;

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

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < "0001-01-01") return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

// Same rule as the database: https, no whitespace, at most 500 characters.
export function isReceiptUrl(value: string): boolean {
  return value.length <= URL_LIMIT && /^https:\/\/\S+$/.test(value);
}

export function isAmountCents(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= MAX_CENTS;
}

// "84.5", "$1,234.56" or "12" to whole cents, without floating-point rounding.
export function parseDollars(value: string): number | null {
  const match = /^\$?\s*(\d{1,3}(?:,\d{3})*|\d+)(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) return null;
  const cents = Number(match[1]!.replace(/,/g, "")) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return isAmountCents(cents) ? cents : null;
}

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
export function formatCents(cents: number): string {
  return money.format(cents / 100);
}

export function parseBudgetRequestInput(input: unknown): Parsed<BudgetRequestInput> {
  if (!isObject(input) || !hasExactly(input, inputKeys)) return { ok: false, error: "Invalid request form." };
  if (!includes(requestKinds, input.kind)) return { ok: false, error: "Choose what you are asking for." };
  if (typeof input.title !== "string" || !input.title.trim() || input.title.trim().length > TITLE_LIMIT) return { ok: false, error: `Say what the money is for (up to ${TITLE_LIMIT} characters).` };
  if (!includes(budgetCategories, input.category)) return { ok: false, error: "Choose a budget area." };
  if (!isAmountCents(input.amountCents)) return { ok: false, error: "Give an amount from $0.01 to $10,000.00." };
  if (input.spentOn !== null && !isIsoDate(input.spentOn)) return { ok: false, error: "Check the date." };
  if (input.kind === "REIMBURSEMENT" && input.spentOn === null) return { ok: false, error: "Give the date you spent the money." };
  if (typeof input.receiptUrl !== "string") return { ok: false, error: "Check the receipt link." };
  const receiptUrl = input.receiptUrl.trim();
  if (receiptUrl && !isReceiptUrl(receiptUrl)) return { ok: false, error: "The receipt link must be a full https:// address." };
  if (typeof input.notes !== "string" || input.notes.trim().length > NOTES_LIMIT) return { ok: false, error: `Shorten the notes to ${NOTES_LIMIT} characters.` };
  return {
    ok: true,
    value: { kind: input.kind, title: input.title.trim(), category: input.category, amountCents: input.amountCents, spentOn: input.spentOn, receiptUrl, notes: input.notes.trim() },
  };
}

export type ActionPayload = Record<string, never> | { note: string } | { paidOn: string; paymentNote: string };

// The payload each action takes, trimmed, or the reason it is refused.
export function parseActionPayload(action: BudgetAction, input: unknown): Parsed<ActionPayload> {
  if (!isObject(input)) return { ok: false, error: "Invalid form." };
  if (action === "WITHDRAW") return hasExactly(input, []) ? { ok: true, value: {} } : { ok: false, error: "Invalid form." };
  if (action === "MARK_PAID") {
    if (!hasExactly(input, ["paidOn", "paymentNote"])) return { ok: false, error: "Invalid form." };
    if (!isIsoDate(input.paidOn)) return { ok: false, error: "Give the date it was paid." };
    if (typeof input.paymentNote !== "string" || input.paymentNote.trim().length > PAYMENT_NOTE_LIMIT) return { ok: false, error: `Shorten the payment note to ${PAYMENT_NOTE_LIMIT} characters.` };
    return { ok: true, value: { paidOn: input.paidOn, paymentNote: input.paymentNote.trim() } };
  }
  if (!hasExactly(input, ["note"]) || typeof input.note !== "string") return { ok: false, error: "Invalid form." };
  const note = input.note.trim();
  if (note.length > DECISION_NOTE_LIMIT) return { ok: false, error: `Shorten the note to ${DECISION_NOTE_LIMIT} characters.` };
  if (action === "DENY" && !note) return { ok: false, error: "Say why the request is denied." };
  return { ok: true, value: { note } };
}

function text(value: unknown): string {
  if (typeof value !== "string") throw new Error("Invalid budget response");
  return value;
}
function nullableText(value: unknown): string | null {
  return value === null ? null : text(value);
}

// Stored rows are read leniently: the database already enforced its own
// limits, and its whitespace and length rules count characters slightly
// differently from JavaScript, so one stored row must not blank the whole
// list. Only the shape, the enums and a safe receipt link are required here.
function parseRequest(value: unknown): BudgetRequest {
  if (!isObject(value)) throw new Error("Invalid budget response");
  const { id, kind, title, category, amountCents, spentOn, receiptUrl, notes, status, isMine, requesterName, decisionNote, decidedAt, decidedByName, paidOn, paymentNote, paidRecordedByName, revision, createdAt, updatedAt } = value;
  if (!includes(requestKinds, kind) || !includes(budgetCategories, category) || !includes(requestStatuses, status) || typeof isMine !== "boolean") throw new Error("Invalid budget response");
  if (typeof amountCents !== "number" || !Number.isSafeInteger(amountCents) || amountCents < 1) throw new Error("Invalid budget response");
  if (spentOn !== null && !isIsoDate(spentOn)) throw new Error("Invalid budget response");
  // The link becomes an href, so it must be https whatever else it holds.
  if (typeof receiptUrl !== "string" || (receiptUrl !== "" && !/^https:\/\//.test(receiptUrl))) throw new Error("Invalid budget response");
  if (typeof revision !== "number" || !Number.isSafeInteger(revision) || revision < 1) throw new Error("Invalid revision");
  if (paidOn !== null && !isIsoDate(paidOn)) throw new Error("Invalid budget response");
  if ((status === "PAID") !== (paidOn !== null)) throw new Error("Invalid budget response");
  return {
    id: text(id), kind, title: text(title), category, amountCents, spentOn, receiptUrl, notes: text(notes), status, isMine,
    requesterName: nullableText(requesterName), decisionNote: text(decisionNote), decidedAt: nullableText(decidedAt), decidedByName: nullableText(decidedByName),
    paidOn, paymentNote: text(paymentNote), paidRecordedByName: nullableText(paidRecordedByName), revision, createdAt: text(createdAt), updatedAt: text(updatedAt),
  };
}

export function parseBudgetRequestList(value: unknown): BudgetRequestList {
  if (!isObject(value) || !Array.isArray(value.requests)) throw new Error("Invalid budget response");
  return { requests: value.requests.map(parseRequest) };
}

export type Tally = { count: number; cents: number };
export type BudgetSummary = { waiting: Tally; approvedUnpaid: Tally; paid: Tally };

export function summarizeRequests(requests: readonly BudgetRequest[]): BudgetSummary {
  const tally = (status: RequestStatus) => requests.filter((request) => request.status === status)
    .reduce((sum, request) => ({ count: sum.count + 1, cents: sum.cents + request.amountCents }), { count: 0, cents: 0 });
  return { waiting: tally("SUBMITTED"), approvedUnpaid: tally("APPROVED"), paid: tally("PAID") };
}

// The board works the queue: waiting first, then approved and unpaid, then the
// closed ones; newest first within each group.
const statusOrder: Record<RequestStatus, number> = { SUBMITTED: 0, APPROVED: 1, PAID: 2, DENIED: 3, WITHDRAWN: 4 };
export function orderForBoard(requests: readonly BudgetRequest[]): BudgetRequest[] {
  return [...requests].sort((a, b) => statusOrder[a.status] - statusOrder[b.status] || b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
}

// Which next steps a viewer can take. The database enforces the same rules.
export function availableActions(request: BudgetRequest, viewer: "member" | "board"): BudgetAction[] {
  if (viewer === "member") return request.isMine && (request.status === "SUBMITTED" || request.status === "APPROVED") ? ["WITHDRAW"] : [];
  if (request.isMine) return [];
  if (request.status === "SUBMITTED") return ["APPROVE", "DENY"];
  if (request.status === "APPROVED") return ["MARK_PAID"];
  return [];
}
