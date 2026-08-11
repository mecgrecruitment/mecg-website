"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireBoard, requireCommittee } from "@/lib/auth";

// Board opens the cycle's hash session and enrolls every member as a participant
// so committee can vote (votes RLS requires participant + active session).
export async function startHashSession() {
  const board = await requireBoard();
  const supabase = await createClient();

  const { data: cycle } = await supabase
    .from("recruitment_cycles")
    .select("id")
    .eq("is_active", true)
    .maybeSingle();
  if (!cycle) {
    redirect("/internal/hash?error=No active recruitment cycle.");
  }

  const { data: session, error } = await supabase
    .from("hash_sessions")
    .insert({
      cycle_id: cycle.id,
      stage: "interview",
      name: "Hash Room",
      visibility: "anonymous",
      is_active: true,
      started_at: new Date().toISOString(),
      started_by: board.id,
    })
    .select("id")
    .single();
  if (error || !session) {
    redirect(`/internal/hash?error=${encodeURIComponent(error?.message ?? "Could not start session.")}`);
  }

  const { data: members, error: membersError } = await supabase
    .from("members")
    .select("id")
    .is("deleted_at", null);
  if (membersError) {
    redirect(
      `/internal/hash?error=${encodeURIComponent(
        `Session started, but could not enroll voters: ${membersError.message}`
      )}`
    );
  }

  const rows = (members ?? []).map((m) => ({ session_id: session.id, member_id: m.id }));
  if (rows.length) {
    const { error: participantsError } = await supabase
      .from("hash_session_participants")
      .upsert(rows, { onConflict: "session_id,member_id", ignoreDuplicates: true });
    if (participantsError) {
      redirect(
        `/internal/hash?error=${encodeURIComponent(
          `Session started, but could not enroll voters: ${participantsError.message}`
        )}`
      );
    }
  }

  redirect("/internal/hash?success=Hash session started.");
}

export async function submitHashVote(formData: FormData) {
  await requireCommittee();
  const supabase = await createClient();

  const sessionId = String(formData.get("session_id") || "");
  const candidateId = String(formData.get("candidate_id") || "");
  const value = String(formData.get("vote") || "");
  if (!sessionId || !candidateId || !["advance", "cut", "discuss"].includes(value)) {
    redirect("/internal/hash?error=Candidate and vote are required.");
  }

  const { error } = await supabase.rpc("submit_hash_vote", {
    p_session_id: sessionId,
    p_candidate_id: candidateId,
    p_value: value as "advance" | "cut" | "discuss",
  });
  if (error) {
    redirect(`/internal/hash?error=${encodeURIComponent(error.message)}`);
  }
  redirect("/internal/hash?success=Vote recorded.");
}

// Board records the authoritative decision: append a decisions row (with a tally
// snapshot), set the candidate's status, and log the move to 'decided'.
export async function recordDecision(formData: FormData) {
  await requireBoard();
  const supabase = await createClient();

  const sessionId = String(formData.get("session_id") || "");
  const candidateId = String(formData.get("candidate_id") || "");
  const value = String(formData.get("decision") || "");
  const rationale = String(formData.get("rationale") || "").trim();
  if (!sessionId || !candidateId || !["accepted", "rejected", "waitlisted"].includes(value)) {
    redirect("/internal/hash?error=Pick a decision.");
  }
  // The RPC validates session/candidate eligibility, snapshots the latest
  // votes, updates the candidate, and appends the transition in one transaction.
  const { error } = await supabase.rpc("record_hash_decision", {
    p_session_id: sessionId,
    p_candidate_id: candidateId,
    p_value: value as "accepted" | "rejected" | "waitlisted",
    p_rationale: rationale || undefined,
  });
  if (error) {
    redirect(`/internal/hash?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/internal/hash?success=Decision recorded.");
}
