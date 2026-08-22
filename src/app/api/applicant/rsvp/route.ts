import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

async function withUser() {
  const user = await currentUser();
  if (!user) return { user: null, supabase: null };
  return { user, supabase: await createClient() };
}

export async function POST(req: NextRequest) {
  const { user, supabase } = await withUser();
  if (!user || !supabase) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const { error } = await supabase.rpc("rsvp_slot", { target_slot_id: String(body?.slotId ?? "") });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
