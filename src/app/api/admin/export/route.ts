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

// Shape of the speed_dating_results RPC, limited to what the exports read.
type SpeedDatingResultsPayload = {
  applicants: Array<{
    name: string;
    status: string;
    mean: number | null;
    median: number | null;
    count: number;
    stddev: number | null;
    adjusted: number | null;
    histogram: number[];
    thin: boolean;
    split: boolean;
    scores: Array<{ evaluatorName: string; session: number | null; score: number; note: string; submittedAt: string }>;
  }>;
};

function csvCell(value: unknown) {
  if (value == null) return "";
  if (typeof value === "boolean") return value ? "yes" : "no";
  return csvEscape(String(value));
}

function csvBody(header: string, rows: unknown[][]) {
  return `${[header, ...rows.map((row) => row.map(csvCell).join(","))].join("\n")}\n`;
}

function csvResponse(body: string, filename: string) {
  return new NextResponse(body, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "no-store" },
  });
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
  const kind = params.get("kind");
  if (kind === "speed-dating-summary" || kind === "speed-dating-scores") {
    const roundId = params.get("roundId")?.trim() ?? "";
    if (!roundId || roundId.length > 200) {
      return NextResponse.json({ error: "A valid Speed Dating round is required" }, { status: 400 });
    }
    const supabase = await createClient();
    const { data: round, error: roundError } = await supabase.from("rounds").select("id,cycle_id,kind").eq("id", roundId).maybeSingle();
    if (roundError) {
      console.error("rounds lookup failed", roundError);
      return NextResponse.json({ error: "Speed Dating results could not be exported" }, { status: 500 });
    }
    if (!round || round.cycle_id !== cycleId || round.kind !== "SPEED_DATING") {
      return NextResponse.json({ error: "Speed Dating round not found" }, { status: 404 });
    }
    const { data, error } = await screeningRpc<SpeedDatingResultsPayload>(supabase, "speed_dating_results", { target_round_id: roundId });
    if (error || !data) {
      console.error("speed_dating_results failed", error);
      const { body, status } = mapRpcError(error ?? {}, "Speed Dating results could not be exported");
      return NextResponse.json(body, { status });
    }
    if (kind === "speed-dating-summary") {
      const rows = data.applicants.map((a, index) => [
        index + 1, a.name, a.status, a.adjusted, a.mean, a.median, a.count, a.stddev, ...[0, 1, 2, 3, 4].map((i) => a.histogram?.[i] ?? 0), a.thin, a.split,
      ]);
      return csvResponse(csvBody("rank,name,status,adjusted,mean,median,graders,spread,stars_1,stars_2,stars_3,stars_4,stars_5,thin,split", rows), "speed-dating-summary.csv");
    }
    const rows = data.applicants.flatMap((a) => a.scores.map((s) => [a.name, s.evaluatorName, s.score, s.note, s.session, s.submittedAt]));
    return csvResponse(csvBody("applicant,grader,score,note,session,submitted_at", rows), "speed-dating-scores.csv");
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
