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
  FINALIZED: [],
};

export function canTransitionCycle(from: string, to: string) {
  return from === to || (CYCLE_TRANSITIONS[from]?.includes(to) ?? false);
}

export function canTransitionRound(from: string, to: string) {
  return from === to || (ROUND_TRANSITIONS[from]?.includes(to) ?? false);
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

export function parseApplicationIntake(body: unknown, email: string) {
  if (!body || typeof body !== "object") return null;
  const input = body as Record<string, unknown>;
  const person = normalizePersonInput(input.name, email);
  if (!person || input.consent !== true) return null;
  const preferredName = optionalText(input.preferredName, 80);
  const phone = optionalText(input.phone, 32);
  const major = optionalText(input.major, 120);
  const linkedinUrl = optionalText(input.linkedinUrl, 400);
  const resumeStoragePath = optionalText(input.resumeStoragePath, 240);
  const uniqname = optionalText(input.uniqname, 16);
  const college = optionalText(input.college, 80);
  const gradTerm = optionalText(input.gradTerm, 40);
  const accessibilityNotes = optionalText(input.accessibilityNotes, 2000);
  if ([preferredName, phone, major, linkedinUrl, resumeStoragePath, uniqname, college, gradTerm, accessibilityNotes].includes(undefined)) return null;
  const classYear =
    input.classYear == null || input.classYear === ""
      ? null
      : CLASS_YEARS.includes(input.classYear as ClassYear)
        ? (input.classYear as ClassYear)
        : undefined;
  if (classYear === undefined) return null;
  if (!resumeStoragePath) return null;
  const answers =
    input.answers && typeof input.answers === "object" && !Array.isArray(input.answers)
      ? Object.fromEntries(
          Object.entries(input.answers as Record<string, unknown>).map(([key, value]) => [
            key,
            typeof value === "string" ? value.trim() : "",
          ]),
        )
      : {};
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

export function hasExactCriterionSet(
  expectedIds: string[],
  submittedIds: string[],
) {
  if (expectedIds.length !== submittedIds.length) return false;
  const submitted = new Set(submittedIds);
  return submitted.size === expectedIds.length && expectedIds.every((id) => submitted.has(id));
}
