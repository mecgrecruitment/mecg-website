import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { mapRpcError, readJsonBody } from "@/lib/api-route";
import { checkRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

const RPC = { CANCEL_RSVP: "cancel_my_event_rsvp", RESCHEDULE_RSVP: "reschedule_my_event_rsvp", CANCEL_BUDDY: "cancel_my_buddy_booking", RESCHEDULE_BUDDY: "reschedule_my_buddy_booking" } as const;
type RpcResult = Promise<{ data: boolean | null; error: { code?: string; message: string } | null }>;

export async function POST(request: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = await readJsonBody(request, 8 * 1024);
  if (parsed.error || !parsed.data || typeof parsed.data !== "object" || Array.isArray(parsed.data)) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  const body = parsed.data as Record<string, unknown>;
  const action = typeof body.action === "string" && body.action in RPC ? body.action as keyof typeof RPC : null;
  const currentSlotId = typeof body.currentSlotId === "string" ? body.currentSlotId.trim() : "";
  const nextSlotId = typeof body.nextSlotId === "string" ? body.nextSlotId.trim() : "";
  if (!action || !currentSlotId || currentSlotId.length > 100 || (action.startsWith("RESCHEDULE") && (!nextSlotId || nextSlotId.length > 100))) return NextResponse.json({ error: "Invalid schedule update" }, { status: 400 });
  if (!(await checkRateLimit(`applicant-schedule:${user.id}`))) return NextResponse.json({ error: "Too many requests, try again later" }, { status: 429 });
  const args: Record<string, string> = action.startsWith("RESCHEDULE")
    ? { current_slot_id: currentSlotId, next_slot_id: nextSlotId }
    : { target_slot_id: currentSlotId };
  const client = await createClient();
  const result = await (client as unknown as { rpc: (name: string, rpcArgs: Record<string, string>) => RpcResult }).rpc(RPC[action], args);
  if (result.error) {
    console.error(`${RPC[action]} failed`, result.error);
    const mapped = mapRpcError(result.error, "Could not update your schedule");
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
  return NextResponse.json({ ok: true });
}
