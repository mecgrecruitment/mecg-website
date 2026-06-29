"use server";

import { createHash, randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApplicant } from "@/lib/auth";
import {
  applyFieldsSchema,
  responseSchemaFor,
  RESUME_MAX_BYTES,
  RESUME_MIME,
  type ApplyQuestion,
} from "@/lib/apply/schema";

function bail(message: string): never {
  redirect(`/apply/dashboard?application_error=${encodeURIComponent(message)}`);
}

// Authenticated applicant submission. Unlike the public /api/apply route, the
// email is taken from the verified session (never the form), so my_application()
// — which matches on auth.email() — can later unlock the dashboard. The
// service-role admin client performs the upload + transactional RPC.
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
    bail(parsed.error.issues[0]?.message ?? "Fix the highlighted fields and resubmit.");
  }
  const fields = parsed.data;

  const resume = formData.get("resume");
  if (
    !(resume instanceof File) ||
    resume.size === 0 ||
    resume.type !== RESUME_MIME ||
    !resume.name.toLowerCase().endsWith(".pdf")
  ) {
    bail("Upload your resume as a PDF.");
  }
  if (resume.size > RESUME_MAX_BYTES) {
    bail("Resume must be 10MB or smaller.");
  }

  // Applicants can't read cycles/questions under RLS, so use the admin client
  // for the read + the transactional submit (service-role, like /api/apply).
  const admin = createAdminClient();

  const { data: cycle } = await admin
    .from("recruitment_cycles")
    .select("id, applications_open_at, applications_close_at")
    .eq("is_active", true)
    .maybeSingle();
  const now = new Date();
  const open =
    cycle &&
    (!cycle.applications_open_at || new Date(cycle.applications_open_at) <= now) &&
    (!cycle.applications_close_at || new Date(cycle.applications_close_at) > now);
  if (!open) {
    bail("Applications are not open right now.");
  }

  const { data: questionRows } = await admin
    .from("application_questions")
    .select("key, prompt, required")
    .eq("cycle_id", cycle.id)
    .order("sort_order");
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

  // Upload first, insert second (mirrors /api/apply EX-57 cleanup contract).
  const candidateId = randomUUID();
  const resumePath = `${candidateId}/${randomUUID()}.pdf`;
  const { error: uploadError } = await admin.storage
    .from("resumes")
    .upload(resumePath, resume, { contentType: RESUME_MIME });
  if (uploadError) {
    bail("Could not save your resume. Try again in a moment.");
  }

  const ipHash = createHash("sha256").update(`applicant:${applicant.id}`).digest("hex");
  const { data: outcome, error: rpcError } = await admin.rpc("submit_application", {
    p_candidate_id: candidateId,
    p_ip_hash: ipHash,
    p_cycle_id: cycle.id,
    p_full_name: fields.full_name,
    p_email: email,
    p_phone: fields.phone || "",
    p_year: fields.year,
    p_major: fields.major,
    p_linkedin_url: fields.linkedin_url || "",
    p_resume_storage_path: resumePath,
    p_responses: responses,
  });

  if (rpcError || (outcome !== "ok" && outcome !== "duplicate")) {
    await admin.storage.from("resumes").remove([resumePath]);
    bail("Something went wrong submitting your application. Try again in a moment.");
  }

  // Duplicate ⇒ already applied this cycle; the dashboard shows the locked
  // "thank you" view either way (my_application matches the verified email).
  redirect("/apply/dashboard?submitted=1");
}
