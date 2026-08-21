import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { selectAuthorizedCycleId } from "@/lib/cycles";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const cycleId = selectAuthorizedCycleId(user.memberships, "MANAGE_CYCLE", typeof body?.cycleId === "string" ? body.cycleId : null);
  if (!cycleId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const dates = [body?.date, body?.checkinOpensAt, body?.checkinClosesAt].map((value) => new Date(value));
  if (typeof body?.name !== "string" || !body.name.trim() || dates.some((date) => Number.isNaN(date.getTime()))) return NextResponse.json({ error: "Missing or invalid fields" }, { status: 400 });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_event", { target_cycle_id: cycleId, event_name: body.name, event_starts_at: dates[0].toISOString(), opens_at: dates[1].toISOString(), closes_at: dates[2].toISOString() });
  if (error) return NextResponse.json({ error: error.message }, { status: error.code === "42501" ? 403 : error.code === "55000" ? 409 : 400 });
  return NextResponse.json(data, { status: 201 });
}
