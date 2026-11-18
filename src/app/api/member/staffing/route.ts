import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { mapRpcErrorVerbose, readJsonBody } from "@/lib/api-route";
import { createClient } from "@/lib/supabase/server";
import { parseAvailabilityInput } from "@/lib/staffing/model";
import { canSubmitAvailability } from "@/lib/staffing/access";

const bad = (error: string) => NextResponse.json({ error }, { status: 400 });

// Saves the caller's own staffing availability for one cycle. The database
// re-checks that the caller is an active member of that cycle (any role but
// PANEL alone); this route refuses obvious outsiders and malformed input first.
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await readJsonBody(request, 16 * 1024);
  if (body.error) return NextResponse.json({ error: "Invalid or oversized form." }, { status: body.error === "too_large" ? 413 : 400 });
  const input = body.data;
  if (!input || typeof input !== "object" || Array.isArray(input)) return bad("Invalid form.");
  const { cycleId, revision, availability } = input as Record<string, unknown>;
  if (typeof cycleId !== "string" || !cycleId || cycleId.length > 100) return bad("Choose a cycle.");
  if (!canSubmitAvailability(user.memberships, cycleId)) return NextResponse.json({ error: "Active membership required." }, { status: 403 });
  if (typeof revision !== "number" || !Number.isSafeInteger(revision) || revision < 0) return bad("Invalid form revision.");
  const parsed = parseAvailabilityInput(availability);
  if (!parsed.ok) return bad(parsed.error);

  const client = await createClient();
  const { data, error } = await client.rpc("save_my_staffing_availability", {
    target_cycle_id: cycleId,
    expected_revision: revision,
    weekly_hours: parsed.value.weeklyHours,
    skills: parsed.value.skills,
    preferred_project_ids: parsed.value.preferredProjectIds,
    notes: parsed.value.notes,
  });
  if (error) {
    const mapped = mapRpcErrorVerbose(error, "Could not save. Reload to check your availability before retrying.");
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
  return NextResponse.json({ ok: true, availability: data });
}
