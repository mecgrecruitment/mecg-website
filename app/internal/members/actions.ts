"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireBoard } from "@/lib/auth";

// Approve a self-serve access request: create the member row (board RLS allows
// the insert) and mark the request approved. "member" maps to committee, which
// is what the demo's approved members could do (read candidates, score, vote).
export async function approveMembership(formData: FormData) {
  const board = await requireBoard();
  const supabase = await createClient();

  const requestId = String(formData.get("request_id") || "");
  const role = String(formData.get("role") || "recruitment_committee") === "board"
    ? "board"
    : "recruitment_committee";

  const { data: req } = await supabase
    .from("membership_requests")
    .select("id, user_id, email, full_name, status")
    .eq("id", requestId)
    .maybeSingle();
  if (!req) {
    redirect("/internal/members?error=Request not found.");
  }

  const { error: insErr } = await supabase.from("members").insert({
    user_id: req.user_id,
    email: req.email,
    full_name: req.full_name,
    role,
  });
  if (insErr) {
    redirect(`/internal/members?error=${encodeURIComponent(insErr.message)}`);
  }

  const { error: statusErr } = await supabase
    .from("membership_requests")
    .update({ status: "approved", reviewed_by: board.id, reviewed_at: new Date().toISOString() })
    .eq("id", requestId);
  if (statusErr) {
    redirect(
      `/internal/members?error=${encodeURIComponent(
        `Member created, but the request could not be marked approved: ${statusErr.message}`
      )}`
    );
  }

  redirect("/internal/members?success=Member approved.");
}

export async function denyMembership(formData: FormData) {
  const board = await requireBoard();
  const supabase = await createClient();

  const requestId = String(formData.get("request_id") || "");
  const { error } = await supabase
    .from("membership_requests")
    .update({ status: "denied", reviewed_by: board.id, reviewed_at: new Date().toISOString() })
    .eq("id", requestId);
  if (error) {
    redirect(`/internal/members?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/internal/members?success=Request denied.");
}

// Assign a member to score a candidate at a stage. Demo's free-text emails →
// real UUID FKs; demo "final_round" → real candidate_stage "interview".
export async function createScoringAssignment(formData: FormData) {
  await requireBoard();
  const supabase = await createClient();

  const stageRaw = String(formData.get("stage") || "").trim();
  const stage = stageRaw === "final_round" ? "interview" : stageRaw;
  const candidateId = String(formData.get("candidate_id") || "").trim();
  const reviewerId = String(formData.get("reviewer_id") || "").trim();
  const teamLabel = String(formData.get("team_label") || "").trim();

  if (!["speed_dating", "group_case", "interview"].includes(stage) || !candidateId || !reviewerId) {
    redirect("/internal/members?error=Assignment is missing required fields.");
  }

  const { data: cycle } = await supabase
    .from("recruitment_cycles")
    .select("id")
    .eq("is_active", true)
    .maybeSingle();
  if (!cycle) {
    redirect("/internal/members?error=No active recruitment cycle.");
  }

  const { error } = await supabase.from("evaluator_assignments").upsert(
    {
      cycle_id: cycle.id,
      stage: stage as "speed_dating" | "group_case" | "interview",
      evaluator_id: reviewerId,
      candidate_id: candidateId,
      team_label: teamLabel || null,
    },
    { onConflict: "cycle_id,stage,evaluator_id,candidate_id" }
  );
  if (error) {
    redirect(`/internal/members?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/internal/members?success=Assignment saved.");
}
