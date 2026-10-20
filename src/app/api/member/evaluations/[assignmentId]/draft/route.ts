import { NextRequest, NextResponse } from "next/server";
import { mapRpcError, readJsonBody } from "@/lib/api-route";
import { currentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { screeningRpc } from "@/lib/screening-rpc";
import { parseEvaluationDraftSnapshot, parseEvaluationDraftWrite, parseEvaluationDraftWriteResult } from "@/lib/evaluation-draft-write";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ assignmentId: string }> }) {
  if (!(await currentUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { assignmentId } = await params;
  const { data, error } = await screeningRpc<unknown>(await createClient(), "get_evaluation_draft_v2", { target_assignment_id: assignmentId });
  if (error) { const mapped = mapRpcError(error, "Could not load evaluation draft"); return NextResponse.json(mapped.body, { status: mapped.status }); }
  const snapshot = parseEvaluationDraftSnapshot(data);
  if (!snapshot || snapshot.assignmentId !== assignmentId) return NextResponse.json({ error: "The saved draft could not be verified." }, { status: 503 });
  return NextResponse.json(snapshot);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ assignmentId: string }> }) {
  if (!(await currentUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { assignmentId } = await params;
  const parsedBody = await readJsonBody(req, 96 * 1024);
  if (parsedBody.error === "too_large") return NextResponse.json({ error: "Payload is too large" }, { status: 413 });
  const payload = parsedBody.error ? null : parseEvaluationDraftWrite(parsedBody.data);
  if (!payload) return NextResponse.json({ error: "Reload the evaluation workspace before saving; a valid revision and mutation receipt are required." }, { status: 400 });
  const { data, error } = await screeningRpc<unknown>(await createClient(), "save_evaluation_draft_v2", {
    target_assignment_id: assignmentId, submitted_ratings: payload.ratings, submitted_evidence: payload.evidence,
    expected_revision: payload.expectedRevision, mutation_id: payload.mutationId,
  });
  if (error) { const mapped = mapRpcError(error, "Could not save evaluation draft"); return NextResponse.json(mapped.body, { status: mapped.status }); }
  const result = parseEvaluationDraftWriteResult(data);
  if (!result || (result.kind === "saved" ? result.assignmentId !== assignmentId || result.mutationId !== payload.mutationId : result.snapshot.assignmentId !== assignmentId)) return NextResponse.json({ error: "The server save could not be confirmed. It may already be saved; retry the same request." }, { status: 503 });
  return NextResponse.json(result, { status: result.kind === "conflict" ? 409 : 200 });
}

// No browser consumer uses deletion. Unconditional deletion would bypass CAS.
export async function DELETE() {
  if (!(await currentUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ error: "Draft deletion is unavailable. Use the evaluation workspace to resolve saved copies." }, { status: 405, headers: { Allow: "GET, PUT" } });
}
