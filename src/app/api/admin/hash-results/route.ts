import { NextRequest, NextResponse } from "next/server";
import { mapRpcError, readJsonBody } from "@/lib/api-route";
import { currentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  if (!(await currentUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsedBody = await readJsonBody(req, 8 * 1024);
  if (parsedBody.error === "too_large") return NextResponse.json({ error: "Payload is too large" }, { status: 413 });
  if (parsedBody.error || !parsedBody.data || typeof parsedBody.data !== "object" || Array.isArray(parsedBody.data)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const body = parsedBody.data as Record<string, unknown>;
  const applicationId = typeof body.applicationId === "string" ? body.applicationId : "";
  if (!applicationId) return NextResponse.json({ error: "Applicant is required" }, { status: 400 });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("apply_hash_result", { target_application_id: applicationId });
  if (error) {
    console.error("apply_hash_result failed", error);
    const { body: errorBody, status } = mapRpcError(error, "Result could not be applied");
    return NextResponse.json(errorBody, { status });
  }
  return NextResponse.json({ id: data }, { status: 201 });
}
