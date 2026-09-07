import { NextRequest, NextResponse } from "next/server";
import { mapRpcError, readJsonBody } from "@/lib/api-route";
import { currentUser } from "@/lib/auth";
import { screeningRpc } from "@/lib/screening-rpc";
import { createClient } from "@/lib/supabase/server";

const MAX_RATINGS = 50;
const MAX_NOTE_LENGTH = 2000;

// Mirrors what submit_screening_review enforces: one 1-5 score per criterion, notes capped.
function parseScreeningRatings(value: unknown) {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_RATINGS) return null;
  const ratings: Array<{ criterionId: string; score: number; note: string }> = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
    const { criterionId, score, note } = entry as Record<string, unknown>;
    if (typeof criterionId !== "string" || !criterionId || criterionId.length > 200) return null;
    if (typeof score !== "number" || !Number.isInteger(score) || score < 1 || score > 5) return null;
    if (note != null && (typeof note !== "string" || note.length > MAX_NOTE_LENGTH)) return null;
    const normalizedNote = typeof note === "string" ? note : "";
    if ((score === 1 || score === 2 || score === 5) && !normalizedNote.trim()) return null;
    ratings.push({ criterionId, score, note: normalizedNote });
  }
  if (new Set(ratings.map((rating) => rating.criterionId)).size !== ratings.length) return null;
  return ratings;
}

export async function POST(request: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsedBody = await readJsonBody(request, 128 * 1024);
  if (parsedBody.error === "too_large") return NextResponse.json({ error: "Payload is too large" }, { status: 413 });
  if (parsedBody.error || !parsedBody.data || typeof parsedBody.data !== "object" || Array.isArray(parsedBody.data)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const body = parsedBody.data as Record<string, unknown>;
  const assignmentId = typeof body.assignmentId === "string" ? body.assignmentId : "";
  if (!assignmentId) return NextResponse.json({ error: "Assignment required" }, { status: 400 });
  const ratings = body.action === "SUBMIT" ? parseScreeningRatings(body.ratings) : null;
  if (body.action === "SUBMIT" && !ratings) {
    return NextResponse.json({ error: "Every criterion needs one score from 1 to 5, with evidence notes for ratings 1, 2, and 5" }, { status: 400 });
  }
  if (body.action !== "SUBMIT" && body.action !== "RECUSE") {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
  const supabase = await createClient();
  const result: { data: unknown; error: { code?: string; message: string } | null } = body.action === "SUBMIT"
    ? await screeningRpc(supabase, "submit_screening_review", {
      target_assignment_id: assignmentId,
      ratings: ratings!,
      review_evidence: String(body.evidence ?? ""),
      review_recommendation: String(body.recommendation ?? ""),
    })
    : await screeningRpc(supabase, "recuse_screening_assignment", {
      target_assignment_id: assignmentId,
      recusal_reason: String(body.reason ?? ""),
    });
  if (result.error) {
    console.error(`member screening ${body.action} failed`, result.error);
    const { body: errorBody, status } = mapRpcError(result.error);
    return NextResponse.json(errorBody, { status });
  }
  let nextAssignmentId: string | null = null;
  if (body.action === "SUBMIT") {
    const next = await screeningRpc<unknown>(supabase, "next_screening_assignment", { target_assignment_id: assignmentId });
    if (next.error) {
      // The review is already locked. Failure to find the convenience link
      // must not turn that successful mutation into an apparent failure.
      console.error("next_screening_assignment failed", next.error);
    } else if (typeof next.data === "string") {
      nextAssignmentId = next.data;
    }
  }
  return NextResponse.json({ data: result.data, nextAssignmentId });
}
