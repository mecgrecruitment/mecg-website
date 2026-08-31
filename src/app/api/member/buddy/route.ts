import { NextRequest, NextResponse } from "next/server";
import { mapRpcError } from "@/lib/api-route";
import { currentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_buddy_slot", {
    target_cycle_id: String(body?.cycleId ?? ""),
    slot_starts_at: String(body?.startsAt ?? ""),
    slot_ends_at: String(body?.endsAt ?? ""),
  });
  if (error) {
    console.error("create_buddy_slot failed", error);
    const { body: errorBody, status } = mapRpcError(error);
    return NextResponse.json(errorBody, { status });
  }
  return NextResponse.json({ ok: true });
}
