import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";
import { prisma } from "@/lib/db";
import { selectAuthorizedCycleId } from "@/lib/cycles";

function csvEscape(value: string) {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const requestedCycleId = new URL(req.url).searchParams.get("cycleId");
  const cycleId = selectAuthorizedCycleId(user.memberships, "EXPORT", requestedCycleId);
  if (!cycleId || !hasPermission(user.memberships, cycleId, "EXPORT")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const cycle = await prisma.rushCycle.findUnique({ where: { id: cycleId } });
  if (!cycle) return NextResponse.json({ error: "Cycle not found" }, { status: 404 });
  const applications = await prisma.application.findMany({
    where: { cycleId: cycle.id },
    include: { pnm: { include: { checkins: { where: { event: { cycleId: cycle.id } } } } } },
    orderBy: { pnm: { name: "asc" } },
  });
  const rows = ["applicant_code,name,status,events_attended", ...applications.map((application) => [application.id, application.pnm.name, application.status, application.pnm.checkins.length].map((value) => csvEscape(String(value))).join(","))];
  await prisma.auditEvent.create({ data: { actorId: user.id, cycleId: cycle.id, action: "ATTENDANCE_EXPORTED", resource: "RushCycle", resourceId: cycle.id } });
  return new NextResponse(`${rows.join("\n")}\n`, { headers: { "Content-Type": "text/csv", "Content-Disposition": 'attachment; filename="rush-attendance.csv"', "Cache-Control": "no-store" } });
}
