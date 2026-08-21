import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";
import { selectAuthorizedCycleId } from "@/lib/cycles";

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const { name, date, checkinOpensAt, checkinClosesAt } = body ?? {};
  const requestedCycleId = typeof body?.cycleId === "string" ? body.cycleId : null;
  const cycleId = selectAuthorizedCycleId(user.memberships, "MANAGE_CYCLE", requestedCycleId);
  if (!cycleId || !hasPermission(user.memberships, cycleId, "MANAGE_CYCLE")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const cycle = await prisma.rushCycle.findUnique({ where: { id: cycleId } });
  if (!cycle || ["CLOSED", "ARCHIVED"].includes(cycle.status)) return NextResponse.json({ error: "This cycle no longer accepts events" }, { status: 409 });

  if (
    typeof name !== "string" ||
    !name.trim() ||
    name.trim().length > 160 ||
    !date ||
    !checkinOpensAt ||
    !checkinClosesAt
  ) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  const eventDate = new Date(date);
  const opensAt = new Date(checkinOpensAt);
  const closesAt = new Date(checkinClosesAt);
  if ([eventDate, opensAt, closesAt].some((value) => Number.isNaN(value.getTime())) || opensAt > closesAt) {
    return NextResponse.json({ error: "Invalid event dates" }, { status: 400 });
  }

  const event = await prisma.$transaction(async (tx) => {
    const created = await tx.event.create({ data: {
      name: name.trim(),
      date: eventDate,
      weight: 0,
      checkinOpensAt: opensAt,
      checkinClosesAt: closesAt,
      cycleId: cycle.id,
      status: "PUBLISHED",
    }});
    await tx.auditEvent.create({ data: { actorId: user.id, cycleId: cycle.id, action: "EVENT_CREATED", resource: "Event", resourceId: created.id } });
    return created;
  });

  return NextResponse.json({ id: event.id }, { status: 201 });
}
