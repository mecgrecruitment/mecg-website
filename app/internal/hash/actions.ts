"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireBoard, requireCommittee } from "@/lib/auth";

type VoteValue = "advance" | "cut" | "discuss";
type DecisionValue = "accepted" | "rejected" | "waitlisted";

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
      stage: "hash",
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
  const member = await requireCommittee();
  const supabase = await createClient();

  const sessionId = String(formData.get("session_id") || "");
  const candidateId = String(formData.get("candidate_id") || "");
  const value = String(formData.get("vote") || "");
  if (!sessionId || !candidateId || !["advance", "cut", "discuss"].includes(value)) {
    redirect("/internal/hash?error=Candidate and vote are required.");
  }

  const { error } = await supabase.from("votes").insert({
    session_id: sessionId,
    candidate_id: candidateId,
    voter_id: member.id,
    value: value as VoteValue,
  });
  if (error) {
    redirect(`/internal/hash?error=${encodeURIComponent(error.message)}`);
  }
  redirect("/internal/hash?success=Vote recorded.");
}

// Board records the authoritative decision: append a decisions row (with a tally
// snapshot), set the candidate's status, and log the move to 'decided'.
export async function recordDecision(formData: FormData) {
  const board = await requireBoard();
  const supabase = await createClient();

  const sessionId = String(formData.get("session_id") || "");
  const candidateId = String(formData.get("candidate_id") || "");
  const value = String(formData.get("decision") || "");
  const rationale = String(formData.get("rationale") || "").trim();
  if (!sessionId || !candidateId || !["accepted", "rejected", "waitlisted"].includes(value)) {
    redirect("/internal/hash?error=Pick a decision.");
  }
  const decision = value as DecisionValue;

  // Latest vote per voter → tally snapshot.
  const { data: votes, error: votesError } = await supabase
    .from("votes")
    .select("voter_id, value, created_at")
    .eq("session_id", sessionId)
    .eq("candidate_id", candidateId)
    .order("created_at", { ascending: false });
  if (votesError) {
    redirect(`/internal/hash?error=${encodeURIComponent(votesError.message)}`);
  }
  const latest = new Map<string, string>();
  for (const v of votes ?? []) {
    if (!latest.has(v.voter_id)) latest.set(v.voter_id, v.value);
  }
  const tally = { advance: 0, cut: 0, discuss: 0, total_voters: latest.size };
  for (const val of latest.values()) {
    if (val === "advance") tally.advance++;
    else if (val === "cut") tally.cut++;
    else if (val === "discuss") tally.discuss++;
  }

  const { error: decisionError } = await supabase.from("decisions").insert({
    session_id: sessionId,
    candidate_id: candidateId,
    value: decision,
    decided_by: board.id,
    rationale: rationale || null,
    voter_tally: tally,
  });
  if (decisionError) {
    redirect(`/internal/hash?error=${encodeURIComponent(decisionError.message)}`);
  }

  const { data: candidate } = await supabase
    .from("candidates")
    .select("current_stage")
    .eq("id", candidateId)
    .maybeSingle();

  const { error: statusError } = await supabase
    .from("candidates")
    .update({ status: decision, current_stage: "decided" })
    .eq("id", candidateId);
  if (statusError) {
    redirect(
      `/internal/hash?error=${encodeURIComponent(
        `Decision recorded, but the candidate's status was not updated: ${statusError.message}`
      )}`
    );
  }

  const { error: transitionError } = await supabase.from("stage_transitions").insert({
    candidate_id: candidateId,
    from_stage: candidate?.current_stage ?? null,
    to_stage: "decided",
    actor_id: board.id,
    reason: `Hash decision: ${decision}`,
  });
  if (transitionError) {
    redirect(
      `/internal/hash?error=${encodeURIComponent(
        `Decision recorded, but the audit trail entry failed: ${transitionError.message}`
      )}`
    );
  }

  redirect("/internal/hash?success=Decision recorded.");
}
