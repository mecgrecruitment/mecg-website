import { APPLICATION_FIELD_LIMITS, countWords, isValidOptionalPhone, isValidOptionalUrl, isValidUniqname } from "@/lib/workflow";
import type { ApplicationStep } from "./application-server-draft";

export type IntakeQuestion = { key: string; prompt: string; inputType: string; required: boolean; options: string[]; maxWords: number | null };

export type ApplicationValidationInput = {
  name: string;
  preferredName: string;
  phone: string;
  classYear: string;
  major: string;
  college: string;
  uniqname: string;
  gradTerm: string;
  linkedinUrl: string;
  accessibilityNotes: string;
  answers: Record<string, string>;
  questions: IntakeQuestion[];
  resumePath: string;
  resumeUploading: boolean;
  headshotSupported: boolean;
  headshotReady: boolean;
  headshotUploading: boolean;
};

const MATERIALS_FIELDS = new Set(["resume", "headshot", "linkedinUrl", "accessibilityNotes"]);
const BLUR_FIELDS = new Set(["uniqname", "phone", "linkedinUrl"]);

function isHttpUrl(value: string) {
  const trimmed = value.trim();
  if (/\s/.test(trimmed) || !/^https?:\/\//i.test(trimmed)) return false;
  try {
    const url = new URL(trimmed);
    return ["http:", "https:"].includes(url.protocol) && Boolean(url.hostname);
  } catch {
    return false;
  }
}

export function applicationStepErrors(target: ApplicationStep, input: ApplicationValidationInput) {
  const { name, preferredName, phone, classYear, major, college, uniqname, gradTerm, linkedinUrl, accessibilityNotes, answers, questions } = input;
  const next: Record<string, string> = {};
  if (target === "details") {
    if (!name.trim()) next.name = "Enter your full name.";
    else if (name.length > APPLICATION_FIELD_LIMITS.name) next.name = `Shorten your full name to ${APPLICATION_FIELD_LIMITS.name} characters or fewer.`;
    if (preferredName.length > APPLICATION_FIELD_LIMITS.preferredName) next.preferredName = `Shorten your preferred name to ${APPLICATION_FIELD_LIMITS.preferredName} characters or fewer.`;
    if (!classYear) next.classYear = "Select your year.";
    if (!uniqname.trim()) next.uniqname = "Enter your uniqname.";
    else if (!isValidUniqname(uniqname)) next.uniqname = "A uniqname is letters and numbers only, starting with a letter (for example: jsmith). Do not include @umich.edu.";
    if (!isValidOptionalPhone(phone)) next.phone = "Enter a phone number between 7 and 32 characters, or leave it blank.";
    if (!college) next.college = "Select your college.";
    if (!major.trim()) next.major = "Enter your major.";
    else if (major.length > APPLICATION_FIELD_LIMITS.major) next.major = `Shorten your major to ${APPLICATION_FIELD_LIMITS.major} characters or fewer.`;
    if (gradTerm.length > APPLICATION_FIELD_LIMITS.gradTerm) next.gradTerm = `Shorten your graduation term to ${APPLICATION_FIELD_LIMITS.gradTerm} characters or fewer.`;
  }
  if (target === "responses") {
    for (const question of questions) {
      const answer = answers[question.key]?.trim() ?? "";
      if (question.required && !answer) next[question.key] = "Write a response before continuing.";
      else if (answer.length > APPLICATION_FIELD_LIMITS.answer) next[question.key] = `Shorten this response to ${APPLICATION_FIELD_LIMITS.answer} characters or fewer.`;
      else if (question.maxWords && countWords(answer) > question.maxWords) next[question.key] = `Shorten this response to ${question.maxWords} words or fewer.`;
      else if (question.inputType === "select" && answer && !question.options.includes(answer)) next[question.key] = "Select one of the available options.";
      else if (question.inputType === "url" && answer && !isHttpUrl(answer)) next[question.key] = "Enter a complete http or https URL.";
    }
  }
  if (target === "materials") {
    if (input.resumeUploading || !input.resumePath) next.resume = input.resumeUploading ? "Wait for your resume upload to finish." : "Upload your resume before continuing.";
    if (!isValidOptionalUrl(linkedinUrl)) next.linkedinUrl = "Enter a full link starting with https:// and no spaces, or leave it blank.";
    // headshotSupported is false only when the photo RPCs are not deployed yet.
    // Requiring a photo the backend cannot accept would block every submission.
    if (input.headshotSupported && !input.headshotReady) next.headshot = input.headshotUploading ? "Wait for your photo upload to finish." : "Upload a photo of yourself before continuing.";
    if (accessibilityNotes.length > APPLICATION_FIELD_LIMITS.accessibilityNotes) next.accessibilityNotes = `Shorten these notes to ${APPLICATION_FIELD_LIMITS.accessibilityNotes} characters or fewer.`;
  }
  return next;
}

export function stepForField(key: string, questions: IntakeQuestion[]): ApplicationStep {
  if (MATERIALS_FIELDS.has(key)) return "materials";
  return questions.some((question) => question.key === key) ? "responses" : "details";
}

// Blur checks only format fields the applicant has typed into, so tabbing past an empty
// required field never scolds them. The message is the one Continue would show.
export function blurFieldError(key: string, value: string, input: ApplicationValidationInput): string | null {
  const isUrlAnswer = input.questions.some((question) => question.key === key && question.inputType === "url");
  if (!BLUR_FIELDS.has(key) && !isUrlAnswer) return null;
  if (!value.trim()) return null;
  return applicationStepErrors(stepForField(key, input.questions), input)[key] ?? "";
}
