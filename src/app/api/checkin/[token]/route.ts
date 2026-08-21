import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isCheckinWindowOpen } from "@/lib/rush.js";
import { normalizePersonInput } from "@/lib/workflow";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const event = await prisma.event.findUnique({ where: { checkinToken: token }, include: { cycle: true } });
  if (!event || !["PUBLISHED", "OPEN"].includes(event.status) || (event.cycle && ["CLOSED", "ARCHIVED"].includes(event.cycle.status))) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  if (!isCheckinWindowOpen(event, new Date())) {
    return NextResponse.json({ error: "Check-in is not open for this event" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const person = normalizePersonInput(body?.name, body?.contact);
  if (!person) {
    return NextResponse.json({ error: "Valid name and contact are required" }, { status: 400 });
  }

  const pnm = await prisma.pnm.upsert({
    where: { contact: person.contact },
    update: {},
    create: person,
  });

  try {
    await prisma.$transaction(async (tx) => {
      const checkin = await tx.checkin.create({
        data: { pnmId: pnm.id, eventId: event.id },
      });
      await tx.auditEvent.create({
        data: {
          cycleId: event.cycleId,
          action: "APPLICANT_CHECKED_IN",
          resource: "Checkin",
          resourceId: checkin.id,
        },
      });
    });
  } catch (err: unknown) {
    // Prisma unique constraint violation on [pnmId, eventId].
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      return NextResponse.json({ alreadyCheckedIn: true }, { status: 200 });
    }
    throw err;
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
