import { NextRequest, NextResponse } from "next/server";
import { mapRpcError } from "@/lib/api-route";
import { currentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  if (!(await currentUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 120) {
    return NextResponse.json({ error: "A cycle name of at most 120 characters is required" }, { status: 400 });
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_cycle", { cycle_name: name });
  if (error) {
    console.error("create_cycle failed", error);
    const { body, status } = mapRpcError(error);
    return NextResponse.json(body, { status });
  }
  return NextResponse.json({ id: data }, { status: 201 });
}
