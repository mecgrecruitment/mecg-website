import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";
import { selectAuthorizedCycleId } from "@/lib/cycles";
import { createClient } from "@/lib/supabase/server";
import { mapRpcError } from "@/lib/api-route";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!selectAuthorizedCycleId(user.memberships, "MANAGE_MEMBERSHIPS")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Invalid incident reference" }, { status: 400 });
  try {
    const supabase = await createClient();
    // Caller RLS and the incident's real cycle are authoritative; no client cycle
    // or provider identity is accepted by this action.
    const { data: incident, error: lookupError } = await supabase.from("provisioning_incidents")
      .select("id,cycle_id").eq("id", id).maybeSingle();
    if (lookupError) {
      return NextResponse.json({ error: "The incident could not be loaded. Try again." }, { status: 503 });
    }
    if (!incident) return NextResponse.json({ error: "Incident unavailable" }, { status: 404 });
    if (!hasPermission(user.memberships, incident.cycle_id, "MANAGE_MEMBERSHIPS")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { error } = await supabase.rpc("resolve_provisioning_incident", { target_incident_id: id });
    if (error) {
      const mapped = mapRpcError(error, "Resolution was not recorded. Review the incident and try again.");
      return NextResponse.json(mapped.body, { status: mapped.status });
    }
    return NextResponse.json({ resolved: true });
  } catch {
    return NextResponse.json({ error: "Resolution could not be recorded. Reload the incident and try again." }, { status: 503 });
  }
}
