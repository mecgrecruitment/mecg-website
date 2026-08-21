import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const existing = await prisma.event.findUnique({ where: { id } });
  if (!existing?.cycleId || !hasPermission(user.memberships, existing.cycleId, "MANAGE_CYCLE")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const event = await prisma.$transaction(async (tx) => {
    const updated = await tx.event.update({ where: { id }, data: { checkinToken: crypto.randomUUID() } });
    await tx.auditEvent.create({ data: { actorId: user.id, cycleId: existing.cycleId, action: "CHECKIN_TOKEN_ROTATED", resource: "Event", resourceId: id } });
    return updated;
  });

  return NextResponse.json({ checkinToken: event.checkinToken });
}
