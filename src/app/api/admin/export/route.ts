import { NextResponse } from "next/server";
import { mapRpcError } from "@/lib/api-route";
import { currentUser } from "@/lib/auth";
import { selectAuthorizedCycleId } from "@/lib/cycles";
import { createClient } from "@/lib/supabase/server";
import { buildGroupCaseCsv, buildGroupCaseXlsx, parseGroupCaseBackup } from "@/lib/group-case-export";
import { screeningRpc } from "@/lib/screening-rpc";

function csvEscape(value: string) {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const cycleId = selectAuthorizedCycleId(user.memberships, "EXPORT", new URL(req.url).searchParams.get("cycleId"));
  if (!cycleId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const params = new URL(req.url).searchParams;
  if (params.get("kind") === "group-case") {
    const roundId = params.get("roundId")?.trim() ?? "";
    if (!roundId || roundId.length > 100) {
      return NextResponse.json({ error: "A valid Group Case round is required" }, { status: 400 });
    }
    const supabase = await createClient();
    const { data, error } = await screeningRpc(supabase, "export_group_case_backup", {
      target_cycle_id: cycleId,
      target_round_id: roundId,
    });
    if (error) {
      console.error("export_group_case_backup failed", error);
      const { body, status } = mapRpcError(error, "Group Case backup could not be exported");
      return NextResponse.json(body, { status });
    }
    const backup = parseGroupCaseBackup(data);
    if (!backup || backup.cycleId !== cycleId || backup.roundId !== roundId) {
      console.error("export_group_case_backup returned an invalid response");
      return NextResponse.json({ error: "Group Case backup could not be exported" }, { status: 500 });
    }
    const wantsWorkbook = params.get("format") === "xlsx";
    return new NextResponse(wantsWorkbook ? buildGroupCaseXlsx(backup) : buildGroupCaseCsv(backup), {
      headers: {
        "Content-Type": wantsWorkbook ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "text/csv; charset=utf-8",
        "Content-Disposition": wantsWorkbook ? 'attachment; filename="group-case-emergency-backup.xlsx"' : 'attachment; filename="group-case-backup.csv"',
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("export_attendance", { target_cycle_id: cycleId });
  if (error) {
    console.error("export_attendance failed", error);
    const { body, status } = mapRpcError(error);
    return NextResponse.json(body, { status });
  }
  const rows = ["applicant_code,name,status,events_attended", ...(data ?? []).map((row) => [row.applicant_code,row.name,row.status,row.events_attended].map((value) => csvEscape(String(value))).join(","))];
  return new NextResponse(`${rows.join("\n")}\n`, { headers: { "Content-Type": "text/csv", "Content-Disposition": 'attachment; filename="rush-attendance.csv"', "Cache-Control": "no-store" } });
}
