"use server";

import { redirect } from "next/navigation";
import { createDemoAdminClient } from "@/lib/supabase/demo-admin";

export async function submitDemoApplication(formData: FormData) {
  const supabase = createDemoAdminClient();

  const fullName = String(formData.get("full_name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const year = String(formData.get("year") || "").trim();
  const major = String(formData.get("major") || "").trim();
  const resume = formData.get("resume") as File | null;
  const whyMecg = String(formData.get("why_mecg") || "").trim();
  const teamwork = String(formData.get("teamwork") || "").trim();
  const problemSolving = String(formData.get("problem_solving") || "").trim();

  if (!fullName || !email || !whyMecg || !teamwork || !problemSolving) {
    redirect("/apply/application?error=Please complete the required fields.");
  }

  const { error } = await supabase.from("demo_applications").insert({
    full_name: fullName,
    email,
    year,
    major,
    resume_name: resume?.name || null,
    why_mecg: whyMecg,
    teamwork,
    problem_solving: problemSolving,
    status: "submitted",
  });

  if (error) {
    redirect(`/apply/application?error=${encodeURIComponent(error.message)}`);
  }

  redirect(`/apply/dashboard?email=${encodeURIComponent(email)}&submitted=1`);
}
