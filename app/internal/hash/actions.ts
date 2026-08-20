"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireBoard, requireCommittee } from "@/lib/auth";
import { firstError } from "@/lib/auth/schema";
import { recordHashDecisionSchema, submitHashVoteSchema } from "@/lib/internal/schema";

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

  // One live session at a time — avoid a second insert that looks like it worked.
  const { data: existing } = await supabase
    .from("hash_sessions")
    .select("id")
    .eq("is_active", true)
    .maybeSingle();
  if (existing) {
    redirect("/internal/hash?error=A hash session is already active.");
  }

  // Anonymous-by-default (PRD ATS-45). Do not flip visibility here.
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
  const parsed = submitHashVoteSchema.safeParse({
    session_id: formData.get("session_id"),
    candidate_id: formData.get("candidate_id"),
    vote: formData.get("vote"),
  });
  if (!parsed.success) {
    redirect(`/internal/hash?error=${encodeURIComponent(firstError(parsed))}`);
  }

  const supabase = await createClient();

  const { error } = await supabase.rpc("submit_hash_vote", {
    p_session_id: parsed.data.session_id,
    p_candidate_id: parsed.data.candidate_id,
    p_value: parsed.data.vote,
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
  const parsed = recordHashDecisionSchema.safeParse({
    session_id: formData.get("session_id"),
    candidate_id: formData.get("candidate_id"),
    decision: formData.get("decision"),
    rationale: formData.get("rationale"),
  });
  if (!parsed.success) {
    redirect(`/internal/hash?error=${encodeURIComponent(firstError(parsed))}`);
  }

  const supabase = await createClient();

  // The RPC validates session/candidate eligibility, snapshots the latest
  // votes, updates the candidate, and appends the transition in one transaction.
  const { error } = await supabase.rpc("record_hash_decision", {
    p_session_id: parsed.data.session_id,
    p_candidate_id: parsed.data.candidate_id,
    p_value: parsed.data.decision,
    p_rationale: parsed.data.rationale,
  });
  if (error) {
    redirect(`/internal/hash?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/internal/hash?success=Decision recorded.");
}
