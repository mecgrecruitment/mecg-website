import { NextRequest, NextResponse } from "next/server";
import { mapRpcError } from "@/lib/api-route";
import { currentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canonicalMajor } from "@/lib/major";
import { CLASS_YEAR_LABELS, type ClassYear } from "@/lib/workflow";
import { applicationStatusLabel } from "@/lib/labels";

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
  // The projector can sit on someone the board already stamped, who is off the
  // member's ballot. The phone still needs a name to pin, so read it here with
  // the service role: it is the applicant on the wall, not a secret.
  let presenting: { id: string; name: string; meta: string; decided: string | null } | null = null;
  if (presentingId) {
    const { data: row } = await createAdminClient().from("applications").select("id,status,pnms!inner(name,major,class_year)").eq("id", presentingId).eq("cycle_id", cycleMembership.cycleId).maybeSingle();
    if (row) {
      const pnm = row.pnms;
      presenting = {
        id: row.id,
        name: pnm.name,
        meta: [pnm.major ? canonicalMajor(pnm.major) : "", pnm.class_year ? CLASS_YEAR_LABELS[pnm.class_year as ClassYear] ?? pnm.class_year : ""].filter(Boolean).join(" · "),
        decided: ["IN_PROCESS", "REJECTED", "OFFERED", "WAITLISTED"].includes(row.status) ? applicationStatusLabel(row.status) : null,
      };
    }
  }
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
  return NextResponse.json({ presentingId, presenting, applicationId, notes }, { headers: { "Cache-Control": "no-store" } });
}
