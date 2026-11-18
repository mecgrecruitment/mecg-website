import { NextResponse } from "next/server";
import { readJsonBody } from "@/lib/api-route";
import { checkRateLimitStatus, clientIp } from "@/lib/rate-limit";
import { createPublicClient } from "@/lib/supabase/public";
import { isFeedbackToken, parseFeedbackInput } from "@/lib/engagement/closeout";

const used = "This feedback link has expired or was already used. If you just submitted, your feedback was received.";

// Public: the client has no MECG account. The 256-bit token is the only
// credential; the database stores its digest and accepts it once.
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isFeedbackToken(token)) return NextResponse.json({ error: used }, { status: 404 });
  const body = await readJsonBody(request, 16 * 1024);
  if (body.error) return NextResponse.json({ error: "Check the feedback form." }, { status: body.error === "too_large" ? 413 : 400 });
  const parsed = parseFeedbackInput(body.data);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const limit = await checkRateLimitStatus(`client-feedback:${clientIp(request)}`);
  if (limit === "limited") return NextResponse.json({ error: "Too many attempts. Wait a few minutes and try again. Your answers are still here." }, { status: 429 });
  if (limit === "unavailable") return NextResponse.json({ error: "Feedback is temporarily unavailable. Your answers are still here; try again shortly." }, { status: 503 });

  const { error } = await createPublicClient().rpc("submit_client_feedback", { raw_token: token, payload: parsed.value });
  if (error) {
    if (error.code === "P0002") return NextResponse.json({ error: used }, { status: 410 });
    if (error.code === "55000" && error.message) return NextResponse.json({ error: error.message }, { status: 410 });
    if (error.code === "22023" && error.message) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("submit_client_feedback failed", error.code);
    return NextResponse.json({ error: "We could not confirm your feedback. Your answers are still here; try again shortly." }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
