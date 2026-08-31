import { createHash, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { mapRpcError } from "@/lib/api-route";
import { currentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";
import { distributeScreeningReviews, type ScreeningPacketInput, type ScreeningReviewerInput } from "@/lib/screening";
import { screeningRpc } from "@/lib/screening-rpc";
import { createClient } from "@/lib/supabase/server";

const MAX_PACKET_QUESTION_LENGTH = 2000;
const MAX_PACKET_ANSWER_LENGTH = 8000;
const MAX_PACKET_RESPONSES = 50;
const MAX_PACKET_TOTAL_LENGTH = 40000;

// Mirrors the shape update_screening_packet_content enforces, so a malformed body is a 400 and not a 500.
function parsePacketContent(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const responses = (value as Record<string, unknown>).responses;
  if (!Array.isArray(responses) || responses.length === 0 || responses.length > MAX_PACKET_RESPONSES) return null;
  let total = 0;
  const parsed: Array<{ question: string; answer: string }> = [];
  for (const entry of responses) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
    const { question, answer } = entry as Record<string, unknown>;
    if (typeof question !== "string" || typeof answer !== "string") return null;
    if (!question.trim() || !answer.trim()) return null;
    if (question.length > MAX_PACKET_QUESTION_LENGTH || answer.length > MAX_PACKET_ANSWER_LENGTH) return null;
    total += question.length + answer.length;
    if (total > MAX_PACKET_TOTAL_LENGTH) return null;
    parsed.push({ question, answer });
  }
  return { responses: parsed };
}

export async function POST(request: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const cycleId = typeof body?.cycleId === "string" ? body.cycleId : "";
  if (!cycleId || !hasPermission(user.memberships, cycleId, "RECRUITMENT_OPERATIONS")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const supabase = await createClient();
  let result: { data: unknown; error: { code?: string; message: string } | null };

  if (body.action === "CREATE") {
    const reviewerIds = Array.isArray(body.reviewerIds)
      ? body.reviewerIds.filter((value: unknown): value is string => typeof value === "string")
      : [];
    result = await screeningRpc(supabase, "create_screening_batch", { target_cycle_id: cycleId, reviewer_ids: reviewerIds });
  } else if (body.action === "APPROVE_PACKET") {
    result = await screeningRpc(supabase, "approve_screening_packet", {
      target_packet_id: String(body.packetId ?? ""),
      approved: body.approved === true,
    });
  } else if (body.action === "UPDATE_PACKET") {
    const content = parsePacketContent(body.content);
    if (!content) return NextResponse.json({ error: "Every redacted response needs a question and an answer" }, { status: 400 });
    result = await screeningRpc(supabase, "update_screening_packet_content", {
      target_packet_id: String(body.packetId ?? ""),
      revised_content: content,
    });
  } else if (body.action === "DISTRIBUTE") {
    const batchId = String(body.batchId ?? "");
    const input = await screeningRpc<{ packets?: ScreeningPacketInput[]; reviewers?: ScreeningReviewerInput[] }>(
      supabase,
      "screening_assignment_inputs",
      { target_batch_id: batchId },
    );
    if (input.error) result = input;
    else {
      const seed = randomUUID();
      const distribution = distributeScreeningReviews({
        packets: input.data?.packets ?? [],
        reviewers: input.data?.reviewers ?? [],
        seed,
      });
      if (!distribution.feasible) {
        return NextResponse.json({ error: "Three eligible reviewers are not available for every packet", shortages: distribution.shortages }, { status: 409 });
      }
      result = await screeningRpc(supabase, "commit_screening_assignments", {
        target_batch_id: batchId,
        proposal: distribution.assignments,
        commitment: createHash("sha256").update(seed).digest("hex"),
        summary: { loads: distribution.loads },
      });
    }
  } else if (body.action === "FREEZE") {
    result = await screeningRpc(supabase, "freeze_screening_batch", { target_batch_id: String(body.batchId ?? "") });
  } else {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  if (result.error) {
    console.error(`admin screening ${body.action} failed`, result.error);
    const { body: errorBody, status } = mapRpcError(result.error);
    return NextResponse.json(errorBody, { status });
  }
  return NextResponse.json({ data: result.data });
}
