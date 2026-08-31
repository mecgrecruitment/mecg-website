import { NextRequest, NextResponse } from "next/server";
import { mapRpcError, readJsonBody } from "@/lib/api-route";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

const MAX_BODY_BYTES = 8 * 1024;
const MAX_OPTIONAL_LENGTH = 200;

export async function POST(req: NextRequest) {
  const parsed = await readJsonBody(req, MAX_BODY_BYTES);
  if (parsed.error === "too_large") return NextResponse.json({ error: "Payload is too large" }, { status: 413 });
  if (parsed.error || !parsed.data || typeof parsed.data !== "object" || Array.isArray(parsed.data)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const body = parsed.data as Record<string, unknown>;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!name || name.length > 120 || !email || email.length > 254) {
    return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
  }
  const optional: Record<"uniqname" | "classYear" | "howHeard", string | undefined> = { uniqname: undefined, classYear: undefined, howHeard: undefined };
  for (const field of ["uniqname", "classYear", "howHeard"] as const) {
    const value = body[field];
    if (value == null || value === "") continue;
    if (typeof value !== "string" || value.trim().length > MAX_OPTIONAL_LENGTH) {
      return NextResponse.json({ error: "Check the form fields and try again" }, { status: 400 });
    }
    optional[field] = value.trim() || undefined;
  }
  const supabase = await createClient();
  const ip = clientIp(req);
  if (!(await checkRateLimit(`interest:${ip}`))) {
    return NextResponse.json({ error: "Too many requests, try again later" }, { status: 429 });
  }
  const { error } = await supabase.rpc("submit_interest", {
    full_name: name,
    email,
    uniqname: optional.uniqname,
    class_year: optional.classYear,
    how_heard: optional.howHeard,
  });
  if (error) {
    console.error("submit_interest failed", error);
    const { body: errorBody, status } = mapRpcError(error);
    return NextResponse.json(errorBody, { status });
  }
  return NextResponse.json({ ok: true });
}
