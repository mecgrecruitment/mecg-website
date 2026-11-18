// Client close-out: the one-time feedback link and its answers. The database
// functions in 20261118060000_client_closeout_feedback.sql are the authority;
// these checks mirror them so a bad form fails before a round trip, and parse
// responses so a malformed read shows an unavailable state.

export const rehireAnswers = ["YES", "MAYBE", "NO"] as const;
export type RehireAnswer = typeof rehireAnswers[number];
export const rehireLabels: Record<RehireAnswer, string> = { YES: "Yes", MAYBE: "Maybe", NO: "No" };

export const closeoutStates = ["ACTIVE", "EXPIRED", "REVOKED", "RECEIVED"] as const;
export type CloseoutState = typeof closeoutStates[number];

export const QUOTE_LIMIT = 1000;
export const ATTRIBUTION_LIMIT = 200;
export const SCOPE_LIMIT = 1000;
export const FEEDBACK_KEYS = ["satisfaction", "wouldRehire", "quote", "attribution", "quotePermission", "logoPermission", "permissionScope"] as const;

export type FeedbackInput = {
  satisfaction: number;
  wouldRehire: RehireAnswer;
  quote: string;
  attribution: string;
  quotePermission: boolean;
  logoPermission: boolean;
  permissionScope: string;
};

export type Closeout = {
  projectId: string;
  cycleId: string;
  leadName: string | null;
  state: CloseoutState;
  requestedAt: string;
  expiresAt: string | null;
  submittedAt: string | null;
  satisfaction: number | null;
  wouldRehire: RehireAnswer | null;
  quote: string;
  attribution: string;
  quotePermission: boolean | null;
  logoPermission: boolean | null;
  permissionScope: string;
  evidenceCreated: boolean;
};

export type FeedbackForm = { projectTitle: string; clientLabel: string; expiresAt: string };

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function includes<T extends string>(list: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (list as readonly string[]).includes(value);
}
function text(value: unknown): string {
  if (typeof value !== "string") throw new Error("Invalid close-out response");
  return value;
}
function nullableText(value: unknown): string | null {
  return value === null ? null : text(value);
}
function nullableBoolean(value: unknown): boolean | null {
  if (value === null || typeof value === "boolean") return value;
  throw new Error("Invalid close-out response");
}

export function isFeedbackToken(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}

export function isRating(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5;
}

export function parseFeedbackInput(input: unknown): Parsed<FeedbackInput> {
  if (!isObject(input) || !Object.keys(input).every((key) => (FEEDBACK_KEYS as readonly string[]).includes(key))) {
    return { ok: false, error: "Check the feedback form." };
  }
  const { satisfaction, wouldRehire, quote, attribution, quotePermission, logoPermission, permissionScope } = input;
  if (!isRating(satisfaction)) return { ok: false, error: "Choose a satisfaction rating from 1 to 5." };
  if (!includes(rehireAnswers, wouldRehire)) return { ok: false, error: "Say whether you would work with MECG again." };
  if (typeof quote !== "string" || typeof attribution !== "string" || typeof permissionScope !== "string"
    || typeof quotePermission !== "boolean" || typeof logoPermission !== "boolean") return { ok: false, error: "Check the feedback form." };
  const value = { satisfaction, wouldRehire, quote: quote.trim(), attribution: attribution.trim(), quotePermission, logoPermission, permissionScope: permissionScope.trim() };
  if (value.quote.length > QUOTE_LIMIT || value.attribution.length > ATTRIBUTION_LIMIT || value.permissionScope.length > SCOPE_LIMIT) return { ok: false, error: "Shorten your answers." };
  if (quotePermission && !value.quote) return { ok: false, error: "Add the quote you are allowing us to use." };
  if ((quotePermission || logoPermission) && !value.permissionScope) return { ok: false, error: "Say where and how we may use it." };
  return { ok: true, value };
}

function parseCloseout(value: unknown): Closeout {
  if (!isObject(value) || !includes(closeoutStates, value.state)) throw new Error("Invalid close-out state");
  if (value.satisfaction !== null && !isRating(value.satisfaction)) throw new Error("Invalid satisfaction");
  if (value.wouldRehire !== null && !includes(rehireAnswers, value.wouldRehire)) throw new Error("Invalid rehire answer");
  if (typeof value.evidenceCreated !== "boolean") throw new Error("Invalid close-out response");
  return {
    projectId: text(value.projectId),
    cycleId: text(value.cycleId),
    leadName: nullableText(value.leadName),
    state: value.state,
    requestedAt: text(value.requestedAt),
    expiresAt: nullableText(value.expiresAt),
    submittedAt: nullableText(value.submittedAt),
    satisfaction: value.satisfaction,
    wouldRehire: value.wouldRehire,
    quote: text(value.quote),
    attribution: text(value.attribution),
    quotePermission: nullableBoolean(value.quotePermission),
    logoPermission: nullableBoolean(value.logoPermission),
    permissionScope: text(value.permissionScope),
    evidenceCreated: value.evidenceCreated,
  };
}

export function parseCloseoutOverview(value: unknown): Map<string, Closeout> {
  if (!Array.isArray(value)) throw new Error("Invalid close-out overview");
  return new Map(value.map(parseCloseout).map((item) => [item.projectId, item]));
}

export function parseFeedbackForm(value: unknown): FeedbackForm | null {
  if (value === null) return null;
  if (!isObject(value)) throw new Error("Invalid feedback form");
  return { projectTitle: text(value.projectTitle), clientLabel: text(value.clientLabel), expiresAt: text(value.expiresAt) };
}

export function parseLinkResponse(value: unknown): { token: string; expiresAt: string } | null {
  if (!isObject(value) || !isFeedbackToken(value.token) || typeof value.expiresAt !== "string") return null;
  return { token: value.token, expiresAt: value.expiresAt };
}

export function feedbackLink(origin: string, token: string): string {
  return `${origin.replace(/\/+$/, "")}/feedback/${token}`;
}
