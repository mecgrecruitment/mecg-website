"use server";

import { redirect } from "next/navigation";
import { requireApplicantSession } from "@/lib/applicant-portal/session";
import { submitApplicantApplication } from "@/lib/applicant-portal/operations";

export async function submitDemoApplication(formData: FormData) {
  const session = await requireApplicantSession();

  const resume = formData.get("resume") as File | null;

  const result = await submitApplicantApplication(session, {
    fullName: String(formData.get("full_name") || ""),
    year: String(formData.get("year") || ""),
    major: String(formData.get("major") || ""),
    resumeName: resume && resume.size > 0 ? resume.name : null,
    whyMecg: String(formData.get("why_mecg") || ""),
    teamwork: String(formData.get("teamwork") || ""),
    problemSolving: String(formData.get("problem_solving") || ""),
  });

  if (!result.ok) {
    redirect(`/apply/dashboard?application_error=${encodeURIComponent(result.message)}`);
  }

  redirect("/apply/dashboard?submitted=1");
}
