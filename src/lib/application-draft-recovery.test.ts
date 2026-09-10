import assert from "node:assert/strict";
import test from "node:test";
import {
  clearApplicationDraftRecovery,
  createApplicationDraftRecoveryScope,
  loadApplicationDraftRecovery,
  loadApplicationDraftRecoverySnapshot,
  saveApplicationDraftRecovery,
  type ApplicationDraftRecovery,
} from "./application-draft-recovery.ts";

class MemoryStorage {
  value: string | null = null;
  getItem() { return this.value; }
  setItem(_key: string, value: string) { this.value = value; }
  removeItem() { this.value = null; }
}

const questions = [
  { key: "motivation", prompt: "Why MECG?", inputType: "long_text", required: true, options: [], maxWords: 300 },
  { key: "track", prompt: "Choose a track", inputType: "select", required: false, options: ["Climate", "Mobility"], maxWords: null },
];
const scope = createApplicationDraftRecoveryScope({ userIdentity: "Applicant@umich.edu", cycleIdentity: "Fall 2026", questions });
const draft: ApplicationDraftRecovery = {
  name: "Ada Lovelace",
  preferredName: "Ada",
  phone: "734-555-0100",
  classYear: "JUNIOR",
  major: "Computer Science",
  college: "Engineering",
  uniqname: "ada",
  gradTerm: "Winter 2028",
  accessibilityNotes: "Please provide captions.",
  linkedinUrl: "https://linkedin.com/in/ada",
  answers: { motivation: "Preserve my exact text.  ", track: "Climate" },
};

test("restores safe draft fields for the same user, cycle, and schema", () => {
  const storage = new MemoryStorage();
  assert.equal(saveApplicationDraftRecovery(storage, scope, draft, 1_000), true);
  assert.deepEqual(loadApplicationDraftRecovery(storage, scope, 2_000), draft);
  assert.equal(scope.userIdentity, "applicant@umich.edu");
  assert.deepEqual(loadApplicationDraftRecoverySnapshot(storage, scope, 2_000), { draft, savedAt: 1_000 });
});

test("never serializes a resume path or consent", () => {
  const storage = new MemoryStorage();
  const unsafeInput = { ...draft, resumeStoragePath: "private/resume.pdf", consent: true };
  assert.equal(saveApplicationDraftRecovery(storage, scope, unsafeInput, 1_000), true);
  assert.doesNotMatch(storage.value ?? "", /resumeStoragePath|private\/resume\.pdf|consent/);
});

test("rejects and removes malformed recovery data", () => {
  const storage = new MemoryStorage();
  storage.value = "{not-json";
  assert.equal(loadApplicationDraftRecovery(storage, scope, 2_000), null);
  assert.equal(storage.value, null);
});

test("rejects stale, future, wrong-user, wrong-cycle, and wrong-schema snapshots", () => {
  const variants = [
    { expected: scope, savedAt: 1, now: 24 * 60 * 60 * 1000 + 2 },
    { expected: scope, savedAt: 3_000, now: 2_000 },
    { expected: { ...scope, userIdentity: "other@umich.edu" }, savedAt: 1_000, now: 2_000 },
    { expected: { ...scope, cycleIdentity: "Winter 2027" }, savedAt: 1_000, now: 2_000 },
    { expected: createApplicationDraftRecoveryScope({ userIdentity: "Applicant@umich.edu", cycleIdentity: "Fall 2026", questions: [{ ...questions[0], prompt: "Why this organization?" }, questions[1]] }), savedAt: 1_000, now: 2_000 },
  ];
  for (const { expected, savedAt, now } of variants) {
    const storage = new MemoryStorage();
    saveApplicationDraftRecovery(storage, scope, draft, savedAt);
    assert.equal(loadApplicationDraftRecovery(storage, expected, now), null);
    assert.equal(storage.value, null);
  }
});

test("rejects oversized snapshots without writing them", () => {
  const storage = new MemoryStorage();
  const oversized = { ...draft, answers: Object.fromEntries(Array.from({ length: 6 }, (_, index) => [`answer_${index}`, "x".repeat(8000)])) };
  assert.equal(saveApplicationDraftRecovery(storage, scope, oversized), false);
  assert.equal(storage.value, null);

  storage.value = `{"padding":"${"x".repeat(100_000)}"}`;
  assert.equal(loadApplicationDraftRecovery(storage, scope), null);
  assert.equal(storage.value, null);
});

test("clear removes a saved recovery snapshot", () => {
  const storage = new MemoryStorage();
  saveApplicationDraftRecovery(storage, scope, draft);
  clearApplicationDraftRecovery(storage);
  assert.equal(storage.value, null);
});
