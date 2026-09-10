import test from "node:test";
import assert from "node:assert/strict";
import {
  APPLICATION_FIELD_LIMITS,
  canTransitionApplication,
  canTransitionCycle,
  canTransitionRound,
  countWords,
  hasExactCriterionSet,
  isPipelineStatus,
  isValidOptionalPhone,
  isValidOptionalUrl,
  isValidUniqname,
  legalManualApplicationStatuses,
  normalizePersonInput,
  parseApplicationDraft,
  parseApplicationIntake,
} from "./workflow.ts";

test("word counts match the application limit definition", () => {
  assert.equal(countWords(""), 0);
  assert.equal(countWords("  one\n two\tthree  "), 3);
  assert.equal(countWords("hyphenated-word"), 1);
});

test("application field limits are the parser contract", () => {
  assert.equal(parseApplicationDraft({ name: "x".repeat(APPLICATION_FIELD_LIMITS.name + 1) })?.name.length, APPLICATION_FIELD_LIMITS.name);
  assert.equal(parseApplicationIntake({ ...validIntake, name: "x".repeat(APPLICATION_FIELD_LIMITS.name + 1) }, "ada@umich.edu"), null);
});

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

test("a finalized round can be archived, matching rush.set_round_status", () => {
  assert.equal(canTransitionRound("FINALIZED", "ARCHIVED"), true);
  assert.equal(canTransitionRound("ARCHIVED", "FINALIZED"), false);
  assert.equal(canTransitionRound("ARCHIVED", "ARCHIVED"), true);
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

// These cases are the ones that reached production and were refused by
// submit_application after the applicant had filled in the whole form, with only
// a generic "Could not submit application" to go on. The rule here must stay
// identical to the SQL: `^[a-z][a-z0-9]{1,15}$` on lower(trim(uniqname)).
test("uniqname accepts what the database accepts", () => {
  for (const good of ["jsmith", "ab", "a1", "j2smith", "abcdefghijklmnop"]) {
    assert.equal(isValidUniqname(good), true, good);
  }
  assert.equal(isValidUniqname("  JSmith  "), true, "trimmed and lowercased");
});

test("uniqname rejects what the database rejects, before the applicant submits", () => {
  for (const bad of [
    "j",                       // too short
    "abcdefghijklmnopq",       // 17 chars
    "j.smith",                 // punctuation
    "jo-smith",
    "j_smith",
    "jsmith@umich.edu",        // the whole email
    "2smith",                  // leading digit
    "jsmith ",                 // trailing space is trimmed, so this one passes
    "",
  ]) {
    if (bad === "jsmith ") { assert.equal(isValidUniqname(bad), true); continue; }
    assert.equal(isValidUniqname(bad), false, bad);
  }
});

// Same failure shape as the uniqname rule: the database refused these at the
// final step while the form and the parser accepted them, and mapRpcError told
// the applicant only "Could not submit application".
test("phone matches submit_application: blank, or 7 to 32 characters", () => {
  for (const good of ["", "   ", "5551234", "+1 (555) 123-4567"]) {
    assert.equal(isValidOptionalPhone(good), true, JSON.stringify(good));
  }
  for (const bad of ["12345", "555-12", "1".repeat(33)]) {
    assert.equal(isValidOptionalPhone(bad), false, bad);
  }
});

test("linkedin matches submit_application, including the whitespace the URL parser hid", () => {
  for (const good of ["", "https://linkedin.com/in/ab", "http://x.example"]) {
    assert.equal(isValidOptionalUrl(good), true, JSON.stringify(good));
  }
  for (const bad of [
    "https://linkedin.com/in/a b", // new URL() encodes the space and accepted this
    "linkedin.com/in/ab",         // no scheme
    "ftp://example.com",
    "https://" + "a".repeat(400),  // over 400
  ]) {
    assert.equal(isValidOptionalUrl(bad), false, bad);
  }
});
