import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ROUND_DEFINITIONS } from "@/lib/rubrics";

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const cycleCount = await prisma.rushCycle.count();
  if (
    cycleCount > 0 &&
    !user.memberships.some(
      (membership) => membership.active && membership.role === "OWNER",
    )
  ) {
    return NextResponse.json({ error: "Only an owner can create another cycle" }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 120) return NextResponse.json({ error: "A cycle name of at most 120 characters is required" }, { status: 400 });
  if (await prisma.rushCycle.findFirst({ where: { name } })) {
    return NextResponse.json({ error: "A cycle with this name already exists" }, { status: 409 });
  }

  const cycle = await prisma.$transaction(async (tx) => {
    const created = await tx.rushCycle.create({ data: { name, status: "DRAFT" } });
    await tx.membership.create({
      data: { userId: user.id, cycleId: created.id, role: "OWNER" },
    });
    for (const definition of ROUND_DEFINITIONS) {
      await tx.round.create({
        data: {
          cycleId: created.id,
          kind: definition.kind,
          name: definition.name,
          weight: definition.weight,
          rubric: {
            create: {
              criteria: {
                create: definition.criteria.map(
                  ([key, criterionName, weight, required, description], position) => ({
                    key,
                    name: criterionName,
                    weight,
                    required,
                    description,
                    position,
                  }),
                ),
              },
            },
          },
        },
      });
    }
    await tx.auditEvent.create({
      data: {
        actorId: user.id,
        cycleId: created.id,
        action: "CYCLE_CREATED",
        resource: "RushCycle",
        resourceId: created.id,
      },
    });
    return created;
  });
  return NextResponse.json({ id: cycle.id }, { status: 201 });
}
