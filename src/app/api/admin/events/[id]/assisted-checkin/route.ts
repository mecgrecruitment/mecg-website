import { NextRequest, NextResponse } from "next/server";
import { mapRpcError, readJsonBody } from "@/lib/api-route";
import { currentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";
import { createClient } from "@/lib/supabase/server";

const REASON_CODES = new Set([
  "NO_CAMERA",
  "CONNECTIVITY_FAILURE",
  "QR_FAILURE",
  "SIGN_IN_UNAVAILABLE",
  "ACCESSIBILITY_SUPPORT",
]);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: eventId } = await params;
  if (!eventId || eventId.length > 200) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const supabase = await createClient();
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("cycle_id")
    .eq("id", eventId)
    .maybeSingle();
  if (eventError) return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  if (!event.cycle_id || !hasPermission(user.memberships, event.cycle_id, "RECRUITMENT_OPERATIONS")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = await readJsonBody(req, 4 * 1024);
  if (parsed.error || !parsed.data || typeof parsed.data !== "object" || Array.isArray(parsed.data)) {
    return NextResponse.json({ error: parsed.error === "too_large" ? "Payload is too large" : "Invalid payload" }, { status: parsed.error === "too_large" ? 413 : 400 });
  }
  const body = parsed.data as Record<string, unknown>;
  const identifier = typeof body.identifier === "string" ? body.identifier.trim() : "";
  const reasonCode = typeof body.reasonCode === "string" ? body.reasonCode : "";
  if (identifier.length < 2 || identifier.length > 254 || !REASON_CODES.has(reasonCode)) {
    return NextResponse.json({ error: "An exact applicant identifier and reason are required" }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("staff_assisted_check_in", {
    target_event_id: eventId,
    applicant_identifier: identifier,
    reason_code: reasonCode,
  });
  if (error) {
    console.error("staff-assisted check-in failed", error);
    const mapped = mapRpcError(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }

  return NextResponse.json(data, { status: 200 });
}
