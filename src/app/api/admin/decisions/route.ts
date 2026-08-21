import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";
import { prisma } from "@/lib/db";
import { aggregateRound, scoreEvaluation } from "@/lib/evaluation.js";

const ACTIVE_DECISION_STATES = ["PENDING", "APPROVED", "LOCKED", "RELEASED"];

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);

  if (body?.action === "CREATE") {
    const cycleId = typeof body.cycleId === "string" ? body.cycleId : "";
    const applicationId = typeof body.applicationId === "string" ? body.applicationId : "";
    if (!cycleId || !hasPermission(user.memberships, cycleId, "DECIDE")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const outcome = ["OFFER", "WAITLIST", "REJECT", "PROCEDURAL_REVIEW"].includes(body.outcome) ? body.outcome : null;
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    if (!outcome || !reason || reason.length > 4000) return NextResponse.json({ error: "A valid outcome and reason are required" }, { status: 400 });
    try {
      const decision = await prisma.$transaction(async (tx) => {
        const [application, membership, conflict, cycle, rounds, existing] = await Promise.all([
          tx.application.findFirst({ where: { id: applicationId, cycleId } }),
          tx.membership.findFirst({ where: { userId: user.id, cycleId, active: true, role: { in: ["PANEL", "OWNER"] } } }),
          tx.conflictDeclaration.findUnique({ where: { applicationId_declarerId: { applicationId, declarerId: user.id } } }),
          tx.rushCycle.findUnique({ where: { id: cycleId } }),
          tx.round.findMany({
            where: { cycleId },
            include: {
              rubric: { include: { criteria: true } },
              assignments: {
                where: { applicationId },
                include: { evaluations: { where: { status: { in: ["SUBMITTED", "LOCKED"] } }, include: { ratings: true } } },
              },
            },
          }),
          tx.decision.findFirst({ where: { applicationId, status: { in: ACTIVE_DECISION_STATES } } }),
        ]);
        if (!membership) throw new Error("FORBIDDEN");
        if (conflict) throw new Error("CONFLICT");
        if (!application || !cycle) throw new Error("INVALID");
        if (cycle.status !== "DECISION_LOCK" || rounds.length < 2 || rounds.some((round) => !["FROZEN", "FINALIZED"].includes(round.status))) throw new Error("ROUNDS_OPEN");
        const hasInsufficientEvidence = rounds.some((round) => {
          if (!round.rubric) return true;
          const scored = round.assignments.flatMap((assignment) => assignment.evaluations.map((evaluation) => scoreEvaluation(round.rubric!.criteria, evaluation.ratings)));
          return aggregateRound(scored).status === "PENDING";
        });
        if (hasInsufficientEvidence) throw new Error("INSUFFICIENT_EVIDENCE");
        if (existing) throw new Error("EXISTING_DECISION");
        const created = await tx.decision.create({ data: { cycleId, applicationId, outcome, reason, status: "PENDING", createdById: user.id } });
        await tx.auditEvent.create({ data: { actorId: user.id, cycleId, action: "DECISION_CREATED", resource: "Decision", resourceId: created.id } });
        return created;
      });
      return NextResponse.json({ id: decision.id }, { status: 201 });
    } catch (error) {
      const code = error instanceof Error ? error.message : "INVALID";
      const message = code === "CONFLICT" ? "Conflict prevents this decision" : code === "ROUNDS_OPEN" ? "The cycle must be in Decision Lock with every round frozen" : code === "INSUFFICIENT_EVIDENCE" ? "Every round needs at least two valid evaluations" : code === "EXISTING_DECISION" ? "This applicant already has an active decision" : code === "FORBIDDEN" ? "Forbidden" : "Invalid decision";
      return NextResponse.json({ error: message }, { status: code === "FORBIDDEN" ? 403 : ["EXISTING_DECISION", "ROUNDS_OPEN", "INSUFFICIENT_EVIDENCE"].includes(code) ? 409 : 400 });
    }
  }

  if (body?.action === "APPROVE") {
    const decisionId = typeof body.decisionId === "string" ? body.decisionId : "";
    try {
      const result = await prisma.$transaction(async (tx) => {
        const decision = await tx.decision.findUnique({ where: { id: decisionId } });
        if (!decision) throw new Error("NOT_FOUND");
        const [membership, conflict, cycle] = await Promise.all([
          tx.membership.findFirst({ where: { userId: user.id, cycleId: decision.cycleId, active: true, role: { in: ["PANEL", "OWNER"] } } }),
          tx.conflictDeclaration.findUnique({ where: { applicationId_declarerId: { applicationId: decision.applicationId, declarerId: user.id } } }),
          tx.rushCycle.findUnique({ where: { id: decision.cycleId } }),
        ]);
        if (!membership) throw new Error("FORBIDDEN");
        if (conflict) throw new Error("CONFLICT");
        if (cycle?.status !== "DECISION_LOCK") throw new Error("CYCLE_CLOSED");
        if (!["PENDING", "APPROVED"].includes(decision.status)) throw new Error("LOCKED");
        await tx.decisionApproval.upsert({ where: { decisionId_approverId: { decisionId, approverId: user.id } }, update: {}, create: { decisionId, approverId: user.id } });
        const approvals = await tx.decisionApproval.findMany({ where: { decisionId }, include: { approver: { include: { memberships: { where: { cycleId: decision.cycleId, active: true, role: { in: ["PANEL", "OWNER"] } } } } } } });
        const validApprovals = approvals.filter((approval) => approval.approver.active && approval.approver.memberships.length > 0).length;
        const locked = validApprovals >= 2;
        await tx.decision.update({ where: { id: decisionId }, data: { status: locked ? "LOCKED" : "APPROVED", lockedAt: locked ? new Date() : null } });
        if (locked) await tx.application.update({ where: { id: decision.applicationId }, data: { status: decision.outcome === "OFFER" ? "OFFERED" : decision.outcome === "WAITLIST" ? "WAITLISTED" : decision.outcome === "REJECT" ? "REJECTED" : "FINAL_REVIEW" } });
        await tx.auditEvent.create({ data: { actorId: user.id, cycleId: decision.cycleId, action: locked ? "DECISION_LOCKED" : "DECISION_APPROVED", resource: "Decision", resourceId: decisionId } });
        return { locked, approvals: validApprovals };
      });
      return NextResponse.json(result);
    } catch (error) {
      const code = error instanceof Error ? error.message : "ERROR";
      const message = code === "CONFLICT" ? "Conflict prevents approval" : code === "CYCLE_CLOSED" ? "The cycle is not accepting decisions" : code === "LOCKED" ? "Decision is not open for approval" : code === "NOT_FOUND" ? "Decision not found" : "Forbidden";
      return NextResponse.json({ error: message }, { status: code === "FORBIDDEN" ? 403 : code === "NOT_FOUND" ? 404 : 409 });
    }
  }

  if (body?.action === "RELEASE") {
    const decisionId = typeof body.decisionId === "string" ? body.decisionId : "";
    try {
      await prisma.$transaction(async (tx) => {
        const decision = await tx.decision.findUnique({ where: { id: decisionId } });
        if (!decision) throw new Error("NOT_FOUND");
        const [membership, conflict, approvals] = await Promise.all([
          tx.membership.findFirst({ where: { userId: user.id, cycleId: decision.cycleId, active: true, role: { in: ["PANEL", "OWNER"] } } }),
          tx.conflictDeclaration.findUnique({ where: { applicationId_declarerId: { applicationId: decision.applicationId, declarerId: user.id } } }),
          tx.decisionApproval.findMany({
            where: { decisionId },
            include: {
              approver: {
                include: {
                  memberships: { where: { cycleId: decision.cycleId, active: true, role: { in: ["PANEL", "OWNER"] } } },
                  conflicts: { where: { applicationId: decision.applicationId } },
                },
              },
            },
          }),
        ]);
        if (!membership) throw new Error("FORBIDDEN");
        if (conflict) throw new Error("CONFLICT");
        const validApprovals = approvals.filter((approval) => approval.approver.active && approval.approver.memberships.length > 0 && approval.approver.conflicts.length === 0).length;
        if (decision.status !== "LOCKED" || validApprovals < 2) throw new Error("NOT_LOCKED");
        const updated = await tx.decision.updateMany({ where: { id: decisionId, status: "LOCKED" }, data: { status: "RELEASED", releasedAt: new Date() } });
        if (updated.count !== 1) throw new Error("NOT_LOCKED");
        await tx.auditEvent.create({ data: { actorId: user.id, cycleId: decision.cycleId, action: "DECISION_RELEASED", resource: "Decision", resourceId: decisionId } });
      });
      return NextResponse.json({ ok: true });
    } catch (error) {
      const code = error instanceof Error ? error.message : "ERROR";
      const message = code === "CONFLICT" ? "Conflict prevents release" : code === "NOT_FOUND" ? "Decision not found" : code === "NOT_LOCKED" ? "Only a locked decision with two approvals can be released" : "Forbidden";
      return NextResponse.json({ error: message }, { status: code === "FORBIDDEN" || code === "CONFLICT" ? 403 : code === "NOT_FOUND" ? 404 : 409 });
    }
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
