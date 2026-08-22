import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  if (!name || !email) return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_interest", {
    full_name: name,
    email,
    uniqname: typeof body?.uniqname === "string" ? body.uniqname : undefined,
    class_year: typeof body?.classYear === "string" ? body.classYear : undefined,
    how_heard: typeof body?.howHeard === "string" ? body.howHeard : undefined,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
