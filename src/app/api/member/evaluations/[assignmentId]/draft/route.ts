import { NextRequest, NextResponse } from "next/server";
import { mapRpcError, readJsonBody } from "@/lib/api-route";
import { currentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { parseEvaluationDraftPayload } from "../../evaluation-draft-payload";

type DraftRpc = (
  name: string,
  args: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }>;

function draftRpc(client: Awaited<ReturnType<typeof createClient>>) {
  return client.rpc.bind(client) as unknown as DraftRpc;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ assignmentId: string }> }) {
  if (!(await currentUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { assignmentId } = await params;
  const supabase = await createClient();
  const { data, error } = await draftRpc(supabase)("get_evaluation_draft", { target_assignment_id: assignmentId });
  if (error) {
    console.error("get_evaluation_draft failed", error);
    const mapped = mapRpcError(error, "Could not load evaluation draft");
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
  return NextResponse.json({ draft: data ?? null });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ assignmentId: string }> }) {
  if (!(await currentUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { assignmentId } = await params;
  const parsedBody = await readJsonBody(req, 96 * 1024);
  if (parsedBody.error === "too_large") return NextResponse.json({ error: "Payload is too large" }, { status: 413 });
  if (parsedBody.error) return NextResponse.json({ error: "Invalid draft payload" }, { status: 400 });
  const payload = parseEvaluationDraftPayload(parsedBody.data);
  if (!payload) return NextResponse.json({ error: "Invalid draft payload" }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await draftRpc(supabase)("save_evaluation_draft", {
    target_assignment_id: assignmentId,
    submitted_ratings: payload.ratings,
    submitted_evidence: payload.evidence,
  });
  if (error) {
    console.error("save_evaluation_draft failed", error);
    const mapped = mapRpcError(error, "Could not save evaluation draft");
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
  return NextResponse.json({ savedAt: data });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ assignmentId: string }> }) {
  if (!(await currentUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { assignmentId } = await params;
  const supabase = await createClient();
  const { error } = await draftRpc(supabase)("discard_evaluation_draft", { target_assignment_id: assignmentId });
  if (error) {
    console.error("discard_evaluation_draft failed", error);
    const mapped = mapRpcError(error, "Could not discard evaluation draft");
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
  return new NextResponse(null, { status: 204 });
}
