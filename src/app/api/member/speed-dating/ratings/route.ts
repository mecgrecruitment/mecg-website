import { NextRequest, NextResponse } from "next/server";
import { mapRpcErrorVerbose, readJsonBody } from "@/lib/api-route";
import { currentUser } from "@/lib/auth";
import { screeningRpc } from "@/lib/screening-rpc";
import { createClient } from "@/lib/supabase/server";

export type SpeedDatingRatingResult = { applicationId: string; score: number; note: string; session: number; savedAt: string };

function parseRating(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  // Grading runs as one sitting; the session survives as an optional tag for older rounds.
  const { roundId, applicationId, session = 1, score, note = "" } = value as Record<string, unknown>;
  if (typeof roundId !== "string" || !roundId || roundId.length > 200) return null;
  if (typeof applicationId !== "string" || !applicationId || applicationId.length > 200) return null;
  if (typeof session !== "number" || !Number.isInteger(session) || session < 1 || session > 4) return null;
  if (typeof score !== "number" || !Number.isInteger(score) || score < 1 || score > 5) return null;
  if (typeof note !== "string" || note.length > 2000) return null;
  return { roundId, applicationId, session, score, note };
}

export async function POST(req: NextRequest) {
  if (!(await currentUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsedBody = await readJsonBody(req, 16 * 1024);
  if (parsedBody.error === "too_large") return NextResponse.json({ error: "Payload is too large" }, { status: 413 });
  const rating = parsedBody.error ? null : parseRating(parsedBody.data);
  if (!rating) return NextResponse.json({ error: "Pick a score from 1 to 5" }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await screeningRpc<SpeedDatingRatingResult>(supabase, "rate_speed_dating_applicant", {
    target_round_id: rating.roundId,
    target_application_id: rating.applicationId,
    target_session: rating.session,
    score: rating.score,
    note: rating.note,
  });
  if (error) {
    console.error("rate_speed_dating_applicant failed", error);
    const mapped = mapRpcErrorVerbose(error, "This rating could not be saved");
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
  return NextResponse.json(data);
}
