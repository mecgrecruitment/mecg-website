import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const applicationId = typeof body?.applicationId === "string" ? body.applicationId : "";
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  const application = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!application || !reason || reason.length > 1000 || !hasPermission(user.memberships, application.cycleId, "WORKSPACE_ACCESS")) return NextResponse.json({ error: "Invalid declaration" }, { status: 400 });
  await prisma.$transaction(async (tx) => {
    await tx.conflictDeclaration.upsert({ where: { applicationId_declarerId: { applicationId, declarerId: user.id } }, update: { reason }, create: { applicationId, declarerId: user.id, reason } });
    await tx.evaluation.updateMany({ where: { evaluatorId: user.id, assignment: { applicationId }, status: { in: ["DRAFT", "SUBMITTED", "LOCKED"] } }, data: { status: "VOIDED" } });
    await tx.evaluationAssignment.updateMany({ where: { applicationId, evaluatorId: user.id }, data: { status: "RECUSED" } });
    await tx.decisionApproval.deleteMany({ where: { approverId: user.id, decision: { applicationId, status: { in: ["PENDING", "APPROVED", "LOCKED"] } } } });
    const reopened = await tx.decision.updateMany({ where: { applicationId, status: { in: ["APPROVED", "LOCKED"] } }, data: { status: "PENDING", lockedAt: null } });
    if (reopened.count) await tx.application.update({ where: { id: applicationId }, data: { status: "FINAL_REVIEW" } });
    const releasedDecision = await tx.decision.findFirst({ where: { applicationId, status: "RELEASED" }, select: { id: true } });
    await tx.auditEvent.create({ data: { actorId: user.id, cycleId: application.cycleId, action: releasedDecision ? "CONFLICT_DECLARED_AFTER_RELEASE" : "CONFLICT_DECLARED", resource: "Application", resourceId: applicationId, metadata: releasedDecision ? JSON.stringify({ decisionId: releasedDecision.id, requiresReview: true }) : null } });
  });
  return NextResponse.json({ ok: true }, { status: 201 });
}
