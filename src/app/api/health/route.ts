import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const started = Date.now();
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("public_recruitment");
    if (error) throw error;
    return NextResponse.json({ ok: true, latencyMs: Date.now() - started });
  } catch (error) {
    console.error("health check failed", error);
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
