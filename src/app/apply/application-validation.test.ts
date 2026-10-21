import assert from "node:assert/strict";
import test from "node:test";
import { applicationStepErrors, blurFieldError, stepForField, type ApplicationValidationInput } from "./application-validation";

const portfolio = { key: "portfolio", prompt: "Portfolio link", inputType: "url", required: false, options: [], maxWords: null };
const why = { key: "why", prompt: "Why MECG?", inputType: "long_text", required: true, options: [], maxWords: 150 };

const VALID: ApplicationValidationInput = {
  name: "Ada Lovelace",
  preferredName: "",
  phone: "",
  classYear: "SOPHOMORE",
  major: "Economics",
  college: "LSA",
  uniqname: "adal",
  gradTerm: "",
  linkedinUrl: "",
  accessibilityNotes: "",
  answers: { why: "Because I like hard problems.", portfolio: "" },
  questions: [why, portfolio],
  resumePath: "resumes/ada.pdf",
  resumeUploading: false,
  headshotSupported: true,
  headshotReady: true,
  headshotUploading: false,
};

test("blur shows the same message Continue shows for a malformed format field", () => {
  const cases: [string, Partial<ApplicationValidationInput>, string][] = [
    ["uniqname", { uniqname: "ada@umich.edu" }, "ada@umich.edu"],
    ["phone", { phone: "555" }, "555"],
    ["linkedinUrl", { linkedinUrl: "linkedin.com/in/ada" }, "linkedin.com/in/ada"],
    ["portfolio", { answers: { ...VALID.answers, portfolio: "my site" } }, "my site"],
  ];
  for (const [key, patch, value] of cases) {
    const input = { ...VALID, ...patch };
    const continueMessage = applicationStepErrors(stepForField(key, input.questions), input)[key];
    assert.ok(continueMessage, `${key} is invalid on Continue`);
    assert.equal(blurFieldError(key, value, input), continueMessage);
  }
});

test("blur clears the message once a format field becomes valid", () => {
  assert.equal(blurFieldError("uniqname", "adal", VALID), "");
  assert.equal(blurFieldError("linkedinUrl", "https://linkedin.com/in/ada", { ...VALID, linkedinUrl: "https://linkedin.com/in/ada" }), "");
});

test("blur leaves an untouched empty field alone even when Continue would flag it", () => {
  const input = { ...VALID, uniqname: "" };
  assert.equal(applicationStepErrors("details", input).uniqname, "Enter your uniqname.");
  assert.equal(blurFieldError("uniqname", "", input), null);
});

test("blur never validates fields outside the format set", () => {
  assert.equal(blurFieldError("name", "x".repeat(500), { ...VALID, name: "x".repeat(500) }), null);
  assert.equal(blurFieldError("why", "anything", VALID), null);
});

test("each field routes to the step that owns it", () => {
  assert.equal(stepForField("headshot", VALID.questions), "materials");
  assert.equal(stepForField("linkedinUrl", VALID.questions), "materials");
  assert.equal(stepForField("why", VALID.questions), "responses");
  assert.equal(stepForField("uniqname", VALID.questions), "details");
});

test("a complete application has no errors on any step", () => {
  for (const step of ["details", "responses", "materials"] as const) assert.deepEqual(applicationStepErrors(step, VALID), {});
});

test("question URL validation rejects whitespace before the database does", () => {
  const input = { ...VALID, answers: { ...VALID.answers, portfolio: "https://example.com/my work" } };
  assert.equal(applicationStepErrors("responses", input).portfolio, "Enter a complete http or https URL.");
});
