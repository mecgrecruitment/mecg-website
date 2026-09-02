import { NextRequest, NextResponse } from "next/server";
import { mapRpcError, readJsonBody } from "@/lib/api-route";
import { currentUser } from "@/lib/auth";
import { screeningRpc } from "@/lib/screening-rpc";
import { createClient } from "@/lib/supabase/server";
import { parseScreeningDraft } from "@/app/member/screening/screening-draft";

function assignmentIdFrom(request: NextRequest) {
  const assignmentId = request.nextUrl.searchParams.get("assignmentId") ?? "";
  return assignmentId.length <= 200 ? assignmentId : "";
}

export async function GET(request: NextRequest) {
  if (!(await currentUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const assignmentId = assignmentIdFrom(request);
  if (!assignmentId) return NextResponse.json({ error: "Assignment required" }, { status: 400 });
  const supabase = await createClient();
  const { data, error } = await screeningRpc<unknown>(supabase, "get_screening_review_draft", { target_assignment_id: assignmentId });
  if (error) {
    console.error("get_screening_review_draft failed", error);
    const mapped = mapRpcError(error, "Could not load review draft");
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
  const draft = data == null ? null : parseScreeningDraft(data);
  if (data != null && !draft) {
    console.error("get_screening_review_draft returned an invalid payload");
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
  return NextResponse.json({ draft });
}

export async function PUT(request: NextRequest) {
  if (!(await currentUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const assignmentId = assignmentIdFrom(request);
  if (!assignmentId) return NextResponse.json({ error: "Assignment required" }, { status: 400 });
  const parsedBody = await readJsonBody(request, 96 * 1024);
  if (parsedBody.error === "too_large") return NextResponse.json({ error: "Payload is too large" }, { status: 413 });
  if (parsedBody.error) return NextResponse.json({ error: "Invalid draft payload" }, { status: 400 });
  const draft = parseScreeningDraft(parsedBody.data);
  if (!draft) return NextResponse.json({ error: "Invalid draft payload" }, { status: 400 });
  const supabase = await createClient();
  const { data, error } = await screeningRpc<unknown>(supabase, "save_screening_review_draft", {
    target_assignment_id: assignmentId,
    draft_ratings: draft.ratings,
    draft_evidence: draft.evidence,
    draft_recommendation: draft.recommendation,
  });
  if (error) {
    console.error("save_screening_review_draft failed", error);
    const mapped = mapRpcError(error, "Could not save review draft");
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
  return NextResponse.json({ savedAt: data });
}
