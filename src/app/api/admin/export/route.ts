import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { selectAuthorizedCycleId } from "@/lib/cycles";
import { createClient } from "@/lib/supabase/server";

function csvEscape(value: string) {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const cycleId = selectAuthorizedCycleId(user.memberships, "EXPORT", new URL(req.url).searchParams.get("cycleId"));
  if (!cycleId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("export_attendance", { target_cycle_id: cycleId });
  if (error) return NextResponse.json({ error: error.message }, { status: error.code === "42501" ? 403 : 400 });
  const rows = ["applicant_code,name,status,events_attended", ...(data ?? []).map((row) => [row.applicant_code,row.name,row.status,row.events_attended].map((value) => csvEscape(String(value))).join(","))];
  return new NextResponse(`${rows.join("\n")}\n`, { headers: { "Content-Type": "text/csv", "Content-Disposition": 'attachment; filename="rush-attendance.csv"', "Cache-Control": "no-store" } });
}
