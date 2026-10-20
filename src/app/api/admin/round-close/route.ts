import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";
import { parseRoundCloseSummary } from "@/lib/round-close-summary";
import { createClient } from "@/lib/supabase/server";

function reply(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(req: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) return reply({ error: "Unauthorized" }, 401);
    const ids = req.nextUrl.searchParams.getAll("roundId");
    const roundId = ids[0] ?? "";
    if (ids.length !== 1 || !roundId || roundId.length > 200 || roundId.trim() !== roundId) {
      return reply({ error: "A round is required" }, 400);
    }
    const supabase = await createClient();
    // The caller's RLS-scoped row owns cycle identity. An absent/invisible round
    // is not distinguishable here, and a query-string cycle is never trusted.
    const { data: round, error: roundError } = await supabase.from("rounds")
      .select("id,cycle_id").eq("id", roundId).maybeSingle();
    if (roundError) {
      return roundError.code === "42501"
        ? reply({ error: "Forbidden" }, 403)
        : reply({ error: "Round readiness is unavailable. Try again." }, 503);
    }
    if (!round) return reply({ error: "Round not found" }, 404);
    if (!hasPermission(user.memberships, round.cycle_id, "MANAGE_CYCLE")) {
      return reply({ error: "Forbidden" }, 403);
    }
    // The RPC rechecks current actor permission and computes coverage directly
    // from the database; cached UI counts never become close-grading evidence.
    const { data, error } = await supabase.rpc("round_close_summary", { target_round_id: roundId });
    if (error) {
      if (error.code === "42501") return reply({ error: "Forbidden" }, 403);
      if (error.code === "P0002") return reply({ error: "Round not found" }, 404);
      return reply({ error: "Round readiness is unavailable. Try again." }, 503);
    }
    const summary = parseRoundCloseSummary(data);
    if (!summary || summary.roundId !== roundId) return reply({ error: "Round readiness is unavailable. Try again." }, 503);
    return reply(summary, 200);
  } catch {
    // No provider errors, request headers or applicant information cross this boundary.
    return reply({ error: "Round readiness is unavailable. Try again." }, 503);
  }
}
