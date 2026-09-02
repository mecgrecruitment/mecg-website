import { CLASS_YEARS, COLLEGES, parseApplicationDraft, type ApplicationDraft } from "@/lib/workflow";

export const APPLICATION_STEPS = ["details", "responses", "materials", "review"] as const;
export type ApplicationStep = (typeof APPLICATION_STEPS)[number];
export type ApplicationServerDraft = ApplicationDraft & { currentStep: ApplicationStep };

const MAX_LENGTHS: Record<Exclude<keyof ApplicationDraft, "answers">, number> = {
  name: 120,
  preferredName: 80,
  phone: 32,
  classYear: 20,
  major: 120,
  college: 80,
  uniqname: 16,
  gradTerm: 40,
  accessibilityNotes: 2000,
  linkedinUrl: 400,
  resumeStoragePath: 240,
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
