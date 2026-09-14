import { NextRequest, NextResponse } from "next/server";
import { mapRpcError } from "@/lib/api-route";
import { currentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// The phone follows the projector: it reads which applicant the board is
// presenting and that applicant's grader notes. No counts, ever; the tally is
// board-only and lives behind /api/admin/hash/live.
export async function GET(request: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const cycleMembership = user.memberships.find((membership) => ["MEMBER", "BOARD", "PANEL", "OWNER", "RECRUITMENT_COMMITTEE"].includes(membership.role));
  if (!cycleMembership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const requestedId = request.nextUrl.searchParams.get("applicationId") ?? "";
  if (requestedId.length > 200) return NextResponse.json({ error: "Invalid applicant" }, { status: 400 });
  const supabase = await createClient();
  const { data: cycleRow, error: cycleError } = await supabase.from("rush_cycles").select("hash_presenting_application_id").eq("id", cycleMembership.cycleId).single();
  if (cycleError) {
    console.error("member hash live failed", cycleError);
    const mapped = mapRpcError(cycleError, "Could not load the hash");
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
  const presentingId = cycleRow.hash_presenting_application_id;
  const applicationId = requestedId || presentingId;
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
  return NextResponse.json({ presentingId, applicationId, notes }, { headers: { "Cache-Control": "no-store" } });
}
