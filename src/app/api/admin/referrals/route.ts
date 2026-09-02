import { NextRequest, NextResponse } from "next/server";
import { mapRpcError, readJsonBody } from "@/lib/api-route";
import { currentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const REFERRAL_STATUSES = new Set(["NEW", "REVIEWED", "INVITED", "PASSED"]);

export async function POST(req: NextRequest) {
  if (!(await currentUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsedBody = await readJsonBody(req, 8 * 1024);
  if (parsedBody.error === "too_large") return NextResponse.json({ error: "Payload is too large" }, { status: 413 });
  if (parsedBody.error || !parsedBody.data || typeof parsedBody.data !== "object" || Array.isArray(parsedBody.data)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const body = parsedBody.data as Record<string, unknown>;
  const referralId = typeof body.referralId === "string" ? body.referralId : "";
  const status = typeof body.status === "string" ? body.status : "";
  if (!referralId) return NextResponse.json({ error: "Referral is required" }, { status: 400 });
  if (!REFERRAL_STATUSES.has(status)) return NextResponse.json({ error: "Invalid referral status" }, { status: 400 });
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_referral_status", {
    target_referral_id: referralId,
    next_status: status,
  });
  if (error) {
    console.error("set_referral_status failed", error);
    const { body: errorBody, status: errorStatus } = mapRpcError(error, "Referral could not be updated");
    return NextResponse.json(errorBody, { status: errorStatus });
  }
  return NextResponse.json({ ok: true });
}
