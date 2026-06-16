"use server";

import { redirect } from "next/navigation";
import { createDemoAdminClient } from "@/lib/supabase/demo-admin";

export async function submitHashVote(formData: FormData) {
  const supabase = createDemoAdminClient();

  const candidateEmail = String(formData.get("candidate_email") || "").trim().toLowerCase();
  const candidateName = String(formData.get("candidate_name") || "").trim();
  const vote = String(formData.get("vote") || "").trim();
  const rationale = String(formData.get("rationale") || "").trim();

  if (!candidateEmail || !vote) {
    redirect("/internal/hash?error=Candidate email and vote are required.");
  }

  const { error } = await supabase.from("demo_hash_votes").insert({
    candidate_email: candidateEmail,
    candidate_name: candidateName,
    vote,
    rationale,
  });

  if (error) {
    redirect(`/internal/hash?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/internal/hash?saved=1");
}
