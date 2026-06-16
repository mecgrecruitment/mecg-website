"use server";

import { redirect } from "next/navigation";
import { createDemoAdminClient } from "@/lib/supabase/demo-admin";

export async function submitDemoScore(formData: FormData) {
  const supabase = createDemoAdminClient();

  const candidateEmail = String(formData.get("candidate_email") || "").trim().toLowerCase();
  const candidateName = String(formData.get("candidate_name") || "").trim();
  const stage = String(formData.get("stage") || "Final Interview").trim();
  const behavioralScore = Number(formData.get("behavioral_score") || 0);
  const technicalScore = Number(formData.get("technical_score") || 0);
  const notes = String(formData.get("notes") || "").trim();
  const decision = String(formData.get("decision") || "Discuss").trim();

  if (!candidateEmail) {
    redirect("/internal/score?error=Candidate email is required.");
  }

  const { error } = await supabase.from("demo_scores").insert({
    candidate_email: candidateEmail,
    candidate_name: candidateName,
    stage,
    behavioral_score: behavioralScore,
    technical_score: technicalScore,
    notes,
    decision,
  });

  if (error) {
    redirect(`/internal/score?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/internal/score?saved=1");
}
