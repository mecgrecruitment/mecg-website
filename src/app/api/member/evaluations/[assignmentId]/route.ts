import { NextRequest, NextResponse } from "next/server";
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
    const status = error.code === "P0002" ? 404 : error.code === "42501" ? 403 : error.code === "55000" || error.code === "23505" ? 409 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }
  return NextResponse.json({ id: data?.[0]?.evaluation_id, score: data?.[0]?.score }, { status: 201 });
}
