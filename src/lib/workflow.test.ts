import test from "node:test";
import assert from "node:assert/strict";
import {
  canTransitionCycle,
  canTransitionRound,
  hasExactCriterionSet,
  normalizePersonInput,
  parseApplicationDraft,
  parseApplicationIntake,
} from "./workflow.ts";

test("cycle transitions move forward one state and allow idempotent writes", () => {
  assert.equal(canTransitionCycle("DRAFT", "OPEN"), true);
  assert.equal(canTransitionCycle("OPEN", "OPEN"), true);
  assert.equal(canTransitionCycle("OPEN", "CLOSED"), false);
  assert.equal(canTransitionCycle("CLOSED", "OPEN"), false);
});

test("round transitions cannot skip or reopen states", () => {
  assert.equal(canTransitionRound("PUBLISHED", "ACTIVE"), true);
  assert.equal(canTransitionRound("ACTIVE", "FINALIZED"), false);
  assert.equal(canTransitionRound("FROZEN", "ACTIVE"), false);
});

test("criterion submission requires each expected criterion exactly once", () => {
  assert.equal(hasExactCriterionSet(["a", "b"], ["a", "b"]), true);
  assert.equal(hasExactCriterionSet(["a", "b"], ["a", "a"]), false);
  assert.equal(hasExactCriterionSet(["a", "b"], ["a"]), false);
});

test("person input is normalized and bounded", () => {
  assert.deepEqual(normalizePersonInput("  Ada  ", " ADA@EXAMPLE.COM "), {
    name: "Ada",
    contact: "ada@example.com",
  });
  assert.equal(normalizePersonInput("", "ada@example.com"), null);
  assert.equal(normalizePersonInput("A".repeat(121), "ada@example.com"), null);
});

test("application intake requires consent, name, and a resume path", () => {
  const parsed = parseApplicationIntake(
    {
      name: "Ada Lovelace",
      consent: true,
      classYear: "JUNIOR",
      major: "ME",
      resumeStoragePath: "11111111-1111-1111-1111-111111111111/cycle/22222222-2222-2222-2222-222222222222.pdf",
      answers: { why_mecg: "Projects" },
    },
    "ada@umich.edu",
  );
  assert.equal(parsed?.major, "ME");
  assert.equal(parseApplicationIntake({ name: "Ada", consent: false, resumeStoragePath: "a/b/c.pdf" }, "ada@umich.edu"), null);
  assert.equal(parseApplicationIntake({ name: "Ada", consent: true }, "ada@umich.edu"), null);
});

test("application drafts restore safe fields and ignore malformed values", () => {
  assert.deepEqual(
    parseApplicationDraft({
      name: "Ada Lovelace",
      classYear: "JUNIOR",
      major: "Mechanical Engineering",
      answers: { why_mecg: "Client work", invalid: 42 },
      resumeStoragePath: "user/cycle/resume.pdf",
    }),
    {
      name: "Ada Lovelace",
      preferredName: "",
      phone: "",
      classYear: "JUNIOR",
      major: "Mechanical Engineering",
      college: "",
      uniqname: "",
      gradTerm: "",
      accessibilityNotes: "",
      linkedinUrl: "",
      answers: { why_mecg: "Client work" },
      resumeStoragePath: "user/cycle/resume.pdf",
    },
  );
  assert.equal(parseApplicationDraft(null), null);
  assert.equal(parseApplicationDraft([]), null);
});
