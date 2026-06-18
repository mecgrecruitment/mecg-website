"use server";

import { redirect } from "next/navigation";
import { createDemoAdminClient } from "@/lib/supabase/demo-admin";
import { requireInternalSession, requireRole } from "@/lib/internal-portal/session";

export async function submitCandidateScore(formData: FormData) {
  const session = await requireInternalSession();
  const supabase = createDemoAdminClient();

  const stage = String(formData.get("stage") || "").trim();
  const candidateEmail = String(formData.get("candidate_email") || "").trim().toLowerCase();
  const candidateName = String(formData.get("candidate_name") || "").trim();
  const teamNumber = String(formData.get("team_number") || "").trim() || null;

  if (!stage || !candidateEmail || !candidateName) {
    redirect("/internal/scoring?error=Missing candidate or stage.");
  }

  if (stage === "final_round" && session.role !== "board") {
    redirect("/internal?error=Final round scoring is board only.");
  }

  if (session.role !== "board") {
    const { data: assignment } = await supabase
      .from("demo_scoring_assignments")
      .select("id")
      .eq("stage", stage)
      .eq("candidate_email", candidateEmail)
      .eq("reviewer_email", session.email)
      .eq("active", true)
      .maybeSingle();

    if (!assignment) {
      redirect("/internal/scoring?error=You are not assigned to score that candidate.");
    }
  }

  const score1 = Number(formData.get("score_1") || 0);
  const score2 = Number(formData.get("score_2") || 0);
  const score3 = Number(formData.get("score_3") || 0);
  const score4 = Number(formData.get("score_4") || 0);
  const recommendation = String(formData.get("recommendation") || "").trim();
  const notes = String(formData.get("notes") || "").trim();

  const { error } = await supabase.from("demo_candidate_scores").upsert(
    {
      stage,
      candidate_email: candidateEmail,
      candidate_name: candidateName,
      reviewer_email: session.email,
      reviewer_name: session.fullName,
      team_number: teamNumber,
      score_1: score1,
      score_2: score2,
      score_3: score3,
      score_4: score4,
      recommendation,
      notes,
      submitted_at: new Date().toISOString(),
    },
    {
      onConflict: "stage,candidate_email,reviewer_email",
    }
  );

  if (error) {
    redirect(`/internal/scoring/${stage.replace("_", "-")}?error=Could not save score.`);
  }

  redirect(`/internal/scoring/${stage.replace("_", "-")}?success=Score saved.`);
}

export async function submitHashVote(formData: FormData) {
  const session = await requireInternalSession();
  const supabase = createDemoAdminClient();

  const candidateEmail = String(formData.get("candidate_email") || "").trim().toLowerCase();
  const candidateName = String(formData.get("candidate_name") || "").trim();
  const candidateStage = String(formData.get("candidate_stage") || "").trim();
  const vote = String(formData.get("vote") || "").trim();
  const rationale = String(formData.get("rationale") || "").trim();

  const officialDecision = String(formData.get("official_decision") || "").trim();

  if (!candidateEmail || !candidateName || !candidateStage || !vote) {
    redirect("/internal/hash?error=Candidate, round, and vote are required.");
  }

  const isBoard = session.role === "board";

  await supabase.from("demo_hash_votes").insert({
    candidate_email: candidateEmail,
    candidate_name: candidateName,
    reviewer_email: session.email,
    vote,
    candidate_stage: candidateStage,
    decision_status: isBoard && officialDecision ? officialDecision : vote,
    final_decision: isBoard && officialDecision ? officialDecision : null,
    rationale,
  });

  if (isBoard && officialDecision) {
    await supabase
      .from("demo_applications")
      .update({
        recruitment_status: officialDecision,
        status: officialDecision,
      })
      .eq("email", candidateEmail);
  }

  redirect("/internal/hash?success=Hash vote saved.");
}

