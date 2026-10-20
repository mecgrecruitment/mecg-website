import { NextRequest, NextResponse } from "next/server";
import { mapRpcError, readJsonBody } from "@/lib/api-route";
import { currentUser } from "@/lib/auth";
import { screeningRpc } from "@/lib/screening-rpc";
import { createClient } from "@/lib/supabase/server";
import { parseScreeningDraftSnapshot, parseScreeningDraftWrite, parseScreeningDraftWriteResult, sameScreeningDraft } from "@/lib/screening-draft-write";

function assignmentIdFrom(request: NextRequest) {
  const assignmentId = request.nextUrl.searchParams.get("assignmentId") ?? "";
  return assignmentId.length <= 200 ? assignmentId : "";
}

export async function GET(request: NextRequest) {
  if (!(await currentUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const assignmentId = assignmentIdFrom(request);
  if (!assignmentId) return NextResponse.json({ error: "Assignment required" }, { status: 400 });
  const supabase = await createClient();
  const { data, error } = await screeningRpc<unknown>(supabase, "get_screening_review_draft_v2", { target_assignment_id: assignmentId });
  if (error) {
    console.error("get_screening_review_draft_v2 failed", { code: error.code ?? "unknown" });
    const mapped = mapRpcError(error, "Could not load review draft");
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
  const snapshot = parseScreeningDraftSnapshot(data);
  if (!snapshot || snapshot.assignmentId !== assignmentId) {
    return NextResponse.json({ error: "Your private draft could not be verified. Keep any observations on this page and retry loading it." }, { status: 503 });
  }
  return NextResponse.json(snapshot);
}

export async function PUT(request: NextRequest) {
  if (!(await currentUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const assignmentId = assignmentIdFrom(request);
  if (!assignmentId) return NextResponse.json({ error: "Assignment required" }, { status: 400 });
  const parsedBody = await readJsonBody(request, 96 * 1024);
  if (parsedBody.error === "too_large") return NextResponse.json({ error: "Payload is too large" }, { status: 413 });
  if (parsedBody.error) return NextResponse.json({ error: "Invalid draft payload" }, { status: 400 });
  const draft = parseScreeningDraftWrite(parsedBody.data);
  if (!draft) return NextResponse.json({ error: "Reload the review workspace before saving; a valid revision and mutation receipt are required." }, { status: 400 });
  const supabase = await createClient();
  const { data, error } = await screeningRpc<unknown>(supabase, "save_screening_review_draft_v2", {
    target_assignment_id: assignmentId,
    draft_ratings: draft.ratings,
    draft_evidence: draft.evidence,
    draft_recommendation: draft.recommendation,
    expected_revision: draft.expectedRevision,
    mutation_id: draft.mutationId,
  });
  if (error) {
    console.error("save_screening_review_draft_v2 failed", { code: error.code ?? "unknown" });
    const mapped = mapRpcError(error, "Could not save review draft");
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
  const result = parseScreeningDraftWriteResult(data);
  if (!result || (result.kind === "saved" ? result.assignmentId !== assignmentId || result.mutationId !== draft.mutationId || !sameScreeningDraft(result.draft, draft) : result.snapshot.assignmentId !== assignmentId)) {
    return NextResponse.json({ error: "The save could not be confirmed. It may already be saved; preserve your observations and retry the same request." }, { status: 503 });
  }
  return NextResponse.json(result, { status: result.kind === "conflict" ? 409 : 200 });
}
