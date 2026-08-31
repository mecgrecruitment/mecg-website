import { NextResponse } from "next/server";
import { mapRpcError } from "@/lib/api-route";
import { currentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";
import { createClient } from "@/lib/supabase/server";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const supabase = await createClient();
  const { data: event, error: eventError } = await supabase.from("events").select("cycle_id").eq("id", id).maybeSingle();
  if (eventError) {
    console.error("event lookup failed", eventError);
    return NextResponse.json({ error: "Event lookup is unavailable, try again" }, { status: 503 });
  }
  if (!event?.cycle_id || !hasPermission(user.memberships, event.cycle_id, "RECRUITMENT_OPERATIONS")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { data, error } = await supabase.rpc("rotate_event_token", { target_event_id: id });
  if (error) {
    console.error("rotate_event_token failed", error);
    const { body, status } = mapRpcError(error);
    return NextResponse.json(body, { status });
  }
  return NextResponse.json({ checkinToken: data });
}
