import { APPLICATION_FIELD_LIMITS, CLASS_YEARS, COLLEGES, parseApplicationDraft, type ApplicationDraft } from "@/lib/workflow";

export const APPLICATION_STEPS = ["details", "responses", "materials", "review"] as const;
export type ApplicationStep = (typeof APPLICATION_STEPS)[number];
export type ApplicationServerDraft = ApplicationDraft & {
  currentStep: ApplicationStep;
};

const MAX_LENGTHS: Record<Exclude<keyof ApplicationDraft, "answers">, number> = {
  name: APPLICATION_FIELD_LIMITS.name,
  preferredName: APPLICATION_FIELD_LIMITS.preferredName,
  phone: APPLICATION_FIELD_LIMITS.phone,
  classYear: APPLICATION_FIELD_LIMITS.classYear,
  major: APPLICATION_FIELD_LIMITS.major,
  college: APPLICATION_FIELD_LIMITS.college,
  uniqname: APPLICATION_FIELD_LIMITS.uniqname,
  gradTerm: APPLICATION_FIELD_LIMITS.gradTerm,
  accessibilityNotes: APPLICATION_FIELD_LIMITS.accessibilityNotes,
  linkedinUrl: APPLICATION_FIELD_LIMITS.linkedinUrl,
  resumeStoragePath: APPLICATION_FIELD_LIMITS.resumeStoragePath,
};
const ALLOWED_KEYS = new Set([...Object.keys(MAX_LENGTHS), "answers", "currentStep", "consent"]);
const ANSWER_KEY = /^[a-z][a-z0-9_]*$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function parseApplicationServerDraft(value: unknown): ApplicationServerDraft | null {
  if (!isRecord(value) || Object.keys(value).some((key) => !ALLOWED_KEYS.has(key))) return null;
  for (const [key, max] of Object.entries(MAX_LENGTHS)) {
    const field = value[key];
    if (field !== undefined && (typeof field !== "string" || field.length > max)) return null;
  }
  if (value.classYear && !CLASS_YEARS.includes(value.classYear as (typeof CLASS_YEARS)[number])) return null;
  if (value.college && !COLLEGES.includes(value.college as (typeof COLLEGES)[number])) return null;
  if (value.consent !== undefined && value.consent !== false) return null;
  if (value.currentStep !== undefined && !APPLICATION_STEPS.includes(value.currentStep as ApplicationStep)) return null;
  if (value.answers !== undefined) {
    if (!isRecord(value.answers)) return null;
    const entries = Object.entries(value.answers);
    if (entries.length > 50) return null;
    let totalLength = 0;
    for (const [key, answer] of entries) {
      if (key.length > 80 || !ANSWER_KEY.test(key) || typeof answer !== "string" || answer.length > 8000) return null;
      totalLength += answer.length;
      if (totalLength > 40000) return null;
    }
  }
  const draft = parseApplicationDraft(value);
  if (!draft) return null;
  return {
    ...draft,
    currentStep: APPLICATION_STEPS.includes(value.currentStep as ApplicationStep)
      ? value.currentStep as ApplicationStep
      : "details",
  };
}

const STEP_STORAGE_KEY = "mecg.application-step-recovery.v1";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function scopeKey(scope: { userIdentity: string; cycleIdentity: string; schemaIdentity: string }) {
  return JSON.stringify([scope.userIdentity, scope.cycleIdentity, scope.schemaIdentity]);
}

export function saveApplicationStepRecovery(
  storage: StorageLike,
  scope: { userIdentity: string; cycleIdentity: string; schemaIdentity: string },
  step: ApplicationStep,
) {
  try {
    storage.setItem(STEP_STORAGE_KEY, JSON.stringify({ scope: scopeKey(scope), step }));
    return true;
  } catch {
    return false;
  }
}

export function loadApplicationStepRecovery(
  storage: StorageLike,
  scope: { userIdentity: string; cycleIdentity: string; schemaIdentity: string },
): ApplicationStep | null {
  try {
    const raw = storage.getItem(STEP_STORAGE_KEY);
    if (!raw || raw.length > 1024) return null;
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value) || value.scope !== scopeKey(scope) || !APPLICATION_STEPS.includes(value.step as ApplicationStep)) return null;
    return value.step as ApplicationStep;
  } catch {
    return null;
  }
}

export function clearApplicationStepRecovery(storage: StorageLike) {
  try {
    storage.removeItem(STEP_STORAGE_KEY);
  } catch {
    // Browser recovery must never block a successful submission.
  }
}

// UUIDs are opaque revision tokens, never clocks or sequence estimates.
const UUID_TOKEN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isDraftRevision(value: unknown): value is string {
  return typeof value === "string" && UUID_TOKEN.test(value);
}
export type ApplicationDraftSnapshot = { draft: ApplicationServerDraft; revision: string };
export function parseApplicationDraftSnapshot(value: unknown): ApplicationDraftSnapshot | null {
  if (!isRecord(value) || !isDraftRevision(value.revision)) return null;
  const { revision, ...payload } = value;
  const draft = parseApplicationServerDraft(payload);
  return draft ? { draft, revision } : null;
}
export type ApplicationDraftSaveRequest = {
  draft: ApplicationServerDraft;
  expectedRevision: string | null;
  mutationId: string;
  cycleId: string;
};
export function parseApplicationDraftSaveRequest(value: unknown): ApplicationDraftSaveRequest | null {
  if (!isRecord(value) || Object.keys(value).length !== 4) return null;
  if (!isDraftRevision(value.mutationId) || !(value.expectedRevision === null || isDraftRevision(value.expectedRevision))
    || typeof value.cycleId !== "string" || !value.cycleId || value.cycleId.length > 240) return null;
  const draft = parseApplicationServerDraft(value.draft);
  return draft ? { draft, expectedRevision: value.expectedRevision, mutationId: value.mutationId, cycleId: value.cycleId } : null;
}
export type ApplicationDraftSaveResult = { kind: "saved"; revision: string }
  | { kind: "conflict"; snapshot: ApplicationDraftSnapshot | null };
export function parseApplicationDraftSaveResult(value: unknown): ApplicationDraftSaveResult | null {
  if (!isRecord(value)) return null;
  if (value.kind === "saved" && isDraftRevision(value.revision)) return { kind: "saved", revision: value.revision };
  if (value.kind !== "conflict") return null;
  if (value.draft === null) return { kind: "conflict", snapshot: null };
  const snapshot = parseApplicationDraftSnapshot(value.draft);
  return snapshot ? { kind: "conflict", snapshot } : null;
}
