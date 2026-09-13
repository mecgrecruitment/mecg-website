import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { mapRpcError } from "@/lib/api-route";
import { screeningRpc } from "@/lib/screening-rpc";
import { createClient } from "@/lib/supabase/server";

export async function POST(_: Request, { params }: { params: Promise<{ pairId: string }> }) {
  if (!(await currentUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { pairId } = await params;
  if (!pairId || pairId.length > 200) return NextResponse.json({ error: "Invalid pair" }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await screeningRpc<{ pairId: string; discarded: true }>(
    supabase,
    "discard_speed_dating_group",
    { target_pair_id: pairId },
  );
  if (error) {
    console.error("discard_speed_dating_group failed", error);
    const mapped = mapRpcError(error, "This group cannot be discarded");
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
  return NextResponse.json(data);
}
