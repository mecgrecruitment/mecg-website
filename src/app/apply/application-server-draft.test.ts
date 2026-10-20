import assert from "node:assert/strict";
import test from "node:test";
import {
  clearApplicationStepRecovery,
  loadApplicationStepRecovery,
  parseApplicationServerDraft,
  saveApplicationStepRecovery,
} from "./application-server-draft";

const valid = {
  name: "Ada Lovelace",
  preferredName: "Ada",
  phone: "",
  classYear: "JUNIOR",
  major: "Computer Science",
  college: "Engineering",
  uniqname: "ada",
  gradTerm: "Winter 2028",
  accessibilityNotes: "",
  linkedinUrl: "",
  answers: { motivation: "Build useful things." },
  resumeStoragePath: "",
  currentStep: "responses",
  consent: false,
};

test("parses the allowed application draft and preserves its exact step", () => {
  const parsed = parseApplicationServerDraft(valid);
  assert.equal(parsed?.currentStep, "responses");
  assert.equal(parsed?.answers.motivation, "Build useful things.");
  assert.equal("consent" in (parsed ?? {}), false);
});

test("defaults legacy drafts to details but rejects unknown, oversized, or unsafe fields", () => {
  assert.equal(parseApplicationServerDraft({ ...valid, currentStep: undefined })?.currentStep, "details");
  assert.equal(parseApplicationServerDraft({ ...valid, currentStep: "unknown" }), null);
  assert.equal(parseApplicationServerDraft({ ...valid, savedAt: "2026-09-02T12:00:00.000Z" }), null);
  assert.equal(parseApplicationServerDraft({ ...valid, consent: true }), null);
  assert.equal(parseApplicationServerDraft({ ...valid, injected: "value" }), null);
  assert.equal(parseApplicationServerDraft({ ...valid, name: "x".repeat(121) }), null);
  assert.equal(parseApplicationServerDraft({ ...valid, answers: { motivation: "x".repeat(8001) } }), null);
});

test("step recovery is scoped and clearable", () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
  const scope = { userIdentity: "u1", cycleIdentity: "c1", schemaIdentity: "s1" };
  assert.equal(saveApplicationStepRecovery(storage, scope, "materials"), true);
  assert.equal(loadApplicationStepRecovery(storage, scope), "materials");
  assert.equal(loadApplicationStepRecovery(storage, { ...scope, userIdentity: "u2" }), null);
  clearApplicationStepRecovery(storage);
  assert.equal(loadApplicationStepRecovery(storage, scope), null);
});

test("revision boundaries reject legacy acknowledgements, missing preconditions and malformed snapshots", async () => {
  const { parseApplicationDraftSaveRequest, parseApplicationDraftSaveResult, parseApplicationDraftSnapshot } = await import("./application-server-draft");
  const revision = "10000000-0000-4000-8000-000000000001";
  assert.equal(parseApplicationDraftSaveResult({ ok: true }), null);
  assert.equal(parseApplicationDraftSaveResult({ kind: "saved", revision: "yesterday" }), null);
  assert.deepEqual(parseApplicationDraftSaveResult({ kind: "saved", revision }), { kind: "saved", revision });
  assert.equal(parseApplicationDraftSaveRequest(valid), null);
  assert.equal(parseApplicationDraftSaveRequest({ draft: valid, mutationId: revision, cycleId: "cycle" }), null);
  assert.ok(parseApplicationDraftSaveRequest({ draft: valid, expectedRevision: null, mutationId: revision, cycleId: "cycle" }));
  assert.equal(parseApplicationDraftSnapshot({ ...valid, revision: "2026-10-16" }), null);
  assert.equal(parseApplicationDraftSnapshot({ ...valid, revision })?.revision, revision);
  assert.equal(parseApplicationDraftSaveResult({ kind: "conflict", draft: { ...valid } }), null);
  assert.deepEqual(parseApplicationDraftSaveResult({ kind: "conflict", draft: null }), { kind: "conflict", snapshot: null });
});
