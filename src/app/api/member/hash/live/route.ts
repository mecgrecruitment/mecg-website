import { NextRequest, NextResponse } from "next/server";
import { mapRpcError } from "@/lib/api-route";
import { currentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/authorization";
import { workspaceCycleSelection } from "@/lib/workspace-cycle-url";
import { canonicalMajor } from "@/lib/major";
import { CLASS_YEAR_LABELS } from "@/lib/workflow";

// The phone follows the projector: it reads which applicant the board is
// presenting and that applicant's grader notes. No counts, ever; the tally is
// board-only and lives behind /api/admin/hash/live.
export async function GET(request: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const selection = workspaceCycleSelection(request.nextUrl.searchParams);
  if (selection.kind === "invalid") return NextResponse.json({ error: "Invalid cohort selection" }, { status: 400 });
  const cycleMembership = user.memberships.find((membership) => membership.active
    && (selection.kind !== "selected" || membership.cycleId === selection.cycleId)
    && hasPermission(user.memberships, membership.cycleId, "WORKSPACE_ACCESS"));
  if (!cycleMembership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const requestedId = request.nextUrl.searchParams.get("applicationId") ?? "";
  if (requestedId.length > 200) return NextResponse.json({ error: "Invalid applicant" }, { status: 400 });
  const supabase = await createClient();
  const [{ data: cycleRow, error: cycleError }, { data: ballot, error: ballotError }] = await Promise.all([
    supabase.from("rush_cycles").select("hash_presenting_application_id").eq("id", cycleMembership.cycleId).single(),
    // The ballot is the visibility boundary: it excludes conflicts, closed stages,
    // ineligible voters/statuses, and applicants with recorded decisions.
    supabase.rpc("hash_ballot", { target_cycle_id: cycleMembership.cycleId }),
  ]);
  if (cycleError) {
    console.error("member hash live failed", cycleError);
    const mapped = mapRpcError(cycleError, "Could not load the hash");
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
  if (ballotError) {
    const mapped = mapRpcError(ballotError, "Could not load the hash");
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
  const row = ballot?.find((applicant) => applicant.id === cycleRow.hash_presenting_application_id);
  const presenting = row ? {
    id: row.id,
    name: row.name,
    meta: [row.major ? canonicalMajor(row.major) : "", row.class_year ? Object.entries(CLASS_YEAR_LABELS).find(([year]) => year === row.class_year)?.[1] ?? row.class_year : ""].filter(Boolean).join(" · "),
    decided: null,
  } : null;
  const presentingId = presenting?.id ?? null;
  // Notes have weaker decision guards than the ballot. Gate explicit requests as
  // well as the presenter so neither can expose an applicant off this ballot.
  const applicationId = requestedId
    ? ballot?.find((applicant) => applicant.id === requestedId)?.id ?? null
    : presentingId;
  let notes: { source: string; note: string }[] = [];
  if (applicationId) {
    const { data, error } = await supabase.rpc("hash_applicant_notes", { target_application_id: applicationId });
    if (error) {
      console.error("hash_applicant_notes failed", error);
      const mapped = mapRpcError(error, "Could not load the notes");
      return NextResponse.json(mapped.body, { status: mapped.status });
    }
    notes = data ?? [];
  }
  return NextResponse.json({ presentingId, presenting, applicationId, notes }, { headers: { "Cache-Control": "no-store" } });
}
