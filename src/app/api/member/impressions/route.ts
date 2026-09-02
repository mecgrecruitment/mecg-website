import { NextRequest, NextResponse } from "next/server";
import { mapRpcError, readJsonBody } from "@/lib/api-route";
import { currentUser } from "@/lib/auth";
import { screeningRpc } from "@/lib/screening-rpc";
import { createClient } from "@/lib/supabase/server";
import { OBSERVATION_TAGS } from "@/app/member/event/observation-tags";

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
  const note = typeof body.note === "string" ? body.note : null;
  const tags = Array.isArray(body.tags) && body.tags.every((tag): tag is string => typeof tag === "string") ? body.tags : null;
  if (!eventId || !applicationId) return NextResponse.json({ error: "Event and applicant are required" }, { status: 400 });
  if (body.score !== undefined) return NextResponse.json({ error: "Numeric event scores are no longer accepted" }, { status: 400 });
  if (!tags || tags.length > 6 || new Set(tags).size !== tags.length || tags.some((tag) => !OBSERVATION_TAGS.includes(tag))) return NextResponse.json({ error: "Invalid tags" }, { status: 400 });
  if (note === null || note.length > 1000) return NextResponse.json({ error: "Note must be 1000 characters or fewer" }, { status: 400 });
  if (!tags.length && !note.trim()) return NextResponse.json({ error: "Add a tag or observation note" }, { status: 400 });
  const supabase = await createClient();
  const { data, error } = await screeningRpc<string>(supabase, "submit_event_observation", {
    target_event_id: eventId,
    target_application_id: applicationId,
    observation_tags: tags,
    observation_note: note,
  });
  if (error) {
    console.error("submit_event_observation failed", error);
    const { body: errorBody, status } = mapRpcError(error, "Observation could not be saved");
    return NextResponse.json(errorBody, { status });
  }
  return NextResponse.json({ id: data }, { status: 201 });
}
