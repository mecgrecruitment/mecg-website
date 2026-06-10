import { z } from "zod";

// EX-51: one schema, validated client-side (inline UX) and server-side
// (authoritative — the Route Handler never trusts the client).

export const GRAD_YEARS = ["2026", "2027", "2028", "2029", "2030"] as const;

export const RESUME_MAX_BYTES = 10 * 1024 * 1024; // EX-55: PDF only, ≤10MB
export const RESUME_MIME = "application/pdf";

export const ESSAY_MIN = 10;
export const ESSAY_MAX = 3000;

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
