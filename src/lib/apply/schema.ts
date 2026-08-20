import { z } from "zod";

// EX-51: one schema, validated client-side (inline UX) and server-side
// (authoritative — FormData actions never trust the client).

export const GRAD_YEARS = ["2026", "2027", "2028", "2029", "2030"] as const;

export const RESUME_MAX_BYTES = 10 * 1024 * 1024; // EX-55: PDF only, ≤10MB
export const RESUME_MAX_MB = RESUME_MAX_BYTES / (1024 * 1024);
export const RESUME_MIME = "application/pdf";
export const RESUME_HINT = `PDF only · max ${RESUME_MAX_MB}MB`;

export const ESSAY_MIN = 10;
export const ESSAY_MAX = 3000;

// Plain-language labels for DB enums from my_application(). No invented stages.
export const CANDIDATE_STAGE_LABELS: Record<string, string> = {
  applied: "Application received",
  speed_dating: "Speed dating",
  group_case: "Group case",
  interview: "Interview",
  hash: "Final review",
  decided: "Decision recorded",
};

export const CANDIDATE_STATUS_LABELS: Record<string, string> = {
  active: "In review",
  advanced: "Advanced",
  cut: "Not advancing",
  waitlisted: "Waitlisted",
  withdrawn: "Withdrawn",
  accepted: "Accepted",
  rejected: "Not accepted",
};

export function labelCandidateStage(stage: string): string {
  return CANDIDATE_STAGE_LABELS[stage] ?? stage;
}

export function labelCandidateStatus(status: string): string {
  return CANDIDATE_STATUS_LABELS[status] ?? status;
}

// EX-49/EX-50: required core fields with explicit constraints.
export const applyFieldsSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(2, "Enter your full name.")
    .max(120, "Name is too long."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid email address.")
    .regex(/@umich\.edu$/, "Use your @umich.edu email."),
  year: z.enum(GRAD_YEARS, { message: "Select your graduation year." }),
  major: z
    .string()
    .trim()
    .min(2, "Enter your major.")
    .max(160, "Major is too long."),
  phone: z
    .string()
    .trim()
    .max(30, "Phone number is too long.")
    .regex(/^[\d\s()+.-]*$/, "Enter a valid phone number.")
    .optional()
    .or(z.literal("")),
  linkedin_url: z
    .string()
    .trim()
    .url("Enter a full URL (https://…).")
    .regex(/linkedin\.com/i, "Enter a LinkedIn URL.")
    .optional()
    .or(z.literal("")),
});

export type ApplyFields = z.infer<typeof applyFieldsSchema>;

export type ApplyQuestion = {
  key: string;
  prompt: string;
  required: boolean;
};

export function responseSchemaFor(question: ApplyQuestion) {
  const base = z
    .string()
    .trim()
    .max(ESSAY_MAX, `Keep it under ${ESSAY_MAX} characters.`);
  return question.required
    ? base.min(ESSAY_MIN, "Write at least a sentence.")
    : base.optional().or(z.literal(""));
}

function isPdfFile(file: File): boolean {
  const hasPdfExt = file.name.toLowerCase().endsWith(".pdf");
  const isPdfMime = file.type === RESUME_MIME;
  // Browsers sometimes omit type or use octet-stream for PDFs.
  const isAmbiguousMime =
    file.type === "" || file.type === "application/octet-stream";
  return isPdfMime || (hasPdfExt && isAmbiguousMime);
}

/** Validate a FormData resume entry (PDF-only, ≤10MB). */
export function parseResumeFile(
  value: FormDataEntryValue | null
): { ok: true; file: File } | { ok: false; message: string } {
  if (!(value instanceof File) || value.size === 0) {
    return {
      ok: false,
      message: `Upload your resume as a PDF (${RESUME_HINT}).`,
    };
  }
  if (!isPdfFile(value)) {
    return {
      ok: false,
      message: `Resume must be a PDF (${RESUME_HINT}).`,
    };
  }
  if (value.size > RESUME_MAX_BYTES) {
    return {
      ok: false,
      message: `Resume must be ${RESUME_MAX_MB}MB or smaller. Compress the PDF and try again.`,
    };
  }
  return { ok: true, file: value };
}

// Zod wrapper so FormData actions share one schema entry point with fields.
export const resumeFileSchema = z.custom<File>(
  (value): value is File => {
    if (!(value instanceof File) || value.size === 0) return false;
    if (!isPdfFile(value)) return false;
    if (value.size > RESUME_MAX_BYTES) return false;
    return true;
  },
  {
    message: `Upload a PDF resume (${RESUME_HINT}).`,
  }
);
