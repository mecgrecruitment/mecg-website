import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";
import { mapRpcErrorVerbose, readJsonBody } from "@/lib/api-route";
import { createClient } from "@/lib/supabase/server";
import { parseThresholdInput } from "@/lib/standing/model";

const bad = (error: string) => NextResponse.json({ error }, { status: 400 });

// Saves one cycle's member-standing thresholds. The database re-checks that the
// caller is active Board or Owner of that cycle; this route refuses obvious
// non-board callers and malformed input before the round trip.
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await readJsonBody(request, 8 * 1024);
  if (body.error) return NextResponse.json({ error: "Invalid or oversized form." }, { status: body.error === "too_large" ? 413 : 400 });
  const input = body.data;
  if (!input || typeof input !== "object" || Array.isArray(input)) return bad("Invalid form.");
  const { cycleId, revision, thresholds } = input as Record<string, unknown>;
  if (typeof cycleId !== "string" || !cycleId || cycleId.length > 100) return bad("Choose a cycle.");
  if (!hasPermission(user.memberships, cycleId, "MANAGE_CYCLE")) return NextResponse.json({ error: "Board access required." }, { status: 403 });
  if (typeof revision !== "number" || !Number.isSafeInteger(revision) || revision < 0) return bad("Invalid settings revision.");
  const parsed = parseThresholdInput(thresholds);
  if (!parsed.ok) return bad(parsed.error);

  const client = await createClient();
  const { data, error } = await client.rpc("save_member_standing_thresholds", {
    target_cycle_id: cycleId,
    expected_revision: revision,
    min_attendance_pct: parsed.value.minAttendancePct,
    min_projects: parsed.value.minProjects,
    require_onboarding: parsed.value.requireOnboarding,
  });
  if (error) {
    const mapped = mapRpcErrorVerbose(error, "Could not save. Reload to check the current thresholds before retrying.");
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
  return NextResponse.json({ ok: true, thresholds: data });
}
