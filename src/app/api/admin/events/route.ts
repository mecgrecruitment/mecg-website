import { NextRequest, NextResponse } from "next/server";
import { mapRpcError } from "@/lib/api-route";
import { currentUser } from "@/lib/auth";
import { selectAuthorizedCycleId } from "@/lib/cycles";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const cycleId = selectAuthorizedCycleId(user.memberships, "RECRUITMENT_OPERATIONS", typeof body?.cycleId === "string" ? body.cycleId : null);
  if (!cycleId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const dates = [body?.date, body?.endsAt, body?.checkinOpensAt, body?.checkinClosesAt].map((value) => new Date(value));
  if (typeof body?.name !== "string" || !body.name.trim() || dates.some((date) => Number.isNaN(date.getTime())) || dates[1] <= dates[0]) return NextResponse.json({ error: "Missing or invalid fields" }, { status: 400 });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_event", {
    target_cycle_id: cycleId,
    event_name: body.name,
    event_starts_at: dates[0].toISOString(),
    event_ends_at: dates[1].toISOString(),
    opens_at: dates[2].toISOString(),
    closes_at: dates[3].toISOString(),
    event_kind: typeof body?.kind === "string" ? body.kind : "GENERAL",
    event_location: typeof body?.location === "string" ? body.location : undefined,
    event_visibility: typeof body?.visibility === "string" ? body.visibility : "INTERNAL",
  });
  if (error) {
    console.error("create_event failed", error);
    const { body, status } = mapRpcError(error);
    return NextResponse.json(body, { status });
  }
  return NextResponse.json(data, { status: 201 });
}
