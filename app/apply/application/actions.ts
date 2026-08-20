"use server";

import { createHash, randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireApplicant } from "@/lib/auth";
import { firstError } from "@/lib/auth/schema";
import { verifyTurnstile } from "@/lib/turnstile";
import {
  applyFieldsSchema,
  parseResumeFile,
  responseSchemaFor,
  RESUME_MIME,
  type ApplyQuestion,
} from "@/lib/apply/schema";

function bail(message: string): never {
  redirect(`/apply/dashboard?application_error=${encodeURIComponent(message)}`);
}

// Authenticated applicant submission. The email is taken from the verified
// session (never the form), so my_application()
// — which matches on auth.email() — can later unlock the dashboard.
// Cycle/question reads use user-scoped SECURITY DEFINER RPCs; service-role
// is reserved for resume Storage + submit_application only.
export async function submitApplication(formData: FormData) {
  const applicant = await requireApplicant(); // signed-in non-member
  const email = applicant.email;

  const parsed = applyFieldsSchema.safeParse({
    full_name: formData.get("full_name"),
    email,
    year: formData.get("year"),
    major: formData.get("major"),
    phone: formData.get("phone") ?? "",
    linkedin_url: formData.get("linkedin_url") ?? "",
  });
  if (!parsed.success) {
    bail(firstError(parsed));
  }
  const fields = parsed.data;

  const humanVerified = await verifyTurnstile(formData.get("cf-turnstile-response"));
  if (!humanVerified) {
    bail("Verification failed. Refresh the page, complete the check, and try again.");
  }

  const resumeResult = parseResumeFile(formData.get("resume"));
  if (!resumeResult.ok) {
    bail(resumeResult.message);
  }
  const resume = resumeResult.file;

  // Least-privilege reads: JWT session client + DEFINER RPCs (not service-role).
  const supabase = await createClient();
  const { data: cycleId, error: cycleError } = await supabase.rpc("get_open_apply_cycle");
  if (cycleError || !cycleId) {
    bail("Applications are not open right now. Check prospective-members for dates.");
  }

  const { data: questionRows, error: questionsError } = await supabase.rpc(
    "list_apply_questions",
    { p_cycle_id: cycleId }
  );
  if (questionsError) {
    bail("Something went wrong loading the application questions. Try again in a moment.");
  }
  const questions: ApplyQuestion[] = questionRows ?? [];

  const responses: { key: string; question: string; response: string }[] = [];
  for (const q of questions) {
    const raw = String(formData.get(q.key) || "");
    const result = responseSchemaFor(q).safeParse(raw);
    if (!result.success) {
      bail(result.error.issues[0]?.message ?? `Please answer: ${q.prompt}`);
    }
    if (result.data) {
      responses.push({ key: q.key, question: q.prompt, response: result.data });
    }
  }

  // Service-role only past this point: Storage has no authenticated write
  // policies, and submit_application is revoked from authenticated.
  const admin = createAdminClient();

  // Upload first, insert second (EX-57 cleanup contract).
  const candidateId = randomUUID();
  const resumePath = `${candidateId}/${randomUUID()}.pdf`;
  const { error: uploadError } = await admin.storage
    .from("resumes")
    .upload(resumePath, resume, { contentType: RESUME_MIME });
  if (uploadError) {
    bail("Could not save your resume. Use a PDF under 10MB and try again.");
  }

  // Real client IP (not the applicant id — that's per-account, not per-device,
  // and is trivially reset by creating a new account, defeating the per-IP
  // rate limit the RPC enforces).
  const h = await headers();
  const clientIp =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  const ipHash = createHash("sha256").update(clientIp).digest("hex");
  const { data: outcome, error: rpcError } = await admin.rpc("submit_application", {
    p_candidate_id: candidateId,
    p_ip_hash: ipHash,
    p_cycle_id: cycleId,
    p_full_name: fields.full_name,
    p_email: email,
    p_phone: fields.phone || "",
    p_year: fields.year,
    p_major: fields.major,
    p_linkedin_url: fields.linkedin_url || "",
    p_resume_storage_path: resumePath,
    p_responses: responses,
  });

  if (rpcError) {
    await admin.storage.from("resumes").remove([resumePath]);
    if (rpcError.message.includes("rate_limited")) {
      bail("Too many submissions from your network today. Try again tomorrow.");
    }
    bail("Something went wrong submitting your application. Try again in a moment.");
  }

  if (outcome !== "ok" && outcome !== "duplicate") {
    await admin.storage.from("resumes").remove([resumePath]);
    bail("Something went wrong submitting your application. Try again in a moment.");
  }

  // Duplicate ⇒ already applied this cycle; the dashboard shows the locked
  // "thank you" view either way (my_application matches the verified email).
  redirect("/apply/dashboard?submitted=1");
}
