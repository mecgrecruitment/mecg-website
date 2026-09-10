const STORAGE_KEY = "mecg.application-draft-recovery.v1";
const VERSION = 1;
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_SERIALIZED_BYTES = 96 * 1024;
const MAX_ANSWER_COUNT = 50;
const MAX_ANSWER_LENGTH = 8000;
const MAX_ANSWERS_LENGTH = 40000;
const ANSWER_KEY = /^[a-z][a-z0-9_]*$/;

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type ApplicationDraftRecoveryQuestion = {
  key: string;
  prompt: string;
  inputType: string;
  required: boolean;
  options: string[];
  maxWords: number | null;
};

export type ApplicationDraftRecoveryScope = {
  userIdentity: string;
  cycleIdentity: string;
  schemaIdentity: string;
};

export type ApplicationDraftRecovery = {
  name: string;
  preferredName: string;
  phone: string;
  classYear: string;
  major: string;
  college: string;
  uniqname: string;
  gradTerm: string;
  accessibilityNotes: string;
  linkedinUrl: string;
  answers: Record<string, string>;
};

type RecoveryEnvelope = {
  version: number;
  savedAt: number;
  scope: ApplicationDraftRecoveryScope;
  draft: ApplicationDraftRecovery;
};

export type ApplicationDraftRecoverySnapshot = {
  draft: ApplicationDraftRecovery;
  savedAt: number;
};

const DRAFT_KEYS = new Set([
  "name",
  "preferredName",
  "phone",
  "classYear",
  "major",
  "college",
  "uniqname",
  "gradTerm",
  "accessibilityNotes",
  "linkedinUrl",
  "answers",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function serializedBytes(value: string) {
  return new TextEncoder().encode(value).byteLength;
}

// This fingerprint is a storage namespace, not an authorization boundary. The exact
// user and cycle identities are also retained and compared before restoration.
function schemaFingerprint(value: string) {
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193);
    second = Math.imul(second ^ code, 0x85ebca6b);
  }
  return `${value.length.toString(36)}-${(first >>> 0).toString(36)}-${(second >>> 0).toString(36)}`;
}

export function createApplicationDraftRecoveryScope({
  userIdentity,
  cycleIdentity,
  questions,
}: {
  userIdentity: string;
  cycleIdentity: string;
  questions: ApplicationDraftRecoveryQuestion[];
}): ApplicationDraftRecoveryScope {
  const schema = questions.map(({ key, prompt, inputType, required, options, maxWords }) => ({ key, prompt, inputType, required, options, maxWords }));
  return {
    userIdentity: userIdentity.trim().toLowerCase(),
    cycleIdentity,
    schemaIdentity: schemaFingerprint(JSON.stringify(schema)),
  };
}

function parseScope(value: unknown): ApplicationDraftRecoveryScope | null {
  if (!isRecord(value)) return null;
  const keys = Object.keys(value);
  if (keys.length !== 3 || !keys.every((key) => ["userIdentity", "cycleIdentity", "schemaIdentity"].includes(key))) return null;
  if (typeof value.userIdentity !== "string" || !value.userIdentity || value.userIdentity.length > 320) return null;
  if (typeof value.cycleIdentity !== "string" || !value.cycleIdentity || value.cycleIdentity.length > 240) return null;
  if (typeof value.schemaIdentity !== "string" || !value.schemaIdentity || value.schemaIdentity.length > 100) return null;
  return {
    userIdentity: value.userIdentity,
    cycleIdentity: value.cycleIdentity,
    schemaIdentity: value.schemaIdentity,
  };
}

function parseDraft(value: unknown): ApplicationDraftRecovery | null {
  if (!isRecord(value) || Object.keys(value).length !== DRAFT_KEYS.size || !Object.keys(value).every((key) => DRAFT_KEYS.has(key))) return null;
  const limits: Record<Exclude<keyof ApplicationDraftRecovery, "answers">, number> = {
    name: 120,
    preferredName: 80,
    phone: 32,
    classYear: 40,
    major: 120,
    college: 80,
    uniqname: 16,
    gradTerm: 40,
    accessibilityNotes: 2000,
    linkedinUrl: 400,
  };
  for (const [key, limit] of Object.entries(limits)) {
    if (typeof value[key] !== "string" || value[key].length > limit) return null;
  }
  if (!isRecord(value.answers)) return null;
  const entries = Object.entries(value.answers);
  if (entries.length > MAX_ANSWER_COUNT) return null;
  let totalAnswerLength = 0;
  const answers: Record<string, string> = {};
  for (const [key, answer] of entries) {
    if (!ANSWER_KEY.test(key) || key.length > 80 || typeof answer !== "string" || answer.length > MAX_ANSWER_LENGTH) return null;
    totalAnswerLength += answer.length;
    if (totalAnswerLength > MAX_ANSWERS_LENGTH) return null;
    answers[key] = answer;
  }
  return {
    name: value.name as string,
    preferredName: value.preferredName as string,
    phone: value.phone as string,
    classYear: value.classYear as string,
    major: value.major as string,
    college: value.college as string,
    uniqname: value.uniqname as string,
    gradTerm: value.gradTerm as string,
    accessibilityNotes: value.accessibilityNotes as string,
    linkedinUrl: value.linkedinUrl as string,
    answers,
  };
}

function sameScope(left: ApplicationDraftRecoveryScope, right: ApplicationDraftRecoveryScope) {
  return left.userIdentity === right.userIdentity
    && left.cycleIdentity === right.cycleIdentity
    && left.schemaIdentity === right.schemaIdentity;
}

export function saveApplicationDraftRecovery(
  storage: StorageLike,
  scope: ApplicationDraftRecoveryScope,
  draft: ApplicationDraftRecovery,
  now = Date.now(),
) {
  const parsedScope = parseScope(scope);
  // Pick the allowlisted fields before serialization so an accidental wider object
  // can never persist resume metadata, consent, or another newly-added field.
  const parsedDraft = parseDraft({
    name: draft.name,
    preferredName: draft.preferredName,
    phone: draft.phone,
    classYear: draft.classYear,
    major: draft.major,
    college: draft.college,
    uniqname: draft.uniqname,
    gradTerm: draft.gradTerm,
    accessibilityNotes: draft.accessibilityNotes,
    linkedinUrl: draft.linkedinUrl,
    answers: draft.answers,
  });
  if (!parsedScope || !parsedDraft || !Number.isFinite(now) || now < 0) return false;
  const serialized = JSON.stringify({ version: VERSION, savedAt: now, scope: parsedScope, draft: parsedDraft } satisfies RecoveryEnvelope);
  if (serializedBytes(serialized) > MAX_SERIALIZED_BYTES) return false;
  try {
    storage.setItem(STORAGE_KEY, serialized);
    return true;
  } catch {
    return false;
  }
}

export function loadApplicationDraftRecovery(
  storage: StorageLike,
  expectedScope: ApplicationDraftRecoveryScope,
  now = Date.now(),
): ApplicationDraftRecovery | null {
  return loadApplicationDraftRecoverySnapshot(storage, expectedScope, now)?.draft ?? null;
}

export function loadApplicationDraftRecoverySnapshot(
  storage: StorageLike,
  expectedScope: ApplicationDraftRecoveryScope,
  now = Date.now(),
): ApplicationDraftRecoverySnapshot | null {
  let serialized: string | null = null;
  try {
    serialized = storage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!serialized) return null;
  const reject = () => {
    try { storage.removeItem(STORAGE_KEY); } catch { /* Storage may be unavailable. */ }
    return null;
  };
  if (serializedBytes(serialized) > MAX_SERIALIZED_BYTES) return reject();
  let value: unknown;
  try {
    value = JSON.parse(serialized);
  } catch {
    return reject();
  }
  if (!isRecord(value) || Object.keys(value).length !== 4 || !["version", "savedAt", "scope", "draft"].every((key) => key in value)) return reject();
  if (value.version !== VERSION || typeof value.savedAt !== "number" || !Number.isFinite(value.savedAt) || !Number.isFinite(now)) return reject();
  if (value.savedAt > now || now - value.savedAt > MAX_AGE_MS) return reject();
  const scope = parseScope(value.scope);
  const draft = parseDraft(value.draft);
  if (!scope || !draft || !sameScope(scope, expectedScope)) return reject();
  return { draft, savedAt: value.savedAt };
}

export function clearApplicationDraftRecovery(storage: StorageLike) {
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // Saving to sessionStorage is best-effort; an unavailable store must not break the form.
  }
}
