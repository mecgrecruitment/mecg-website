import { NextRequest, NextResponse } from "next/server";
import { mapRpcError } from "@/lib/api-route";
import { createClient } from "@/lib/supabase/server";
import { workspaceCycleSelection } from "@/lib/workspace-cycle-url";
import { canonicalMajor } from "@/lib/major";
import { CLASS_YEAR_LABELS } from "@/lib/workflow";

type BallotRow = { id: string; name: string; major: string | null; class_year: string | null };
type Live = { presenting: BallotRow | null; applicationId: string | null; notes: { source: string; note: string }[] };

// The phone follows the projector: it reads which applicant the board is
// presenting and that applicant's grader notes. No counts, ever; the tally is
// board-only and lives behind /api/admin/hash/live. Every member phone polls
// this, so member_hash_live does the membership gate, ballot and notes in one
// database round trip.
export async function GET(request: NextRequest) {
  const selection = workspaceCycleSelection(request.nextUrl.searchParams);
  if (selection.kind === "invalid") return NextResponse.json({ error: "Invalid cohort selection" }, { status: 400 });
  const requestedId = request.nextUrl.searchParams.get("applicationId") ?? "";
  if (requestedId.length > 200) return NextResponse.json({ error: "Invalid applicant" }, { status: 400 });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("member_hash_live", {
    target_cycle_id: selection.kind === "selected" ? selection.cycleId : null,
    target_application_id: requestedId,
  });
  if (error?.code === "28000") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (error) {
    if (error.code !== "42501") console.error("member hash live failed", error);
    const mapped = mapRpcError(error, "Could not load the hash");
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
  const live = data as Live;
  const row = live.presenting;
  const presenting = row ? {
    id: row.id,
    name: row.name,
    meta: [row.major ? canonicalMajor(row.major) : "", row.class_year ? Object.entries(CLASS_YEAR_LABELS).find(([year]) => year === row.class_year)?.[1] ?? row.class_year : ""].filter(Boolean).join(" · "),
    decided: null,
  } : null;
  return NextResponse.json({ presentingId: presenting?.id ?? null, presenting, applicationId: live.applicationId, notes: live.notes }, { headers: { "Cache-Control": "no-store" } });
}
