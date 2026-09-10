const CYCLE_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["OPEN"],
  OPEN: ["IN_PROCESS"],
  IN_PROCESS: ["DECISION_LOCK"],
  DECISION_LOCK: ["CLOSED"],
  CLOSED: ["ARCHIVED"],
  ARCHIVED: [],
};

const ROUND_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["PUBLISHED"],
  PUBLISHED: ["ACTIVE"],
  ACTIVE: ["FROZEN"],
  FROZEN: ["FINALIZED"],
  FINALIZED: ["ARCHIVED"],
  ARCHIVED: [],
};

const APPLICATION_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["SUBMITTED"],
  SUBMITTED: ["NEEDS_INFO", "ELIGIBLE"],
  NEEDS_INFO: ["SUBMITTED", "ELIGIBLE"],
  ELIGIBLE: ["INVITED"],
  INVITED: ["IN_PROCESS"],
  IN_PROCESS: ["FINAL_REVIEW"],
  FINAL_REVIEW: [],
  OFFERED: [],
  WAITLISTED: [],
  REJECTED: [],
  WITHDRAWN: [],
};

export function canTransitionCycle(from: string, to: string) {
  return from === to || (CYCLE_TRANSITIONS[from]?.includes(to) ?? false);
}

export function canTransitionRound(from: string, to: string) {
  return from === to || (ROUND_TRANSITIONS[from]?.includes(to) ?? false);
}

export function canTransitionApplication(from: string, to: string) {
  return from === to || (APPLICATION_TRANSITIONS[from]?.includes(to) ?? false);
}

export function legalManualApplicationStatuses(status: string) {
  return [status, ...(APPLICATION_TRANSITIONS[status] ?? [])];
}

export const CLASS_YEARS = ["FIRST_YEAR", "SOPHOMORE", "JUNIOR", "SENIOR", "GRADUATE"] as const;
export type ClassYear = (typeof CLASS_YEARS)[number];

export const CLASS_YEAR_LABELS: Record<ClassYear, string> = {
  FIRST_YEAR: "First-year",
  SOPHOMORE: "Sophomore",
  JUNIOR: "Junior",
  SENIOR: "Senior",
  GRADUATE: "Graduate",
};

export const COLLEGES = [
  "Engineering",
  "LSA",
  "Ross",
  "Information",
  "Stamps",
  "Kinesiology",
  "Nursing",
  "Public Policy",
  "Other",
] as const;

export const EVENT_KINDS = [
  ["MIXER", "Meet members"],
  ["MASS_MEETING", "Mass meeting"],
  ["OFFICE_HOURS", "Office hours"],
  ["SPEED_DATING", "Speed Dating (evaluated)"],
  ["GROUP_CASE", "Group Case"],
  ["SOCIAL", "Social / service"],
  ["GENERAL", "Other"],
] as const;

export const PIPELINE_STATUSES = [
  "SUBMITTED",
  "NEEDS_INFO",
  "ELIGIBLE",
  "INVITED",
  "IN_PROCESS",
  "FINAL_REVIEW",
  "OFFERED",
  "WAITLISTED",
  "REJECTED",
  "WITHDRAWN",
] as const;

export type PipelineStatus = (typeof PIPELINE_STATUSES)[number];

export function isPipelineStatus(status: string): status is PipelineStatus {
  return PIPELINE_STATUSES.some((pipelineStatus) => pipelineStatus === status);
}

export const DECIDED_PIPELINE_STATUSES: ReadonlySet<PipelineStatus> = new Set(["OFFERED", "WAITLISTED", "REJECTED", "WITHDRAWN"]);

const ANSWER_KEY = /^[a-z][a-z0-9_]*$/;
const MAX_ANSWER_KEY_LENGTH = 80;
const MAX_ANSWERS = 50;
const MAX_ANSWER_LENGTH = 8000;
const MAX_ANSWERS_LENGTH = 40000;

export const APPLICATION_FIELD_LIMITS = {
  name: 120,
  preferredName: 80,
  phone: 32,
  classYear: 20,
  major: 120,
  college: 80,
  uniqname: 16,
  gradTerm: 40,
  accessibilityNotes: 2000,
  linkedinUrl: 400,
  resumeStoragePath: 240,
  answer: MAX_ANSWER_LENGTH,
} as const;

export function countWords(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

export function normalizePersonInput(nameValue: unknown, contactValue: unknown) {
  const name = typeof nameValue === "string" ? nameValue.trim() : "";
  const contact = typeof contactValue === "string" ? contactValue.trim().toLowerCase() : "";
  if (!name || name.length > 120 || !contact || contact.length > 254) return null;
  return { name, contact };
}

function optionalText(value: unknown, max: number) {
  if (value == null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  if (!text) return null;
  if (text.length > max) return undefined;
  return text;
}

function validUrl(value: string | null) {
  return isValidOptionalUrl(value ?? "");
}

function parseAnswers(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0 || entries.length > MAX_ANSWERS) return null;
  let total = 0;
  const answers: Record<string, string> = {};
  for (const [key, value] of entries) {
    if (key.length > MAX_ANSWER_KEY_LENGTH || !ANSWER_KEY.test(key) || typeof value !== "string") return null;
    const answer = value.trim();
    total += answer.length;
    if (answer.length > MAX_ANSWER_LENGTH || total > MAX_ANSWERS_LENGTH) return null;
    answers[key] = answer;
  }
  return answers;
}

function restoreAnswers(raw: unknown) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const answers: Record<string, string> = {};
  let total = 0;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (Object.keys(answers).length >= MAX_ANSWERS || key.length > MAX_ANSWER_KEY_LENGTH || !ANSWER_KEY.test(key) || typeof value !== "string") continue;
    const answer = value.slice(0, Math.min(MAX_ANSWER_LENGTH, MAX_ANSWERS_LENGTH - total));
    answers[key] = answer;
    total += answer.length;
    if (total === MAX_ANSWERS_LENGTH) break;
  }
  return answers;
}

// submit_application enforces `^[a-z][a-z0-9]{1,15}$` on lower(trim(uniqname)).
// The form used to check only that the field was non-empty and this parser only
// capped the length, so "j.smith", an email address, or a leading digit passed
// both and was refused by the database at the final step. mapRpcError returns a
// generic message, so the applicant was told "Could not submit application" with
// no way to know why. Keep this identical to the SQL.
export const UNIQNAME_PATTERN = /^[a-z][a-z0-9]{1,15}$/;

export function isValidUniqname(value: string): boolean {
  return UNIQNAME_PATTERN.test(value.trim().toLowerCase());
}

// submit_application requires char_length(trim(phone)) between 7 and 32 when a
// phone is given. optionalText only capped the maximum, so a short number was
// accepted here and refused by the database at the final step, the same silent
// failure the uniqname rule had. Blank stays allowed: the field is optional.
export function isValidOptionalPhone(value: string): boolean {
  const text = value.trim();
  return text.length === 0 || (text.length >= 7 && text.length <= 32);
}

// submit_application requires `^https?://[^[:space:]]+$` and length 8..400.
// new URL() silently percent-encodes an embedded space, so it accepted values
// the database then rejected.
const URL_PATTERN = /^https?:\/\/\S+$/;

export function isValidOptionalUrl(value: string): boolean {
  const text = value.trim();
  if (text.length === 0) return true;
  return text.length >= 8 && text.length <= 400 && URL_PATTERN.test(text);
}

export function parseApplicationIntake(body: unknown, email: string) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const input = body as Record<string, unknown>;
  const person = normalizePersonInput(input.name, email);
  if (!person || input.consent !== true) return null;
  const preferredName = optionalText(input.preferredName, APPLICATION_FIELD_LIMITS.preferredName);
  const phone = optionalText(input.phone, APPLICATION_FIELD_LIMITS.phone);
  const major = optionalText(input.major, APPLICATION_FIELD_LIMITS.major);
  const linkedinUrl = optionalText(input.linkedinUrl, APPLICATION_FIELD_LIMITS.linkedinUrl);
  const resumeStoragePath = optionalText(input.resumeStoragePath, APPLICATION_FIELD_LIMITS.resumeStoragePath);
  const uniqname = optionalText(input.uniqname, APPLICATION_FIELD_LIMITS.uniqname);
  const college = optionalText(input.college, APPLICATION_FIELD_LIMITS.college);
  const gradTerm = optionalText(input.gradTerm, APPLICATION_FIELD_LIMITS.gradTerm);
  const accessibilityNotes = optionalText(input.accessibilityNotes, APPLICATION_FIELD_LIMITS.accessibilityNotes);
  if ([preferredName, phone, major, linkedinUrl, resumeStoragePath, uniqname, college, gradTerm, accessibilityNotes].includes(undefined)) return null;
  if (phone !== null && phone !== undefined && !isValidOptionalPhone(phone)) return null;
  if (!major || !uniqname || !isValidUniqname(uniqname) || !college || !COLLEGES.includes(college as (typeof COLLEGES)[number]) || !validUrl(linkedinUrl ?? null)) return null;
  const classYear = CLASS_YEARS.includes(input.classYear as ClassYear) ? (input.classYear as ClassYear) : undefined;
  if (classYear === undefined || !resumeStoragePath) return null;
  const answers = parseAnswers(input.answers);
  if (!answers) return null;
  return {
    name: person.name,
    contact: person.contact,
    preferredName,
    phone,
    classYear,
    major,
    linkedinUrl,
    resumeStoragePath,
    uniqname,
    college,
    gradTerm,
    accessibilityNotes,
    answers,
    consent: true as const,
  };
}

export type ApplicationDraft = {
  name: string;
  preferredName: string;
  phone: string;
  classYear: string;
  major: string;
  college: string;
  uniqname: string;
  gradTerm: string;
  accessibilityNotes: string;
  linkedinUrl: string;
  answers: Record<string, string>;
  resumeStoragePath: string;
};

export function parseApplicationDraft(value: unknown): ApplicationDraft | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const text = (key: string, max: number) => {
    const field = input[key];
    return typeof field === "string" ? field.slice(0, max) : "";
  };

  return {
    name: text("name", APPLICATION_FIELD_LIMITS.name),
    preferredName: text("preferredName", APPLICATION_FIELD_LIMITS.preferredName),
    phone: text("phone", APPLICATION_FIELD_LIMITS.phone),
    classYear: CLASS_YEARS.includes(input.classYear as ClassYear) ? String(input.classYear) : "",
    major: text("major", APPLICATION_FIELD_LIMITS.major),
    college: COLLEGES.includes(input.college as (typeof COLLEGES)[number]) ? String(input.college) : "",
    uniqname: text("uniqname", APPLICATION_FIELD_LIMITS.uniqname),
    gradTerm: text("gradTerm", APPLICATION_FIELD_LIMITS.gradTerm),
    accessibilityNotes: text("accessibilityNotes", APPLICATION_FIELD_LIMITS.accessibilityNotes),
    linkedinUrl: text("linkedinUrl", APPLICATION_FIELD_LIMITS.linkedinUrl),
    answers: restoreAnswers(input.answers),
    resumeStoragePath: text("resumeStoragePath", APPLICATION_FIELD_LIMITS.resumeStoragePath),
  };
}

export function hasExactCriterionSet(
  expectedIds: string[],
  submittedIds: string[],
) {
  if (expectedIds.length !== submittedIds.length) return false;
  const submitted = new Set(submittedIds);
  return submitted.size === expectedIds.length && expectedIds.every((id) => submitted.has(id));
}
