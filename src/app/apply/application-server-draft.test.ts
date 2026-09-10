import assert from "node:assert/strict";
import test from "node:test";
import {
  browserRecoveryIsNewer,
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
  const parsed = parseApplicationServerDraft({
    ...valid,
    savedAt: "2026-09-02T12:00:00.000Z",
    serverNow: "2026-09-02T12:01:00.000Z",
  });
  assert.equal(parsed?.currentStep, "responses");
  assert.equal(parsed?.savedAt, "2026-09-02T12:00:00.000Z");
  assert.equal(parsed?.serverNow, "2026-09-02T12:01:00.000Z");
  assert.equal(parsed?.answers.motivation, "Build useful things.");
  assert.equal("consent" in (parsed ?? {}), false);
});

test("defaults legacy drafts to details but rejects unknown, oversized, or unsafe fields", () => {
  assert.equal(parseApplicationServerDraft({ ...valid, currentStep: undefined })?.currentStep, "details");
  assert.equal(parseApplicationServerDraft({ ...valid, currentStep: "unknown" }), null);
  assert.equal(parseApplicationServerDraft({ ...valid, savedAt: "not-a-date" }), null);
  assert.equal(parseApplicationServerDraft({ ...valid, serverNow: "not-a-date" }), null);
  assert.equal(parseApplicationServerDraft({ ...valid, consent: true }), null);
  assert.equal(parseApplicationServerDraft({ ...valid, injected: "value" }), null);
  assert.equal(parseApplicationServerDraft({ ...valid, name: "x".repeat(121) }), null);
  assert.equal(parseApplicationServerDraft({ ...valid, answers: { motivation: "x".repeat(8001) } }), null);
});

test("browser recovery compares elapsed ages instead of unrelated wall clocks", () => {
  const server = {
    savedAt: "2026-09-02T12:00:00.000Z",
    serverNow: "2026-09-02T12:10:00.000Z",
  };
  assert.equal(browserRecoveryIsNewer(
    Date.parse("2026-09-02T17:09:00.000Z"),
    server,
    Date.parse("2026-09-02T17:10:00.000Z"),
  ), true);
  assert.equal(browserRecoveryIsNewer(
    Date.parse("2026-09-02T06:59:00.000Z"),
    server,
    Date.parse("2026-09-02T07:10:00.000Z"),
  ), false);
  assert.equal(browserRecoveryIsNewer(Date.now(), { savedAt: server.savedAt }), false);
  assert.equal(browserRecoveryIsNewer(Date.now(), null), true);
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
