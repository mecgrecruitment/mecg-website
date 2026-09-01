import { NextRequest, NextResponse } from "next/server";
import { mapRpcError, readJsonBody } from "@/lib/api-route";
import { currentUser } from "@/lib/auth";
import { hasPermission, type Permission } from "@/lib/authorization";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Json } from "@/lib/supabase/database.types";
import { PIPELINE_STATUSES } from "@/lib/workflow";

type CycleStatus = Database["rush"]["Enums"]["cycle_status"];
type RoundStatus = Database["rush"]["Enums"]["round_status"];
type ApplicationStatus = Database["rush"]["Enums"]["application_status"];
type MemberRole = Database["rush"]["Enums"]["member_role"];

const CYCLE_STATUSES = new Set<CycleStatus>(["DRAFT", "OPEN", "IN_PROCESS", "DECISION_LOCK", "CLOSED", "ARCHIVED"]);
const ROUND_STATUSES = new Set<RoundStatus>(["DRAFT", "PUBLISHED", "ACTIVE", "FROZEN", "FINALIZED"]);
const APPLICATION_STATUSES = new Set<ApplicationStatus>(PIPELINE_STATUSES);
const MEMBER_ROLES = ["MEMBER", "BOARD", "PANEL", "OWNER", "RECRUITMENT_COMMITTEE"] satisfies readonly MemberRole[];
const COMMITTEE_DENIED_STATUSES = new Set(["OFFERED", "WAITLISTED", "REJECTED", "WITHDRAWN"]);
const ACTION_PERMISSIONS: Record<string, Permission> = {
  ADD_USER: "MANAGE_MEMBERSHIPS",
  ADD_EXISTING_USER: "MANAGE_MEMBERSHIPS",
  SET_MEMBER_ROLE: "MANAGE_MEMBERSHIPS",
  DEACTIVATE_MEMBERSHIP: "MANAGE_MEMBERSHIPS",
  RESTORE_MEMBERSHIP: "MANAGE_MEMBERSHIPS",
  ADD_APPLICANT: "RECRUITMENT_OPERATIONS",
  ASSIGN: "RECRUITMENT_OPERATIONS",
  UNASSIGN: "RECRUITMENT_OPERATIONS",
  REASSIGN: "RECRUITMENT_OPERATIONS",
  SET_APPLICATION_STATUS: "RECRUITMENT_OPERATIONS",
  CREATE_SLOT: "RECRUITMENT_OPERATIONS",
  SET_EVENT_GRADING: "RECRUITMENT_OPERATIONS",
  CREATE_GROUP: "RECRUITMENT_OPERATIONS",
  ASSIGN_GROUP: "RECRUITMENT_OPERATIONS",
  UNASSIGN_GROUP: "RECRUITMENT_OPERATIONS",
  DELETE_GROUP: "RECRUITMENT_OPERATIONS",
  SET_ROUND_STATUS: "MANAGE_CYCLE",
  SET_CYCLE_STATUS: "MANAGE_CYCLE",
  SET_APPLICATION_QUESTIONS: "MANAGE_CYCLE",
  SET_RUBRIC_CRITERIA: "MANAGE_CYCLE",
  // MANAGE_MEMBERSHIPS is the app-side proxy for OWNER; the RPC re-checks it.
  CLONE_CYCLE: "MANAGE_MEMBERSHIPS",
};

function isMemberRole(value: unknown): value is MemberRole {
  return typeof value === "string" && MEMBER_ROLES.some((role) => role === value);
}

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsedBody = await readJsonBody(req, 64 * 1024);
  if (parsedBody.error === "too_large") return NextResponse.json({ error: "Payload is too large" }, { status: 413 });
  if (parsedBody.error || !parsedBody.data || typeof parsedBody.data !== "object" || Array.isArray(parsedBody.data)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const body = parsedBody.data as Record<string, unknown>;
  const cycleId = typeof body.cycleId === "string" ? body.cycleId : "";
  const action = typeof body.action === "string" ? body.action : "";
  const status = typeof body.status === "string" ? body.status : "";
  const permission = ACTION_PERMISSIONS[action];
  if (!permission) return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  if (!cycleId || !hasPermission(user.memberships, cycleId, permission)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (action === "SET_CYCLE_STATUS" && !CYCLE_STATUSES.has(status as CycleStatus)) return NextResponse.json({ error: "Invalid cycle status" }, { status: 400 });
  if (action === "SET_ROUND_STATUS" && !ROUND_STATUSES.has(status as RoundStatus)) return NextResponse.json({ error: "Invalid round status" }, { status: 400 });
  if (action === "SET_APPLICATION_STATUS" && !APPLICATION_STATUSES.has(status as ApplicationStatus)) return NextResponse.json({ error: "Invalid application status" }, { status: 400 });
  const memberRole = isMemberRole(body.role) ? body.role : null;
  if (action === "SET_MEMBER_ROLE" && (!memberRole || typeof body.userId !== "string" || !body.userId)) return NextResponse.json({ error: "Invalid member role" }, { status: 400 });
  const committeeOnly = hasPermission(user.memberships, cycleId, "RECRUITMENT_OPERATIONS") && !hasPermission(user.memberships, cycleId, "MANAGE_CYCLE");
  if (action === "SET_APPLICATION_STATUS" && committeeOnly && COMMITTEE_DENIED_STATUSES.has(status)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const supabase = await createClient();
  let data: unknown;
  let error: { code?: string; message: string } | null = null;

  if (action === "ADD_USER") {
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const role = typeof body.role === "string" && ["MEMBER", "BOARD", "PANEL", "RECRUITMENT_COMMITTEE"].includes(body.role) ? body.role as "MEMBER" | "BOARD" | "PANEL" | "RECRUITMENT_COMMITTEE" : "MEMBER";
    if (!email || !name || password.length < 8 || password.length > 1024) return NextResponse.json({ error: "Valid name, email, and an 8-character password are required" }, { status: 400 });
    const admin = createAdminClient();
    const { data: created, error: createError } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: name } });
    if (createError || !created.user) {
      console.error("admin add_user failed", createError);
      return NextResponse.json({ error: createError?.message ?? "Could not create user" }, { status: 409 });
    }
    ({ data, error } = await supabase.rpc("grant_membership", { target_user_id: created.user.id, target_cycle_id: cycleId, target_role: role }));
    if (error) await admin.auth.admin.deleteUser(created.user.id);
  } else if (action === "ADD_EXISTING_USER") {
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email || !memberRole) return NextResponse.json({ error: "Valid email and role are required" }, { status: 400 });
    const admin = createAdminClient();
    const { data: users, error: usersError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (usersError) {
      console.error("admin find_existing_user failed", usersError);
      return NextResponse.json({ error: "Could not look up the account" }, { status: 500 });
    }
    const existingUser = users.users.find((candidate) => candidate.email?.toLowerCase() === email);
    if (!existingUser) return NextResponse.json({ error: "No authentication account uses that email" }, { status: 404 });
    ({ data, error } = await supabase.rpc("grant_membership", { target_user_id: existingUser.id, target_cycle_id: cycleId, target_role: memberRole }));
  } else if (action === "SET_MEMBER_ROLE") {
    if (!memberRole) return NextResponse.json({ error: "Invalid member role" }, { status: 400 });
    ({ data, error } = await supabase.rpc("set_membership_role", { target_user_id: String(body.userId), target_cycle_id: cycleId, target_role: memberRole }));
  } else if (action === "DEACTIVATE_MEMBERSHIP") {
    const userId = typeof body.userId === "string" ? body.userId : "";
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    if (!userId || !reason) return NextResponse.json({ error: "A user and reason are required" }, { status: 400 });
    ({ data, error } = await supabase.rpc("deactivate_cycle_membership", { target_user_id: userId, target_cycle_id: cycleId, revocation_reason: reason }));
  } else if (action === "RESTORE_MEMBERSHIP") {
    const userId = typeof body.userId === "string" ? body.userId : "";
    if (!userId) return NextResponse.json({ error: "A user is required" }, { status: 400 });
    ({ data, error } = await supabase.rpc("restore_cycle_membership", { target_user_id: userId, target_cycle_id: cycleId }));
  } else if (action === "ADD_APPLICANT") {
    ({ data, error } = await supabase.rpc("add_applicant", { target_cycle_id: cycleId, applicant_name: String(body.name ?? ""), applicant_contact: String(body.contact ?? "") }));
  } else if (action === "ASSIGN") {
    ({ data, error } = await supabase.rpc("assign_evaluator", { target_cycle_id: cycleId, target_round_id: String(body.roundId ?? ""), target_application_id: String(body.applicationId ?? ""), target_evaluator_id: String(body.evaluatorId ?? "") }));
  } else if (action === "UNASSIGN") {
    const assignmentId = typeof body.assignmentId === "string" ? body.assignmentId : "";
    if (!assignmentId) return NextResponse.json({ error: "An assignment is required" }, { status: 400 });
    ({ data, error } = await supabase.rpc("unassign_evaluator", { target_assignment_id: assignmentId }));
  } else if (action === "REASSIGN") {
    const assignmentId = typeof body.assignmentId === "string" ? body.assignmentId : "";
    const evaluatorId = typeof body.evaluatorId === "string" ? body.evaluatorId : "";
    if (!assignmentId || !evaluatorId) return NextResponse.json({ error: "An assignment and evaluator are required" }, { status: 400 });
    ({ data, error } = await supabase.rpc("reassign_evaluator", { target_assignment_id: assignmentId, replacement_evaluator_id: evaluatorId }));
  } else if (action === "SET_ROUND_STATUS") {
    ({ data, error } = await supabase.rpc("set_round_status", { target_round_id: String(body.roundId ?? ""), next_status: status as RoundStatus }));
  } else if (action === "SET_CYCLE_STATUS") {
    ({ data, error } = await supabase.rpc("set_cycle_status", { target_cycle_id: cycleId, next_status: status as CycleStatus }));
  } else if (action === "SET_APPLICATION_QUESTIONS") {
    // Shape only. The RPC re-validates every field and owns the real rules
    // (key format, prompt length, input type, duplicate keys, and the refusal
    // to edit once a cohort has started submitting).
    if (!Array.isArray(body.questions)) return NextResponse.json({ error: "Questions must be a list" }, { status: 400 });
    ({ data, error } = await supabase.rpc("set_application_questions", { target_cycle_id: cycleId, questions: body.questions as Json }));
  } else if (action === "SET_RUBRIC_CRITERIA") {
    // Shape only again. The RPC owns the round-status gate, the version bump
    // when a rubric has already been scored against, and every field rule.
    if (!Array.isArray(body.criteria)) return NextResponse.json({ error: "Criteria must be a list" }, { status: 400 });
    if (typeof body.roundId !== "string" || !body.roundId) return NextResponse.json({ error: "Round is required" }, { status: 400 });
    ({ data, error } = await supabase.rpc("set_rubric_criteria", { target_round_id: body.roundId, criteria: body.criteria as Json }));
  } else if (action === "CLONE_CYCLE") {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name || name.length > 120) return NextResponse.json({ error: "A cycle name is required" }, { status: 400 });
    ({ data, error } = await supabase.rpc("clone_cycle", { source_cycle_id: cycleId, cycle_name: name }));
  } else if (action === "SET_APPLICATION_STATUS") {
    ({ data, error } = await supabase.rpc("set_application_status", { target_application_id: String(body.applicationId ?? ""), next_status: status as ApplicationStatus }));
  } else if (action === "CREATE_SLOT") {
    ({ data, error } = await supabase.rpc("create_event_slot", { target_event_id: String(body.eventId ?? ""), slot_starts_at: String(body.startsAt ?? ""), slot_ends_at: String(body.endsAt ?? ""), slot_capacity: Number(body.capacity ?? 8) }));
  } else if (action === "SET_EVENT_GRADING") {
    ({ data, error } = await supabase.rpc("set_event_grading", { target_event_id: String(body.eventId ?? ""), enabled: Boolean(body.enabled) }));
  } else if (action === "CREATE_GROUP") {
    ({ data, error } = await supabase.rpc("create_case_group", { target_cycle_id: cycleId, group_name: String(body.name ?? ""), group_prompt: String(body.prompt ?? "") }));
  } else if (action === "ASSIGN_GROUP") {
    ({ data, error } = await supabase.rpc("assign_case_group", { target_group_id: String(body.groupId ?? ""), target_application_id: String(body.applicationId ?? "") }));
  } else if (action === "UNASSIGN_GROUP") {
    ({ data, error } = await supabase.rpc("unassign_case_group", { target_group_id: String(body.groupId ?? ""), target_application_id: String(body.applicationId ?? "") }));
  } else if (action === "DELETE_GROUP") {
    ({ data, error } = await supabase.rpc("delete_case_group", { target_group_id: String(body.groupId ?? "") }));
  }

  if (error) {
    console.error(`admin rush ${action} failed`, error);
    const { body: errorBody, status } = mapRpcError(error);
    return NextResponse.json(errorBody, { status });
  }
  return NextResponse.json(data === undefined || data === null ? { ok: true } : { id: data }, { status: 201 });
}
