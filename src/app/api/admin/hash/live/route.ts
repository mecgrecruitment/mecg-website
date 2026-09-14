import { NextResponse } from "next/server";
import { mapRpcError } from "@/lib/api-route";
import { currentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";
import { selectAuthorizedCycleId } from "@/lib/cycles";
import { createClient } from "@/lib/supabase/server";

// The deck polls this while the board presents. Counts stay board-side: the
// member phone reads /api/member/hash/live, which never carries a tally.
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const cycleId = selectAuthorizedCycleId(user.memberships, "HASH_PANEL_ACCESS") ?? selectAuthorizedCycleId(user.memberships, "MANAGE_CYCLE");
  if (!cycleId || !(hasPermission(user.memberships, cycleId, "HASH_PANEL_ACCESS") || hasPermission(user.memberships, cycleId, "MANAGE_CYCLE"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const supabase = await createClient();
  const [cycleResult, tallyResult] = await Promise.all([
    supabase.from("rush_cycles").select("hash_presenting_application_id").eq("id", cycleId).single(),
    supabase.rpc("hash_tally", { target_cycle_id: cycleId }),
  ]);
  const error = cycleResult.error ?? tallyResult.error;
  if (error) {
    console.error("admin hash live failed", error);
    const mapped = mapRpcError(error, "Could not load the live tally");
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
  return NextResponse.json(
    {
      presentingId: cycleResult.data?.hash_presenting_application_id ?? null,
      tally: (tallyResult.data ?? []).map((row) => ({
        applicationId: row.application_id,
        yes: row.yes_count,
        no: row.no_count,
        unsure: row.unsure_count,
        total: row.total_votes,
        quorum: row.quorum,
        outcome: row.outcome,
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
