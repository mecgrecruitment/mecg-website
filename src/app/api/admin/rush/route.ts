import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import {
  canTransitionCycle,
  canTransitionRound,
  normalizePersonInput,
} from "@/lib/workflow";

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const cycleId = typeof body?.cycleId === "string" ? body.cycleId : "";
  if (!cycleId || !hasPermission(user.memberships, cycleId, "MANAGE_CYCLE")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const cycleRecord = await prisma.rushCycle.findUnique({ where: { id: cycleId } });
  if (!cycleRecord) return NextResponse.json({ error: "Cycle not found" }, { status: 404 });

  if (body.action === "ADD_USER") {
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const role = ["MEMBER", "BOARD", "PANEL"].includes(body.role) ? body.role : "MEMBER";
    if (!email || email.length > 254 || !name || name.length > 120 || password.length < 10 || password.length > 1024) {
      return NextResponse.json(
        { error: "A valid name, email, and password between 10 and 1024 characters are required" },
        { status: 400 },
      );
    }
    const isOwner = user.memberships.some(
      (membership) => membership.cycleId === cycleId && membership.active && membership.role === "OWNER",
    );
    if (!isOwner) return NextResponse.json({ error: "Only the cycle owner can grant roles" }, { status: 403 });
    const existingAccount = await prisma.user.findUnique({ where: { email } });
    if (existingAccount?.id === user.id) return NextResponse.json({ error: "You cannot grant a role to yourself" }, { status: 403 });
    const created = await prisma.$transaction(async (tx) => {
      const account = await tx.user.upsert({
        where: { email },
        update: { name, active: true },
        create: { email, name, passwordHash: hashPassword(password) },
      });
      await tx.membership.upsert({
        where: { userId_cycleId_role: { userId: account.id, cycleId, role } },
        update: { active: true },
        create: { userId: account.id, cycleId, role },
      });
      await tx.auditEvent.create({
        data: { actorId: user.id, cycleId, action: "MEMBERSHIP_GRANTED", resource: "User", resourceId: account.id, metadata: JSON.stringify({ role }) },
      });
      return account;
    });
    return NextResponse.json({ id: created.id }, { status: 201 });
  }

  if (body.action === "ADD_APPLICANT") {
    if (!["DRAFT", "OPEN", "IN_PROCESS"].includes(cycleRecord.status)) return NextResponse.json({ error: "This cycle no longer accepts applicants" }, { status: 409 });
    const person = normalizePersonInput(body.name, body.contact);
    if (!person) return NextResponse.json({ error: "Valid name and contact are required" }, { status: 400 });
    const application = await prisma.$transaction(async (tx) => {
      const pnm = await tx.pnm.upsert({
        where: { contact: person.contact },
        update: { name: person.name },
        create: person,
      });
      const created = await tx.application.upsert({
        where: { pnmId_cycleId: { pnmId: pnm.id, cycleId } },
        update: {},
        create: { pnmId: pnm.id, cycleId, status: "IN_PROCESS" },
      });
      await tx.auditEvent.create({
        data: { actorId: user.id, cycleId, action: "APPLICATION_ADDED", resource: "Application", resourceId: created.id },
      });
      return created;
    });
    return NextResponse.json({ id: application.id }, { status: 201 });
  }

  if (body.action === "ASSIGN") {
    if (cycleRecord.status !== "IN_PROCESS") return NextResponse.json({ error: "Assignments can change only while the cycle is in process" }, { status: 409 });
    const roundId = typeof body.roundId === "string" ? body.roundId : "";
    const applicationId = typeof body.applicationId === "string" ? body.applicationId : "";
    const evaluatorId = typeof body.evaluatorId === "string" ? body.evaluatorId : "";
    try {
      const assignment = await prisma.$transaction(async (tx) => {
        const [round, application, membership, conflict, existing] = await Promise.all([
          tx.round.findFirst({ where: { id: roundId, cycleId } }),
          tx.application.findFirst({ where: { id: applicationId, cycleId } }),
          tx.membership.findFirst({ where: { userId: evaluatorId, cycleId, active: true, role: { in: ["MEMBER", "BOARD", "PANEL", "OWNER"] } } }),
          tx.conflictDeclaration.findUnique({ where: { applicationId_declarerId: { applicationId, declarerId: evaluatorId } } }),
          tx.evaluationAssignment.findUnique({ where: { roundId_applicationId_evaluatorId: { roundId, applicationId, evaluatorId } }, include: { _count: { select: { evaluations: true } } } }),
        ]);
        if (!round || !application || !membership || !["DRAFT", "PUBLISHED"].includes(round.status)) throw new Error("INVALID_ASSIGNMENT");
        if (conflict) throw new Error("CONFLICT");
        if (existing) {
          if (existing.status !== "ASSIGNED" || existing._count.evaluations > 0) throw new Error("ASSIGNMENT_LOCKED");
          return existing;
        }
        const created = await tx.evaluationAssignment.create({ data: { roundId, applicationId, evaluatorId } });
        await tx.auditEvent.create({ data: { actorId: user.id, cycleId, action: "EVALUATOR_ASSIGNED", resource: "EvaluationAssignment", resourceId: created.id } });
        return created;
      });
      return NextResponse.json({ id: assignment.id }, { status: 201 });
    } catch (error) {
      const code = error instanceof Error ? error.message : "INVALID_ASSIGNMENT";
      return NextResponse.json(
        { error: code === "CONFLICT" ? "Evaluator has a declared conflict" : code === "ASSIGNMENT_LOCKED" ? "A submitted or recused assignment cannot be reopened" : "Invalid assignment" },
        { status: code === "ASSIGNMENT_LOCKED" ? 409 : 400 },
      );
    }
  }

  if (body.action === "SET_ROUND_STATUS") {
    if (["CLOSED", "ARCHIVED"].includes(cycleRecord.status)) return NextResponse.json({ error: "This cycle is read-only" }, { status: 409 });
    const roundId = typeof body.roundId === "string" ? body.roundId : "";
    const status = ["DRAFT", "PUBLISHED", "ACTIVE", "FROZEN", "FINALIZED"].includes(body.status) ? body.status : null;
    if (!status) return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    const round = await prisma.round.findFirst({ where: { id: roundId, cycleId } });
    if (!round) return NextResponse.json({ error: "Round not found" }, { status: 404 });
    if (status === "ACTIVE" && cycleRecord.status !== "IN_PROCESS") return NextResponse.json({ error: "A round can activate only while the cycle is in process" }, { status: 409 });
    if (["FROZEN", "FINALIZED"].includes(status) && !["IN_PROCESS", "DECISION_LOCK"].includes(cycleRecord.status)) return NextResponse.json({ error: "The cycle is not ready to close this round" }, { status: 409 });
    if (!canTransitionRound(round.status, status)) return NextResponse.json({ error: `Cannot move a round from ${round.status} to ${status}` }, { status: 409 });
    if (round.status === status) return NextResponse.json({ ok: true });
    await prisma.$transaction(async (tx) => {
      await tx.round.update({ where: { id: roundId }, data: { status } });
      if (status === "FROZEN") {
        await tx.evaluation.updateMany({ where: { assignment: { roundId }, status: "SUBMITTED" }, data: { status: "LOCKED" } });
      }
      await tx.auditEvent.create({ data: { actorId: user.id, cycleId, action: "ROUND_STATUS_CHANGED", resource: "Round", resourceId: roundId, metadata: JSON.stringify({ from: round.status, to: status }) } });
    });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "SET_CYCLE_STATUS") {
    const status = ["DRAFT", "OPEN", "IN_PROCESS", "DECISION_LOCK", "CLOSED", "ARCHIVED"].includes(body.status) ? body.status : null;
    if (!status) return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    if (!canTransitionCycle(cycleRecord.status, status)) return NextResponse.json({ error: `Cannot move a cycle from ${cycleRecord.status} to ${status}` }, { status: 409 });
    if (cycleRecord.status === status) return NextResponse.json({ ok: true });
    if (status === "DECISION_LOCK") {
      const openRounds = await prisma.round.count({ where: { cycleId, status: { notIn: ["FROZEN", "FINALIZED"] } } });
      if (openRounds) return NextResponse.json({ error: "Every round must be frozen before Decision Lock" }, { status: 409 });
    }
    await prisma.$transaction([
      prisma.rushCycle.update({ where: { id: cycleId }, data: { status } }),
      prisma.auditEvent.create({ data: { actorId: user.id, cycleId, action: "CYCLE_STATUS_CHANGED", resource: "RushCycle", resourceId: cycleId, metadata: JSON.stringify({ from: cycleRecord.status, to: status }) } }),
    ]);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
