import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Unauthenticated on purpose (platform health checks cannot sign in), so the
// probe is memoized: hammering this endpoint costs at most one Supabase RPC per
// window instead of one per request. Short enough that a real outage still shows
// up inside a normal check interval.
//
// ponytail: per-instance memo, not shared state. Each serverless instance runs
// its own probe; move it to the DB or a KV if the instance count ever makes that
// a meaningful RPC load.
const CACHE_MS = 10_000;
const PROBE_TIMEOUT_MS = 2_000;

type HealthyResult = { at: number; body: { ok: true; latencyMs: number } };

let cached: HealthyResult | null = null;
let inFlight: Promise<HealthyResult> | null = null;

export async function GET() {
  if (cached && Date.now() - cached.at < CACHE_MS) {
    return NextResponse.json(cached.body, { headers: healthyCacheHeaders() });
  }

  const probe = (inFlight ??= probeSupabase());
  try {
    const result = await probe;
    return NextResponse.json(result.body, { headers: healthyCacheHeaders() });
  } catch (error) {
    console.error("health check failed", error);
    return NextResponse.json({ ok: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  } finally {
    if (inFlight === probe) inFlight = null;
  }
}

async function probeSupabase() {
  const started = Date.now();
  const supabase = await createClient();
  const { error } = await supabase
    .rpc("public_recruitment")
    .abortSignal(AbortSignal.timeout(PROBE_TIMEOUT_MS));
  if (error) throw error;
  return (cached = { at: Date.now(), body: { ok: true, latencyMs: Date.now() - started } });
}

function healthyCacheHeaders() {
  return { "Cache-Control": `public, max-age=${CACHE_MS / 1000}` };
}
