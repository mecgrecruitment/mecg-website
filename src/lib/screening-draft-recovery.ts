import { parseScreeningDraft, type ScreeningDraft } from "@/app/member/screening/screening-draft";

type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const key = (assignmentId: string) => `mecg:screening-draft:${assignmentId}`;

export function readScreeningBackup({ storage, assignmentId, criterionIds, now = Date.now() }: { storage: DraftStorage; assignmentId: string; criterionIds: string[]; now?: number }): ScreeningDraft | null {
  try {
    const raw: unknown = JSON.parse(storage.getItem(key(assignmentId)) ?? "null");
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const value = raw as Record<string, unknown>;
    const draft = parseScreeningDraft(value.draft);
    if (value.version !== 1 || value.assignmentId !== assignmentId || typeof value.savedAt !== "number" || !Number.isFinite(value.savedAt)
      || value.savedAt > now || now - value.savedAt > MAX_AGE_MS || !draft || draft.ratings.length !== criterionIds.length
      || draft.ratings.some(({ criterionId }) => !criterionIds.includes(criterionId))) { storage.removeItem(key(assignmentId)); return null; }
    return draft;
  } catch { return null; }
}
export function writeScreeningBackup({ storage, assignmentId, draft, now = Date.now() }: { storage: DraftStorage; assignmentId: string; draft: ScreeningDraft; now?: number }): boolean {
  try {
    const serialized = JSON.stringify({ version: 1, assignmentId, savedAt: now, draft });
    storage.setItem(key(assignmentId), serialized);
    return storage.getItem(key(assignmentId)) === serialized;
  } catch { return false; }
}
export function clearScreeningBackup(storage: DraftStorage, assignmentId: string) {
  try { storage.removeItem(key(assignmentId)); } catch {}
}
