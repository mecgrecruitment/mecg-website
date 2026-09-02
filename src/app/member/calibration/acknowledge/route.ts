import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { mapRpcError, readJsonBody } from "@/lib/api-route";
import { screeningRpc } from "@/lib/screening-rpc";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  if (!(await currentUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = await readJsonBody(request, 8 * 1024);
  if (parsed.error === "too_large") return NextResponse.json({ error: "Payload is too large" }, { status: 413 });
  if (parsed.error || !parsed.data || typeof parsed.data !== "object" || Array.isArray(parsed.data)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const body = parsed.data as Record<string, unknown>;
  const roundId = typeof body.roundId === "string" ? body.roundId : "";
  const rubricId = typeof body.rubricId === "string" ? body.rubricId : "";
  if (!roundId || !rubricId || roundId.length > 200 || rubricId.length > 200) {
    return NextResponse.json({ error: "Round and rubric are required" }, { status: 400 });
  }
  const { data, error } = await screeningRpc<string>(await createClient(), "acknowledge_round_calibration", {
    target_round_id: roundId,
    target_rubric_id: rubricId,
  });
  if (error) {
    const mapped = mapRpcError(error, "Calibration acknowledgement could not be saved");
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
  return NextResponse.json({ acknowledgedAt: data });
}
