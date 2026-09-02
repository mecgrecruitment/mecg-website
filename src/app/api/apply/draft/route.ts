import { NextRequest, NextResponse } from "next/server";
import { mapRpcError, readJsonBody } from "@/lib/api-route";
import { currentUser } from "@/lib/auth";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { parseApplicationDraft } from "@/lib/workflow";

const MAX_REQUEST_BYTES = 64 * 1024;

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const parsedBody = await readJsonBody(req, MAX_REQUEST_BYTES);
  if (parsedBody.error === "too_large") {
    return NextResponse.json({ error: "Draft payload is too large" }, { status: 413 });
  }
  if (parsedBody.error) {
    return NextResponse.json({ error: "Invalid draft payload" }, { status: 400 });
  }
  const draft = parseApplicationDraft(parsedBody.data);
  if (!draft) return NextResponse.json({ error: "Invalid draft payload" }, { status: 400 });
  const supabase = await createClient();
  const ip = clientIp(req);
  // Same both-buckets rule as /api/apply: the per-user key spares a shared NAT,
  // the IP-only key is the ceiling a per-account key cannot provide. Autosave
  // means far more requests per student, so the IP limit here is sized to the
  // sum of the per-user caps for a full hall
  // (supabase/migrations/20260902160000_apply_ip_rate_limit_ceiling.sql).
  if (!(await checkRateLimit(`apply-draft:${user.id}:${ip}`)) || !(await checkRateLimit(`apply-draft-ip:${ip}`))) {
    return NextResponse.json({ error: "Too many requests, try again later" }, { status: 429 });
  }
  const { error } = await supabase.rpc("save_application_draft", { payload: draft });
  if (error) {
    console.error("save_application_draft failed", error);
    const { body: errorBody, status } = mapRpcError(error, "Could not save draft");
    return NextResponse.json(errorBody, { status });
  }
  return NextResponse.json({ ok: true });
}
