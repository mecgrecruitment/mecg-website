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
  const applicationId = typeof body.applicationId === "string" ? body.applicationId.trim() : "";
  if (!applicationId || applicationId.length > 128) {
    return NextResponse.json({ error: "Application ID is required" }, { status: 400 });
  }
  const supabase = await createClient();
  // Ownership and the legal-status check both live in the RPC, which takes a
  // row lock, so two clicks cannot race into a double withdrawal.
  const { error } = await supabase.rpc("withdraw_application", { target_application_id: applicationId });
  if (error) {
    console.error("withdraw_application failed", error);
    const { body: errorBody, status } = mapRpcError(error, "Could not withdraw the application");
    return NextResponse.json(errorBody, { status });
  }
  return NextResponse.json({ ok: true });
}
