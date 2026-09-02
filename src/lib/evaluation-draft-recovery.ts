export const EVALUATION_DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const EVALUATION_DRAFT_MAX_BYTES = 64 * 1024;

const STORAGE_PREFIX = "mecg:evaluation-draft:v1:";
const SNAPSHOT_VERSION = 1;
const VALID_SCORES = new Set(["", "1", "2", "3", "4", "5", "NO"]);
const MAX_NOTE_LENGTH = 2000;
const MAX_EVIDENCE_LENGTH = 4000;
const SNAPSHOT_KEYS = new Set(["version", "assignmentId", "rubricIdentity", "savedAt", "ratings", "evidence"]);
const RATING_KEYS = new Set(["criterionId", "score", "note"]);

type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type EvaluationDraftCriterion = {
  id: string;
  name: string;
  description: string;
  weight: number;
  required: boolean;
};

export type EvaluationDraft = {
  scores: Record<string, string>;
  notes: Record<string, string>;
  evidence: string;
};

type StoredEvaluationDraft = {
  version: number;
  assignmentId: string;
  rubricIdentity: string;
  savedAt: number;
  ratings: Array<{
    criterionId: string;
    score: string;
    note: string;
  }>;
  evidence: string;
};

export function evaluationRubricIdentity(criteria: EvaluationDraftCriterion[]) {
  return JSON.stringify(
    criteria.map(({ id, name, description, weight, required }) => ({
      id,
      name,
      description,
      weight,
      required,
    })),
  );
}

function storageKey(assignmentId: string) {
  return `${STORAGE_PREFIX}${encodeURIComponent(assignmentId)}`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function removeInvalidSnapshot(storage: DraftStorage, key: string) {
  try {
    storage.removeItem(key);
  } catch {
    // Recovery is best-effort; unavailable browser storage must not block scoring.
  }
  return null;
}

export function readEvaluationDraft({
  storage,
  assignmentId,
  criteria,
  now = Date.now(),
}: {
  storage: DraftStorage;
  assignmentId: string;
  criteria: EvaluationDraftCriterion[];
  now?: number;
}): EvaluationDraft | null {
  const key = storageKey(assignmentId);
  let raw: string | null;
  try {
    raw = storage.getItem(key);
  } catch {
    return null;
  }
  if (raw === null) return null;
  if (new TextEncoder().encode(raw).byteLength > EVALUATION_DRAFT_MAX_BYTES) {
    return removeInvalidSnapshot(storage, key);
  }

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return removeInvalidSnapshot(storage, key);
  }
  if (
    !isPlainObject(value)
    || Object.keys(value).length !== SNAPSHOT_KEYS.size
    || !Object.keys(value).every((entry) => SNAPSHOT_KEYS.has(entry))
  ) return removeInvalidSnapshot(storage, key);

  const expectedIds = new Set(criteria.map((criterion) => criterion.id));
  if (
    value.version !== SNAPSHOT_VERSION
    || value.assignmentId !== assignmentId
    || value.rubricIdentity !== evaluationRubricIdentity(criteria)
    || typeof value.savedAt !== "number"
    || !Number.isFinite(value.savedAt)
    || value.savedAt > now
    || now - value.savedAt > EVALUATION_DRAFT_MAX_AGE_MS
    || typeof value.evidence !== "string"
    || value.evidence.length > MAX_EVIDENCE_LENGTH
    || !Array.isArray(value.ratings)
    || value.ratings.length !== expectedIds.size
  ) {
    return removeInvalidSnapshot(storage, key);
  }

  const scores: Record<string, string> = {};
  const notes: Record<string, string> = {};
  const seenIds = new Set<string>();
  for (const rating of value.ratings) {
    if (
      !isPlainObject(rating)
      || Object.keys(rating).length !== RATING_KEYS.size
      || !Object.keys(rating).every((entry) => RATING_KEYS.has(entry))
    ) return removeInvalidSnapshot(storage, key);
    const { criterionId, score, note } = rating;
    if (
      typeof criterionId !== "string"
      || !expectedIds.has(criterionId)
      || seenIds.has(criterionId)
      || typeof score !== "string"
      || !VALID_SCORES.has(score)
      || typeof note !== "string"
      || note.length > MAX_NOTE_LENGTH
    ) {
      return removeInvalidSnapshot(storage, key);
    }
    seenIds.add(criterionId);
    scores[criterionId] = score;
    if (note) notes[criterionId] = note;
  }

  return { scores, notes, evidence: value.evidence };
}

export function writeEvaluationDraft({
  storage,
  assignmentId,
  criteria,
  draft,
  now = Date.now(),
}: {
  storage: DraftStorage;
  assignmentId: string;
  criteria: EvaluationDraftCriterion[];
  draft: EvaluationDraft;
  now?: number;
}) {
  const snapshot: StoredEvaluationDraft = {
    version: SNAPSHOT_VERSION,
    assignmentId,
    rubricIdentity: evaluationRubricIdentity(criteria),
    savedAt: now,
    ratings: criteria.map((criterion) => ({
      criterionId: criterion.id,
      score: draft.scores[criterion.id] ?? "",
      note: draft.notes[criterion.id] ?? "",
    })),
    evidence: draft.evidence,
  };
  const raw = JSON.stringify(snapshot);
  if (new TextEncoder().encode(raw).byteLength > EVALUATION_DRAFT_MAX_BYTES) return false;
  try {
    storage.setItem(storageKey(assignmentId), raw);
    return true;
  } catch {
    return false;
  }
}

export function clearEvaluationDraft(storage: DraftStorage, assignmentId: string) {
  try {
    storage.removeItem(storageKey(assignmentId));
  } catch {
    // A successful locked submission must not be reported as failed due to storage.
  }
}
