import { NextRequest, NextResponse } from "next/server";
import { mapRpcError, readJsonBody } from "@/lib/api-route";
import { currentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const MAX_RATINGS = 50;
const MAX_NOTE_LENGTH = 2000;

// Mirrors what submit_evaluation enforces: a 1-5 score or an explicit null per criterion, notes capped.
function parseRatings(value: unknown) {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_RATINGS) return null;
  const ratings: Array<{ criterionId: string; score: number | null; note: string }> = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
    const { criterionId, score, note } = entry as Record<string, unknown>;
    if (typeof criterionId !== "string" || !criterionId || criterionId.length > 200) return null;
    if (score !== null && (typeof score !== "number" || !Number.isInteger(score) || score < 1 || score > 5)) return null;
    if (note != null && (typeof note !== "string" || note.length > MAX_NOTE_LENGTH)) return null;
    ratings.push({ criterionId, score, note: typeof note === "string" ? note : "" });
  }
  if (new Set(ratings.map((rating) => rating.criterionId)).size !== ratings.length) return null;
  return ratings;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ assignmentId: string }> }) {
  if (!(await currentUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { assignmentId } = await params;
  const parsedBody = await readJsonBody(req, 128 * 1024);
  if (parsedBody.error === "too_large") return NextResponse.json({ error: "Payload is too large" }, { status: 413 });
  if (parsedBody.error || !parsedBody.data || typeof parsedBody.data !== "object" || Array.isArray(parsedBody.data)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const body = parsedBody.data as Record<string, unknown>;
  const ratings = parseRatings(body.ratings);
  if (!ratings) return NextResponse.json({ error: "Every criterion needs a score from 1 to 5, or an explicit skip" }, { status: 400 });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_evaluation", {
    target_assignment_id: assignmentId,
    submitted_ratings: ratings,
    submitted_evidence: typeof body.evidence === "string" ? body.evidence : undefined,
  });
  if (error) {
    console.error("submit_evaluation failed", error);
    const { body, status } = mapRpcError(error);
    return NextResponse.json(body, { status });
  }
  return NextResponse.json({ id: data?.[0]?.evaluation_id, score: data?.[0]?.score }, { status: 201 });
}
