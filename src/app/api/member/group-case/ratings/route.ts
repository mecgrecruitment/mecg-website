import { NextRequest, NextResponse } from "next/server";
import { mapRpcErrorVerbose, readJsonBody } from "@/lib/api-route";
import { currentUser } from "@/lib/auth";
import { screeningRpc } from "@/lib/screening-rpc";
import { createClient } from "@/lib/supabase/server";

export type GroupCaseRatingResult = { applicationId: string; scores: Record<string, number | null>; note: string; savedAt: string };

function isScore(value: unknown) {
  return value === null || (typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5);
}

function parseRating(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const { roundId, applicationId, scores, note = "" } = value as Record<string, unknown>;
  if (typeof roundId !== "string" || !roundId || roundId.length > 200) return null;
  if (typeof applicationId !== "string" || !applicationId || applicationId.length > 200) return null;
  if (!scores || typeof scores !== "object" || Array.isArray(scores)) return null;
  const entries = Object.entries(scores);
  if (entries.length < 1 || entries.length > 20) return null;
  if (!entries.every(([id, score]) => id && id.length <= 200 && isScore(score))) return null;
  if (typeof note !== "string" || note.length > 4000) return null;
  return { roundId, applicationId, scores: scores as Record<string, number | null>, note };
}

export async function POST(req: NextRequest) {
  if (!(await currentUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsedBody = await readJsonBody(req, 16 * 1024);
  if (parsedBody.error === "too_large") return NextResponse.json({ error: "Payload is too large" }, { status: 413 });
  const rating = parsedBody.error ? null : parseRating(parsedBody.data);
  if (!rating) return NextResponse.json({ error: "Pick a score from 1 to 5" }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await screeningRpc<GroupCaseRatingResult>(supabase, "rate_group_case_applicant", {
    target_round_id: rating.roundId,
    target_application_id: rating.applicationId,
    scores: rating.scores,
    note: rating.note,
  });
  if (error) {
    console.error("rate_group_case_applicant failed", error);
    const mapped = mapRpcErrorVerbose(error, "This rating could not be saved");
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
  return NextResponse.json(data);
}
