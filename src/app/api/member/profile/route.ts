import { NextRequest, NextResponse } from "next/server";
import { mapRpcError, readJsonBody } from "@/lib/api-route";
import { currentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.slice(0, max) : "";
}

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsedBody = await readJsonBody(req, 8 * 1024);
  if (parsedBody.error === "too_large") return NextResponse.json({ error: "Payload is too large" }, { status: 413 });
  if (parsedBody.error || !parsedBody.data || typeof parsedBody.data !== "object" || Array.isArray(parsedBody.data)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const body = parsedBody.data as Record<string, unknown>;
  const displayName = text(body.displayName, 120).trim();
  if (!displayName) return NextResponse.json({ error: "A display name is required" }, { status: 400 });

  const supabase = await createClient();
  // The RPC writes only the caller's own row, so there is no target to check
  // here beyond having a session.
  const { error } = await supabase.rpc("update_my_profile", {
    display_name: displayName,
    grad_term: text(body.gradTerm, 40),
    major: text(body.major, 120),
    position_title: text(body.position, 120),
    bio: text(body.bio, 1000),
  });
  if (error) {
    console.error("update_my_profile failed", error);
    const { body: errorBody, status } = mapRpcError(error, "Could not save your profile");
    return NextResponse.json(errorBody, { status });
  }
  return NextResponse.json({ ok: true });
}
