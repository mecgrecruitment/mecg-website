"use server";

import { redirect } from "next/navigation";
import { createClient } from "../../../../lib/supabase/server";

export async function submitApplication(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/auth/login?message=Log in before submitting your application.");
  }

  const gradYear = String(formData.get("grad_year") || "").trim();
  const major = String(formData.get("major") || "").trim();
  const whyMecg = String(formData.get("answer_why_mecg") || "").trim();
  const teamwork = String(formData.get("answer_teamwork") || "").trim();
  const problemSolving = String(formData.get("answer_problem_solving") || "").trim();
  const anythingElse = String(formData.get("answer_anything_else") || "").trim();
  const resume = formData.get("resume");

  let resumePath: string | null = null;

  if (resume instanceof File && resume.size > 0) {
    if (resume.type !== "application/pdf") {
      redirect("/apply/account?error=Resume must be a PDF.");
    }

    const safeName = resume.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    resumePath = `${user.id}/${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from("resumes")
      .upload(resumePath, resume, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      redirect(`/apply/account?error=${encodeURIComponent(uploadError.message)}`);
    }
  }

  const { error } = await supabase.from("applications").upsert(
    {
      user_id: user.id,
      cycle: "Winter 2026",
      status: "submitted",
      grad_year: gradYear,
      major,
      resume_path: resumePath,
      answer_why_mecg: whyMecg,
      answer_teamwork: teamwork,
      answer_problem_solving: problemSolving,
      answer_anything_else: anythingElse,
      submitted_at: new Date().toISOString(),
    },
    {
      onConflict: "user_id,cycle",
    }
  );

  if (error) {
    redirect(`/apply/account?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/apply/dashboard?message=Application submitted.");
}
