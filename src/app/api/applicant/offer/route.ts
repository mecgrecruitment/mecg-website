import { NextRequest, NextResponse } from "next/server";
import { mapRpcError, readJsonBody } from "@/lib/api-route";
import { currentUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
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
  if (!applicationId || applicationId.length > 128 || typeof body?.accept !== "boolean") {
    return NextResponse.json({ error: "Application ID and boolean accept are required" }, { status: 400 });
  }
  if (!(await checkRateLimit(`applicant-offer:${user.id}`))) {
    return NextResponse.json({ error: "Too many requests, try again later" }, { status: 429 });
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("respond_to_offer", { target_application_id: applicationId, accept: body.accept });
  if (error) {
    console.error("respond_to_offer failed", error);
    const { body: errorBody, status } = mapRpcError(error, "Could not respond to offer");
    return NextResponse.json(errorBody, { status });
  }
  return NextResponse.json({ ok: true });
}
