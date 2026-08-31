import { NextRequest, NextResponse } from "next/server";
import { mapRpcError, readJsonBody } from "@/lib/api-route";
import { currentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsedBody = await readJsonBody(req, 8 * 1024);
  if (parsedBody.error === "too_large") return NextResponse.json({ error: "Payload is too large" }, { status: 413 });
  if (parsedBody.error || !parsedBody.data || typeof parsedBody.data !== "object" || Array.isArray(parsedBody.data)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const body = parsedBody.data as Record<string, unknown>;
  const slotId = typeof body.slotId === "string" ? body.slotId.trim() : "";
  if (!slotId || slotId.length > 100) return NextResponse.json({ error: "Invalid slot" }, { status: 400 });
  const supabase = await createClient();
  const { error } = await supabase.rpc("rsvp_slot", { target_slot_id: slotId });
  if (error) {
    console.error("rsvp_slot failed", error);
    const { body: errorBody, status } = mapRpcError(error, "Could not reserve slot");
    return NextResponse.json(errorBody, { status });
  }
  return NextResponse.json({ ok: true });
}
