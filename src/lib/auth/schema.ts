import { z } from "zod";

// Bulletproof email/password validators shared by every auth action and form.
// Email validity is checked with a deliberately simple pattern (not zod's
// version-specific `.email()`) so this never breaks across zod releases.
const emailPattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Email is required.")
  .refine((v) => emailPattern.test(v), "Enter a valid email address.")
  .transform((v) => v.toLowerCase());

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(72, "Password must be 72 characters or fewer."); // bcrypt's hard limit

export const fullNameSchema = z
  .string()
  .trim()
  .min(1, "Full name is required.")
  .max(120, "Full name is too long.");

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required."),
});

export const signupSchema = z.object({
  full_name: fullNameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export const forgotSchema = z.object({
  email: emailSchema,
});

export const resetSchema = z.object({
  password: passwordSchema,
});

export const resendSchema = z.object({
  email: emailSchema,
});

export const requestAccessSchema = z.object({
  full_name: fullNameSchema,
  // Form offers "member" | "board"; the request_membership RPC maps
  // "member" → recruitment_committee, "board" → board.
  requested_role: z.enum(["member", "board"]),
});

// Flatten zod errors to a single user-facing message for ?error= redirects.
export function firstError(result: { success: false; error: z.ZodError }): string {
  return result.error.issues[0]?.message ?? "Please check your input and try again.";
}
