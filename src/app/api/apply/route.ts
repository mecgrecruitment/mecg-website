import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { normalizePersonInput } from "@/lib/workflow";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const person = normalizePersonInput(body?.name, body?.contact);
  if (!person || body?.consent !== true) return NextResponse.json({ error: "Valid name, contact, and consent are required" }, { status: 400 });
  const { name, contact } = person;
  const cycle = await prisma.rushCycle.findFirst({ where: { status: "OPEN" }, orderBy: { createdAt: "desc" } });
  if (!cycle) return NextResponse.json({ error: "Applications are not currently open" }, { status: 409 });
  const existing = await prisma.application.findFirst({ where: { cycleId: cycle.id, pnm: { contact } } });
  if (existing) {
    return NextResponse.json({ accepted: true }, { status: 202 });
  }
  try {
    const application = await prisma.$transaction(async (tx) => {
      const pnm = await tx.pnm.upsert({ where: { contact }, update: { name }, create: { name, contact } });
      const created = await tx.application.create({ data: { pnmId: pnm.id, cycleId: cycle.id, status: "SUBMITTED" } });
      await tx.auditEvent.create({ data: { cycleId: cycle.id, action: "APPLICATION_SUBMITTED", resource: "Application", resourceId: created.id } });
      return created;
    });
    return NextResponse.json({ portalToken: application.portalToken }, { status: 201 });
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error && (error as { code: string }).code === "P2002") {
      return NextResponse.json({ accepted: true }, { status: 202 });
    }
    throw error;
  }
}
