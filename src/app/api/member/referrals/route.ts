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
  const cycleId = typeof body.cycleId === "string" ? body.cycleId : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const yearMajor = typeof body.yearMajor === "string" ? body.yearMajor.trim() : "";
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!cycleId) return NextResponse.json({ error: "Cycle is required" }, { status: 400 });
  if (!name || name.length > 120) return NextResponse.json({ error: "Name must be 120 characters or fewer" }, { status: 400 });
  if (email.length < 3 || email.length > 255 || !email.includes("@")) return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  if (yearMajor.length > 120) return NextResponse.json({ error: "Year and major must be 120 characters or fewer" }, { status: 400 });
  if (!reason || reason.length > 2000) return NextResponse.json({ error: "Reason must be 1 to 2000 characters" }, { status: 400 });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_referral", {
    target_cycle_id: cycleId,
    referral_name: name,
    referral_email: email,
    referral_year_major: yearMajor,
    referral_reason: reason,
  });
  if (error) {
    console.error("submit_referral failed", error);
    const { body: errorBody, status } = mapRpcError(error, "Referral could not be saved");
    return NextResponse.json(errorBody, { status });
  }
  return NextResponse.json({ id: data }, { status: 201 });
}
