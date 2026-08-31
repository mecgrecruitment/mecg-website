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

let cached: { at: number; body: { ok: boolean; latencyMs?: number }; status: number } | null = null;

export async function GET() {
  if (cached && Date.now() - cached.at < CACHE_MS) {
    return NextResponse.json(cached.body, { status: cached.status, headers: cacheHeaders() });
  }

  const started = Date.now();
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("public_recruitment");
    if (error) throw error;
    cached = { at: Date.now(), body: { ok: true, latencyMs: Date.now() - started }, status: 200 };
  } catch (error) {
    console.error("health check failed", error);
    cached = { at: Date.now(), body: { ok: false }, status: 503 };
  }
  return NextResponse.json(cached.body, { status: cached.status, headers: cacheHeaders() });
}

function cacheHeaders() {
  return { "Cache-Control": `public, max-age=${CACHE_MS / 1000}` };
}
