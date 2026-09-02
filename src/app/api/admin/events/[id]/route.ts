import { NextRequest, NextResponse } from "next/server";
import { mapRpcError, readJsonBody } from "@/lib/api-route";
import { currentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";
import { parseOffsetDateTime } from "@/lib/date-time";
import { createClient } from "@/lib/supabase/server";

async function context(id: string) {
  const user = await currentUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const supabase = await createClient();
  const { data: event, error } = await supabase.from("events").select("cycle_id,status,starts_at").eq("id", id).maybeSingle();
  if (error) return { error: NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 }) };
  if (!event) return { error: NextResponse.json({ error: "Event not found" }, { status: 404 }) };
  if (!event.cycle_id || !hasPermission(user.memberships, event.cycle_id, "RECRUITMENT_OPERATIONS")) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { supabase, event };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await context(id);
  if (auth.error) return auth.error;
  const parsed = await readJsonBody(req, 16 * 1024);
  if (parsed.error || !parsed.data || typeof parsed.data !== "object" || Array.isArray(parsed.data)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: parsed.error === "too_large" ? 413 : 400 });
  }
  const body = parsed.data as Record<string, unknown>;
  const startsAt = parseOffsetDateTime(body.startsAt);
  const endsAt = parseOffsetDateTime(body.endsAt);
  const opensAt = parseOffsetDateTime(body.checkinOpensAt);
  const closesAt = parseOffsetDateTime(body.checkinClosesAt);
  if (!startsAt || !endsAt || !opensAt || !closesAt || endsAt <= startsAt || typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "Missing or invalid fields" }, { status: 400 });
  }
  if (auth.event.status === "PUBLISHED" && startsAt.toISOString() !== new Date(auth.event.starts_at).toISOString() && startsAt < new Date()) {
    return NextResponse.json({ error: "A published event cannot be moved into the past" }, { status: 400 });
  }
  const { error } = await auth.supabase.rpc("update_event", {
    target_event_id: id,
    event_name: body.name,
    event_kind: typeof body.kind === "string" ? body.kind : "GENERAL",
    event_location: typeof body.location === "string" ? body.location : "",
    event_visibility: typeof body.visibility === "string" ? body.visibility : "INTERNAL",
    event_starts_at: startsAt.toISOString(), event_ends_at: endsAt.toISOString(),
    opens_at: opensAt.toISOString(), closes_at: closesAt.toISOString(),
  });
  if (error) {
    console.error("update_event failed", error);
    const mapped = mapRpcError(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await context(id);
  if (auth.error) return auth.error;
  const parsed = await readJsonBody(req, 4 * 1024);
  if (parsed.error || !parsed.data || typeof parsed.data !== "object" || Array.isArray(parsed.data)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: parsed.error === "too_large" ? 413 : 400 });
  }
  const reason = (parsed.data as Record<string, unknown>).reason;
  if (typeof reason !== "string" || !reason.trim()) return NextResponse.json({ error: "A cancellation reason is required" }, { status: 400 });
  const { error } = await auth.supabase.rpc("cancel_event", { target_event_id: id, cancellation_reason: reason });
  if (error) {
    console.error("cancel_event failed", error);
    const mapped = mapRpcError(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
  return NextResponse.json({ ok: true });
}
