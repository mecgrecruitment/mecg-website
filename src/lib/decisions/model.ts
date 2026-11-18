// Board decision log. The database functions in
// 20261118130000_board_decision_log.sql are the authority; these checks mirror
// them so a bad form fails before a round trip, and parse the response so a
// malformed read shows the unavailable state instead of guesses.

export const decisionCategories = ["MEMBERSHIP", "RECRUITMENT", "FINANCE", "CLIENTS", "OPERATIONS", "POLICY", "OTHER"] as const;
export type DecisionCategory = typeof decisionCategories[number];
export const categoryLabels: Record<DecisionCategory, string> = {
  MEMBERSHIP: "Membership", RECRUITMENT: "Recruitment", FINANCE: "Finance", CLIENTS: "Clients",
  OPERATIONS: "Operations", POLICY: "Policy", OTHER: "Other",
};

export const decisionOutcomes = ["APPROVED", "REJECTED", "DEFERRED", "NOTED", "WITHDRAWN"] as const;
export type DecisionOutcome = typeof decisionOutcomes[number];
export const outcomeLabels: Record<DecisionOutcome, string> = {
  APPROVED: "Approved", REJECTED: "Rejected", DEFERRED: "Deferred", NOTED: "Noted, no vote needed", WITHDRAWN: "Withdrawn",
};

export type Votes = { for: number; against: number; abstain: number };
export type DecisionInput = {
  decidedOn: string;
  title: string;
  category: DecisionCategory;
  outcome: DecisionOutcome;
  summary: string;
  votes: Votes | null;
  minutesUrl: string;
};
export type Decision = DecisionInput & {
  id: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  createdByName: string | null;
  updatedByName: string | null;
};
export type DecisionLog = { decisions: Decision[] };

export const TITLE_LIMIT = 200;
export const SUMMARY_LIMIT = 2000;
export const URL_LIMIT = 500;
export const VOTE_LIMIT = 200;
const inputKeys = ["decidedOn", "title", "category", "outcome", "summary", "votes", "minutesUrl"] as const;

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
export function isMinutesUrl(value: string): boolean {
  return value.length <= URL_LIMIT && /^https:\/\/\S+$/.test(value);
}

function parseVotes(value: unknown): Votes | null | undefined {
  if (value === null) return null;
  if (!isObject(value) || !hasExactly(value, ["for", "against", "abstain"])) return undefined;
  const counts = [value.for, value.against, value.abstain];
  if (!counts.every((count) => typeof count === "number" && Number.isInteger(count) && count >= 0 && count <= VOTE_LIMIT)) return undefined;
  return { for: value.for as number, against: value.against as number, abstain: value.abstain as number };
}

export function parseDecisionInput(input: unknown): Parsed<DecisionInput> {
  if (!isObject(input) || !hasExactly(input, inputKeys)) return { ok: false, error: "Invalid decision form." };
  if (!isIsoDate(input.decidedOn)) return { ok: false, error: "Give the date of the decision." };
  if (typeof input.title !== "string" || !input.title.trim() || input.title.trim().length > TITLE_LIMIT) return { ok: false, error: `Give the decision a title (up to ${TITLE_LIMIT} characters).` };
  if (!includes(decisionCategories, input.category)) return { ok: false, error: "Choose a category." };
  if (!includes(decisionOutcomes, input.outcome)) return { ok: false, error: "Choose an outcome." };
  if (typeof input.summary !== "string" || input.summary.trim().length > SUMMARY_LIMIT) return { ok: false, error: `Shorten the summary to ${SUMMARY_LIMIT} characters.` };
  const votes = parseVotes(input.votes);
  if (votes === undefined) return { ok: false, error: `Vote counts must be whole numbers from 0 to ${VOTE_LIMIT}.` };
  if (typeof input.minutesUrl !== "string") return { ok: false, error: "Check the minutes link." };
  const minutesUrl = input.minutesUrl.trim();
  if (minutesUrl && !isMinutesUrl(minutesUrl)) return { ok: false, error: "The minutes link must be a full https:// address." };
  return {
    ok: true,
    value: { decidedOn: input.decidedOn, title: input.title.trim(), category: input.category, outcome: input.outcome, summary: input.summary.trim(), votes, minutesUrl },
  };
}

function text(value: unknown): string {
  if (typeof value !== "string") throw new Error("Invalid decision response");
  return value;
}
function nullableText(value: unknown): string | null {
  return value === null ? null : text(value);
}

function parseDecision(value: unknown): Decision {
  if (!isObject(value)) throw new Error("Invalid decision response");
  const { id, revision, createdAt, updatedAt, createdByName, updatedByName, ...rest } = value;
  const input = parseDecisionInput(rest);
  if (!input.ok) throw new Error(`Invalid decision response: ${input.error}`);
  if (typeof revision !== "number" || !Number.isSafeInteger(revision) || revision < 1) throw new Error("Invalid revision");
  return {
    ...input.value, id: text(id), revision, createdAt: text(createdAt), updatedAt: text(updatedAt),
    createdByName: nullableText(createdByName), updatedByName: nullableText(updatedByName),
  };
}

export function parseDecisionLog(value: unknown): DecisionLog {
  if (!isObject(value) || !Array.isArray(value.decisions)) throw new Error("Invalid decision log response");
  return { decisions: value.decisions.map(parseDecision) };
}

export type DecisionFilter = { category: DecisionCategory | ""; outcome: DecisionOutcome | ""; query: string };

export function filterDecisions(decisions: readonly Decision[], filter: DecisionFilter): Decision[] {
  const query = filter.query.trim().toLocaleLowerCase();
  return decisions.filter((decision) =>
    (!filter.category || decision.category === filter.category)
    && (!filter.outcome || decision.outcome === filter.outcome)
    && (!query || `${decision.title}\n${decision.summary}`.toLocaleLowerCase().includes(query)));
}

export function formatVotes(votes: Votes | null): string {
  return votes ? `${votes.for} for · ${votes.against} against · ${votes.abstain} abstained` : "No vote recorded";
}
