"use server";

import { redirect } from "next/navigation";
import { createDemoAdminClient } from "@/lib/supabase/demo-admin";
import { requireRole } from "@/lib/internal-portal/session";

export async function approveInternalAccount(formData: FormData) {
  const session = await requireRole(["board"]);
  const supabase = createDemoAdminClient();

  const email = String(formData.get("email") || "").trim().toLowerCase();
  const role = String(formData.get("role") || "member").trim();

  const safeRole = role === "board" ? "board" : "member";

  await supabase
    .from("demo_internal_accounts")
    .update({
      role: safeRole,
      approval_status: "approved",
      active: true,
      approved_at: new Date().toISOString(),
      approved_by_email: session.email,
      updated_at: new Date().toISOString(),
    })
    .eq("email", email);

  redirect("/internal/members?success=Account approved.");
}

export async function denyInternalAccount(formData: FormData) {
  await requireRole(["board"]);
  const supabase = createDemoAdminClient();
  const email = String(formData.get("email") || "").trim().toLowerCase();

  await supabase
    .from("demo_internal_accounts")
    .update({
      approval_status: "denied",
      active: false,
      updated_at: new Date().toISOString(),
    })
    .eq("email", email);

  redirect("/internal/members?success=Account denied.");
}

export async function createScoringAssignment(formData: FormData) {
  await requireRole(["board"]);
  const supabase = createDemoAdminClient();

  const stage = String(formData.get("stage") || "").trim();
  const candidateEmail = String(formData.get("candidate_email") || "").trim().toLowerCase();
  const candidateName = String(formData.get("candidate_name") || "").trim();
  const reviewerEmail = String(formData.get("reviewer_email") || "").trim().toLowerCase();
  const reviewerName = String(formData.get("reviewer_name") || "").trim();
  const teamNumber = String(formData.get("team_number") || "").trim();

  if (!stage || !candidateEmail || !candidateName || !reviewerEmail) {
    redirect("/internal/members?error=Assignment is missing required fields.");
  }

  await supabase.from("demo_scoring_assignments").upsert(
    {
      stage,
      candidate_email: candidateEmail,
      candidate_name: candidateName,
      reviewer_email: reviewerEmail,
      reviewer_name: reviewerName || null,
      team_number: teamNumber || null,
      active: true,
    },
    { onConflict: "stage,candidate_email,reviewer_email" }
  );

  redirect("/internal/members?success=Assignment saved.");
}
