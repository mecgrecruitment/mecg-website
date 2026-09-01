import { NextRequest, NextResponse } from "next/server";
import { mapRpcError, readJsonBody } from "@/lib/api-route";
import { currentUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsedBody = await readJsonBody(req, 8 * 1024);
  if (parsedBody.error === "too_large") return NextResponse.json({ error: "Payload is too large" }, { status: 413 });
  if (parsedBody.error || !parsedBody.data || typeof parsedBody.data !== "object" || Array.isArray(parsedBody.data)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const body = parsedBody.data as Record<string, unknown>;
  const applicationId = typeof body.applicationId === "string" ? body.applicationId.trim() : "";
  const score = typeof body.score === "number" ? body.score : Number.NaN;
  const note = body?.note == null ? null : typeof body.note === "string" ? body.note.trim() : undefined;
  if (!applicationId || applicationId.length > 128 || !Number.isInteger(score) || score < 1 || score > 5 || note === undefined || (note?.length ?? 0) > 2000) {
    return NextResponse.json({ error: "Invalid survey" }, { status: 400 });
  }
  if (!(await checkRateLimit(`applicant-survey:${user.id}`))) {
    return NextResponse.json({ error: "Too many requests, try again later" }, { status: 429 });
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_process_survey", { target_application_id: applicationId, score, survey_note: note ?? undefined });
  if (error) {
    console.error("submit_process_survey failed", error);
    const { body: errorBody, status } = mapRpcError(error, "Could not submit survey");
    return NextResponse.json(errorBody, { status });
  }
  return NextResponse.json({ ok: true });
}
