import { NextRequest, NextResponse } from "next/server";
import { mapRpcError, readJsonBody } from "@/lib/api-route";
import { currentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // rush.create_cycle has no scoping cycleId yet (it's creating one), so this
  // can't be a hasPermission(memberships, cycleId, …) call like sibling admin
  // routes. The RPC itself already requires an active OWNER membership in any
  // cycle and is the authoritative gate (raises 42501 otherwise); this mirrors
  // that same check in the app layer as defense in depth, not a live hole.
  const isOwner = user.memberships.some((membership) => membership.active && membership.role === "OWNER");
  if (!isOwner) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsedBody = await readJsonBody(req, 2 * 1024);
  if (parsedBody.error === "too_large") return NextResponse.json({ error: "Payload is too large" }, { status: 413 });
  if (parsedBody.error || !parsedBody.data || typeof parsedBody.data !== "object" || Array.isArray(parsedBody.data)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const body = parsedBody.data as Record<string, unknown>;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 120) {
    return NextResponse.json({ error: "A cycle name of at most 120 characters is required" }, { status: 400 });
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_cycle", { cycle_name: name });
  if (error) {
    console.error("create_cycle failed", error);
    const { body: errorBody, status } = mapRpcError(error);
    return NextResponse.json(errorBody, { status });
  }
  return NextResponse.json({ id: data }, { status: 201 });
}
