"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { firstError } from "@/lib/auth/schema";
import {
  approveMembershipSchema,
  createScoringAssignmentSchema,
  denyMembershipSchema,
  grantMembershipByEmailSchema,
  inviteMemberSchema,
  revokeMembershipSchema,
  updateMemberRoleSchema,
} from "@/lib/internal/schema";
import { requireBoard, ROLE_LABELS } from "@/lib/auth";

function membersRedirect(kind: "success" | "error", message: string): never {
  redirect(`/internal/members?${kind}=${encodeURIComponent(message)}`);
}

// Approve a self-serve access request: create the member row (board RLS allows
// the insert) and mark the request approved.
export async function approveMembership(formData: FormData) {
  const board = await requireBoard();
  const parsed = approveMembershipSchema.safeParse({
    request_id: formData.get("request_id"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    membersRedirect("error", firstError(parsed));
  }

  const supabase = await createClient();

  const { data: req } = await supabase
    .from("membership_requests")
    .select("id, user_id, email, full_name, status")
    .eq("id", parsed.data.request_id)
    .maybeSingle();
  if (!req) {
    membersRedirect("error", "Request not found.");
  }

  const { error: insErr } = await supabase.from("members").insert({
    user_id: req.user_id,
    email: req.email,
    full_name: req.full_name,
    role: parsed.data.role,
  });
  if (insErr) {
    membersRedirect("error", insErr.message);
  }

  const { error: statusErr } = await supabase
    .from("membership_requests")
    .update({ status: "approved", reviewed_by: board.id, reviewed_at: new Date().toISOString() })
    .eq("id", parsed.data.request_id);
  if (statusErr) {
    membersRedirect(
      "error",
      `Member created, but the request could not be marked approved: ${statusErr.message}`
    );
  }

  membersRedirect("success", "Member approved.");
}

export async function denyMembership(formData: FormData) {
  const board = await requireBoard();
  const parsed = denyMembershipSchema.safeParse({
    request_id: formData.get("request_id"),
  });
  if (!parsed.success) {
    membersRedirect("error", firstError(parsed));
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("membership_requests")
    .update({ status: "denied", reviewed_by: board.id, reviewed_at: new Date().toISOString() })
    .eq("id", parsed.data.request_id);
  if (error) {
    membersRedirect("error", error.message);
  }

  membersRedirect("success", "Request denied.");
}

// Change an existing member's role (board / committee / member). The role-freeze
// trigger allows this only when the caller is board.
export async function updateMemberRole(formData: FormData) {
  const board = await requireBoard();
  const parsed = updateMemberRoleSchema.safeParse({
    member_id: formData.get("member_id"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    membersRedirect("error", firstError(parsed));
  }

  const supabase = await createClient();

  if (parsed.data.member_id === board.id && parsed.data.role !== "board") {
    membersRedirect("error", "You cannot remove your own board role.");
  }

  const { error } = await supabase
    .from("members")
    .update({ role: parsed.data.role })
    .eq("id", parsed.data.member_id)
    .is("deleted_at", null);
  if (error) {
    membersRedirect("error", error.message);
  }

  membersRedirect("success", "Role updated.");
}

// Soft-revoke access without deleting history. Board only.
export async function revokeMembership(formData: FormData) {
  const board = await requireBoard();
  const parsed = revokeMembershipSchema.safeParse({
    member_id: formData.get("member_id"),
  });
  if (!parsed.success) {
    membersRedirect("error", firstError(parsed));
  }

  const supabase = await createClient();

  if (parsed.data.member_id === board.id) {
    membersRedirect("error", "You cannot revoke your own access.");
  }

  const { error } = await supabase
    .from("members")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", parsed.data.member_id)
    .is("deleted_at", null);
  if (error) {
    membersRedirect("error", error.message);
  }

  membersRedirect("success", "Member access revoked.");
}

// Pre-approve an email so signup creates a pending request with the chosen role.
export async function inviteMember(formData: FormData) {
  const board = await requireBoard();
  const parsed = inviteMemberSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    membersRedirect("error", firstError(parsed));
  }

  const supabase = await createClient();

  // Unique index is on lower(email), so look up then insert/update explicitly.
  const { data: existing } = await supabase
    .from("invite_allowlist")
    .select("id")
    .ilike("email", parsed.data.email)
    .maybeSingle();

  const { error } = existing
    ? await supabase
        .from("invite_allowlist")
        .update({
          role: parsed.data.role,
          notes: parsed.data.notes ?? null,
          invited_by: board.id,
          consumed_at: null,
        })
        .eq("id", existing.id)
    : await supabase.from("invite_allowlist").insert({
        email: parsed.data.email,
        role: parsed.data.role,
        notes: parsed.data.notes ?? null,
        invited_by: board.id,
      });

  if (error) {
    membersRedirect("error", error.message);
  }

  membersRedirect(
    "success",
    existing
      ? `Updated invite for ${parsed.data.email}.`
      : `Invited ${parsed.data.email}. They can sign up and will appear in Pending Requests.`
  );
}

// Instantly grant access for someone who already has an auth account.
export async function grantMembershipByEmail(formData: FormData) {
  await requireBoard();
  const parsed = grantMembershipByEmailSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role"),
    full_name: formData.get("full_name"),
  });
  if (!parsed.success) {
    membersRedirect("error", firstError(parsed));
  }

  const supabase = await createClient();

  // Generated RPC args use `string | undefined` for optional text, not null.
  const { error } = await supabase.rpc("grant_membership_by_email", {
    p_email: parsed.data.email,
    p_role: parsed.data.role,
    ...(parsed.data.full_name ? { p_full_name: parsed.data.full_name } : {}),
  });
  if (error) {
    membersRedirect("error", error.message);
  }

  membersRedirect(
    "success",
    `Granted ${ROLE_LABELS[parsed.data.role]} access to ${parsed.data.email}.`
  );
}

// Assign a member to score a candidate at a stage. Demo's free-text emails →
// real UUID FKs; demo "final_round" → real candidate_stage "interview".
export async function createScoringAssignment(formData: FormData) {
  await requireBoard();
  const parsed = createScoringAssignmentSchema.safeParse({
    stage: formData.get("stage"),
    candidate_id: formData.get("candidate_id"),
    reviewer_id: formData.get("reviewer_id"),
    team_label: formData.get("team_label"),
  });
  if (!parsed.success) {
    membersRedirect("error", firstError(parsed));
  }

  const supabase = await createClient();

  const { data: cycle } = await supabase
    .from("recruitment_cycles")
    .select("id")
    .eq("is_active", true)
    .maybeSingle();
  if (!cycle) {
    membersRedirect("error", "No active recruitment cycle.");
  }

  const { error } = await supabase.from("evaluator_assignments").upsert(
    {
      cycle_id: cycle.id,
      stage: parsed.data.stage,
      evaluator_id: parsed.data.reviewer_id,
      candidate_id: parsed.data.candidate_id,
      team_label: parsed.data.team_label ?? null,
    },
    { onConflict: "cycle_id,stage,evaluator_id,candidate_id" }
  );
  if (error) {
    membersRedirect("error", error.message);
  }

  membersRedirect("success", "Assignment saved.");
}
