import { NextRequest, NextResponse } from "next/server";
import { mapRpcError } from "@/lib/api-route";
import { currentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ assignmentId: string }> }) {
  if (!(await currentUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { assignmentId } = await params;
  const body = await req.json().catch(() => null);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_evaluation", {
    target_assignment_id: assignmentId,
    submitted_ratings: Array.isArray(body?.ratings) ? body.ratings : [],
    submitted_evidence: typeof body?.evidence === "string" ? body.evidence : undefined,
  });
  if (error) {
    console.error("submit_evaluation failed", error);
    const { body, status } = mapRpcError(error);
    return NextResponse.json(body, { status });
  }
  return NextResponse.json({ id: data?.[0]?.evaluation_id, score: data?.[0]?.score }, { status: 201 });
}
