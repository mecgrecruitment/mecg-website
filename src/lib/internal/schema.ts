import { z } from "zod";
import { emailSchema } from "@/lib/auth/schema";

const uuidSchema = z.uuid("Select a valid record.");
const optionalTextSchema = z
  .string()
  .trim()
  .max(500, "Keep this field under 500 characters.")
  .nullish()
  .transform((value) => value || undefined);

export const memberRoleSchema = z.enum([
  "board",
  "recruitment_committee",
  "general_member",
]);

export const approveMembershipSchema = z.object({
  request_id: uuidSchema,
  role: memberRoleSchema,
});

export const denyMembershipSchema = z.object({
  request_id: uuidSchema,
});

export const updateMemberRoleSchema = z.object({
  member_id: uuidSchema,
  role: memberRoleSchema,
});

export const revokeMembershipSchema = z.object({
  member_id: uuidSchema,
});

export const inviteMemberSchema = z.object({
  email: emailSchema,
  role: memberRoleSchema,
  notes: optionalTextSchema,
});

export const grantMembershipByEmailSchema = z.object({
  email: emailSchema,
  role: memberRoleSchema,
  full_name: z
    .string()
    .trim()
    .max(120, "Full name is too long.")
    .nullish()
    .transform((value) => value || undefined),
});

export const candidateStageSchema = z.enum([
  "speed_dating",
  "group_case",
  "interview",
]);

export const createScoringAssignmentSchema = z.object({
  // The member UI still labels this stage "final round"; the database calls it
  // "interview" and uses that value in its candidate_stage enum.
  stage: z
    .enum(["speed_dating", "group_case", "interview", "final_round"])
    .transform((value) => (value === "final_round" ? "interview" : value)),
  candidate_id: uuidSchema,
  reviewer_id: uuidSchema,
  team_label: optionalTextSchema,
});

export const submitCandidateScoreSchema = z.object({
  stage: candidateStageSchema,
  candidate_id: uuidSchema,
  rubric_version_id: uuidSchema,
});

export const scoreInputSchema = z.object({
  criterion_id: uuidSchema,
  value: z
    .coerce
    .number("Enter a whole-number score.")
    .int("Scores must be whole numbers.")
    .finite("Enter a valid score."),
});

export const submitHashVoteSchema = z.object({
  session_id: uuidSchema,
  candidate_id: uuidSchema,
  vote: z.enum(["advance", "cut", "discuss"], {
    message: "Choose a valid vote.",
  }),
});

export const recordHashDecisionSchema = z.object({
  session_id: uuidSchema,
  candidate_id: uuidSchema,
  decision: z.enum(["accepted", "rejected", "waitlisted"], {
    message: "Pick a valid decision.",
  }),
  rationale: z
    .string()
    .trim()
    .max(2_000, "Keep the rationale under 2,000 characters.")
    .nullish()
    .transform((value) => value || undefined),
});

export const applicantCheckinSchema = z.object({
  event_phrase: z
    .string()
    .trim()
    .min(1, "Enter the event phrase from the host (example: GOBLUE).")
    .max(120, "Event phrase is too long.")
    .transform((value) => value.toUpperCase()),
});
