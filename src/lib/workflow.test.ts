import test from "node:test";
import assert from "node:assert/strict";
import {
  canTransitionApplication,
  canTransitionCycle,
  canTransitionRound,
  hasExactCriterionSet,
  isPipelineStatus,
  legalManualApplicationStatuses,
  normalizePersonInput,
  parseApplicationDraft,
  parseApplicationIntake,
} from "./workflow.ts";

const validIntake = {
  name: "Ada Lovelace",
  consent: true,
  classYear: "JUNIOR",
  major: "ME",
  uniqname: "adal",
  college: "Engineering",
  resumeStoragePath: "11111111-1111-1111-1111-111111111111/cycle/22222222-2222-2222-2222-222222222222.pdf",
  answers: { why_mecg: "Projects" },
};

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

test("application transitions expose only legal manual next statuses", () => {
  assert.equal(canTransitionApplication("SUBMITTED", "NEEDS_INFO"), true);
  assert.equal(canTransitionApplication("SUBMITTED", "ELIGIBLE"), true);
  assert.equal(canTransitionApplication("SUBMITTED", "IN_PROCESS"), false);
  assert.equal(canTransitionApplication("FINAL_REVIEW", "OFFERED"), false);
  assert.equal(canTransitionApplication("ELIGIBLE", "ELIGIBLE"), true);
  assert.deepEqual(legalManualApplicationStatuses("INVITED"), ["INVITED", "IN_PROCESS"]);
  assert.deepEqual(legalManualApplicationStatuses("OFFERED"), ["OFFERED"]);
});

test("pipeline status excludes application drafts", () => {
  assert.equal(isPipelineStatus("SUBMITTED"), true);
  assert.equal(isPipelineStatus("WITHDRAWN"), true);
  assert.equal(isPipelineStatus("DRAFT"), false);
  assert.equal(isPipelineStatus("UNKNOWN"), false);
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

test("application intake requires consent, profile fields, and a resume path", () => {
  const parsed = parseApplicationIntake(validIntake, "ada@umich.edu");
  assert.equal(parsed?.major, "ME");
  assert.equal(parseApplicationIntake({ ...validIntake, consent: false }, "ada@umich.edu"), null);
  assert.equal(parseApplicationIntake({ ...validIntake, resumeStoragePath: undefined }, "ada@umich.edu"), null);
  assert.equal(parseApplicationIntake({ ...validIntake, college: "Unknown College" }, "ada@umich.edu"), null);
});

test("application intake accepts only http and https LinkedIn URLs", () => {
  assert.ok(parseApplicationIntake({ ...validIntake, linkedinUrl: "https://linkedin.com/in/ada" }, "ada@umich.edu"));
  assert.ok(parseApplicationIntake({ ...validIntake, linkedinUrl: "http://linkedin.com/in/ada" }, "ada@umich.edu"));
  assert.equal(parseApplicationIntake({ ...validIntake, linkedinUrl: "linkedin.com/in/ada" }, "ada@umich.edu"), null);
  assert.equal(parseApplicationIntake({ ...validIntake, linkedinUrl: "javascript:alert(1)" }, "ada@umich.edu"), null);
});

test("application intake rejects invalid or oversized answer maps", () => {
  assert.equal(parseApplicationIntake({ ...validIntake, answers: { "Bad key": "x" } }, "ada@umich.edu"), null);
  assert.equal(parseApplicationIntake({ ...validIntake, answers: { valid: 42 } }, "ada@umich.edu"), null);
  assert.equal(parseApplicationIntake({ ...validIntake, answers: { valid: "x".repeat(8001) } }, "ada@umich.edu"), null);
  assert.equal(parseApplicationIntake({ ...validIntake, answers: Object.fromEntries(Array.from({ length: 51 }, (_, index) => [`q${index}`, "x"])) }, "ada@umich.edu"), null);
  assert.equal(parseApplicationIntake({ ...validIntake, answers: Object.fromEntries(Array.from({ length: 6 }, (_, index) => [`q${index}`, "x".repeat(7000)])) }, "ada@umich.edu"), null);
  assert.equal(parseApplicationIntake({ ...validIntake, answers: { [`q${"x".repeat(80)}`]: "x" } }, "ada@umich.edu"), null);
  // An empty map used to pass: parseAnswers returned {}, which is truthy, so an
  // application with zero written responses reached the board with no error.
  assert.equal(parseApplicationIntake({ ...validIntake, answers: {} }, "ada@umich.edu"), null);
});

test("application drafts restore safe fields and ignore malformed values", () => {
  assert.deepEqual(
    parseApplicationDraft({
      name: "Ada Lovelace",
      classYear: "JUNIOR",
      major: "Mechanical Engineering",
      answers: { why_mecg: "Client work", invalid: 42, "bad key": "discard" },
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

test("application drafts truncate answer count, item length, and total length", () => {
  const answers = Object.fromEntries(Array.from({ length: 60 }, (_, index) => [`q${index}`, "x".repeat(9000)]));
  const restored = parseApplicationDraft({ answers })?.answers ?? {};
  assert.equal(Object.keys(restored).length, 5);
  assert.equal(restored.q0.length, 8000);
  assert.equal(Object.values(restored).reduce((total, answer) => total + answer.length, 0), 40000);
});
