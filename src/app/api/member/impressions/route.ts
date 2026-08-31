import { NextRequest, NextResponse } from "next/server";
import { mapRpcError, readJsonBody } from "@/lib/api-route";
import { currentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { IMPRESSION_TAGS } from "@/lib/impressions";

export async function POST(req: NextRequest) {
  if (!(await currentUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsedBody = await readJsonBody(req, 8 * 1024);
  if (parsedBody.error === "too_large") return NextResponse.json({ error: "Payload is too large" }, { status: 413 });
  if (parsedBody.error || !parsedBody.data || typeof parsedBody.data !== "object" || Array.isArray(parsedBody.data)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const body = parsedBody.data as Record<string, unknown>;
  const eventId = typeof body.eventId === "string" ? body.eventId : "";
  const applicationId = typeof body.applicationId === "string" ? body.applicationId : "";
  const score = body.score;
  const note = typeof body.note === "string" ? body.note : null;
  const tags = Array.isArray(body.tags) && body.tags.every((tag): tag is string => typeof tag === "string") ? body.tags : null;
  if (!eventId || !applicationId) return NextResponse.json({ error: "Event and applicant are required" }, { status: 400 });
  if (typeof score !== "number" || !Number.isInteger(score) || score < 1 || score > 5) return NextResponse.json({ error: "Score must be a whole number from 1 to 5" }, { status: 400 });
  if (!tags || tags.some((tag) => !IMPRESSION_TAGS.includes(tag))) return NextResponse.json({ error: "Invalid tags" }, { status: 400 });
  if (note === null || note.length > 1000) return NextResponse.json({ error: "Note must be 1000 characters or fewer" }, { status: 400 });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_event_impression", {
    target_event_id: eventId,
    target_application_id: applicationId,
    impression_score: score,
    impression_tags: tags,
    impression_note: note,
  });
  if (error) {
    console.error("submit_event_impression failed", error);
    const { body: errorBody, status } = mapRpcError(error, "Impression could not be saved");
    return NextResponse.json(errorBody, { status });
  }
  return NextResponse.json({ id: data }, { status: 201 });
}
