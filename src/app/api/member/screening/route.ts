import { NextRequest, NextResponse } from "next/server";
import { mapRpcError } from "@/lib/api-route";
import { currentUser } from "@/lib/auth";
import { screeningRpc } from "@/lib/screening-rpc";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const assignmentId = typeof body?.assignmentId === "string" ? body.assignmentId : "";
  if (!assignmentId) return NextResponse.json({ error: "Assignment required" }, { status: 400 });
  const supabase = await createClient();
  const result = body.action === "SUBMIT"
    ? await screeningRpc(supabase, "submit_screening_review", {
        target_assignment_id: assignmentId,
        ratings: body.ratings,
        review_evidence: String(body.evidence ?? ""),
        review_recommendation: String(body.recommendation ?? ""),
      })
    : body.action === "RECUSE"
      ? await screeningRpc(supabase, "recuse_screening_assignment", {
          target_assignment_id: assignmentId,
          recusal_reason: String(body.reason ?? ""),
        })
      : { data: null, error: { message: "Unknown action" } };
  if (result.error) {
    console.error(`member screening ${body.action} failed`, result.error);
    const { body: errorBody, status } = mapRpcError(result.error);
    return NextResponse.json(errorBody, { status });
  }
  return NextResponse.json({ data: result.data });
}
