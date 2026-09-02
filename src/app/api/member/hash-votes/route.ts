import { NextRequest, NextResponse } from "next/server";
import { mapRpcError, readJsonBody } from "@/lib/api-route";
import { currentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const HASH_VOTES = new Set(["YES", "NO", "UNSURE"]);

export async function POST(req: NextRequest) {
  if (!(await currentUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsedBody = await readJsonBody(req, 8 * 1024);
  if (parsedBody.error === "too_large") return NextResponse.json({ error: "Payload is too large" }, { status: 413 });
  if (parsedBody.error || !parsedBody.data || typeof parsedBody.data !== "object" || Array.isArray(parsedBody.data)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const body = parsedBody.data as Record<string, unknown>;
  const applicationId = typeof body.applicationId === "string" ? body.applicationId : "";
  const vote = typeof body.vote === "string" ? body.vote : "";
  const note = typeof body.note === "string" ? body.note : "";
  if (!applicationId) return NextResponse.json({ error: "Applicant is required" }, { status: 400 });
  if (!HASH_VOTES.has(vote)) return NextResponse.json({ error: "Vote must be YES, NO, or UNSURE" }, { status: 400 });
  if (note.length > 1000) return NextResponse.json({ error: "Note must be 1000 characters or fewer" }, { status: 400 });
  const supabase = await createClient();
  const { error } = await supabase.rpc("cast_hash_vote", {
    target_application_id: applicationId,
    vote_value: vote,
    vote_note: note,
  });
  if (error) {
    console.error("cast_hash_vote failed", error);
    const { body: errorBody, status } = mapRpcError(error, "Vote could not be saved");
    return NextResponse.json(errorBody, { status });
  }
  return NextResponse.json({ ok: true });
}
