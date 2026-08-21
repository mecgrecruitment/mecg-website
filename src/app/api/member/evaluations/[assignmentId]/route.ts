import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { scoreEvaluation } from "@/lib/evaluation.js";
import { hasPermission } from "@/lib/authorization";
import { hasExactCriterionSet } from "@/lib/workflow";

type SubmittedRating = { criterionId?: unknown; score?: unknown; note?: unknown };

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ assignmentId: string }> },
) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { assignmentId } = await context.params;
  const assignment = await prisma.evaluationAssignment.findFirst({
    where: { id: assignmentId, evaluatorId: user.id },
    include: {
      round: { include: { rubric: { include: { criteria: { orderBy: { position: "asc" } } } } } },
      application: true,
      evaluations: true,
    },
  });
  if (!assignment || !assignment.round.rubric) return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
  if (!hasPermission(user.memberships, assignment.round.cycleId, "EVALUATE")) return NextResponse.json({ error: "Your evaluator role is not active" }, { status: 403 });
  if (assignment.status !== "ASSIGNED") return NextResponse.json({ error: "This assignment is not open" }, { status: 409 });
  if (assignment.round.status !== "ACTIVE") return NextResponse.json({ error: "This round is not accepting evaluations" }, { status: 409 });
  if (assignment.round.closesAt && assignment.round.closesAt < new Date()) return NextResponse.json({ error: "The evaluation deadline has passed" }, { status: 409 });
  if (assignment.evaluations.some((evaluation) => evaluation.status === "SUBMITTED" || evaluation.status === "LOCKED")) {
    return NextResponse.json({ error: "This evaluation was already submitted" }, { status: 409 });
  }
  const conflict = await prisma.conflictDeclaration.findUnique({
    where: { applicationId_declarerId: { applicationId: assignment.applicationId, declarerId: user.id } },
  });
  if (conflict) return NextResponse.json({ error: "You declared a conflict for this applicant" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const submittedRatings: SubmittedRating[] = Array.isArray(body?.ratings) ? body.ratings : [];
  const criteriaById = new Map(assignment.round.rubric.criteria.map((criterion) => [criterion.id, criterion]));
  const submittedCriterionIds = submittedRatings.map((rating) => rating.criterionId).filter((value): value is string => typeof value === "string");
  if (!hasExactCriterionSet([...criteriaById.keys()], submittedCriterionIds)) {
    return NextResponse.json({ error: "Every criterion must appear exactly once" }, { status: 400 });
  }
  const ratings = submittedRatings
    .filter((rating): rating is SubmittedRating & { criterionId: string } =>
      typeof rating.criterionId === "string" && criteriaById.has(rating.criterionId),
    )
    .map((rating) => ({
      criterionId: rating.criterionId as string,
      score: rating.score === null ? null : Number(rating.score),
      note: typeof rating.note === "string" ? rating.note.trim() : "",
    }));
  if (ratings.length !== assignment.round.rubric.criteria.length) {
    return NextResponse.json({ error: "Every criterion must be rated or marked not observed" }, { status: 400 });
  }
  if (ratings.some((rating) => rating.score !== null && (!Number.isInteger(rating.score) || rating.score < 1 || rating.score > 5))) {
    return NextResponse.json({ error: "Scores must be 1 through 5 or not observed" }, { status: 400 });
  }
  if (ratings.some((rating) => [1, 2, 5].includes(rating.score ?? 0) && !rating.note)) {
    return NextResponse.json({ error: "Scores of 1, 2, and 5 require an evidence note" }, { status: 400 });
  }
  const scored = scoreEvaluation(assignment.round.rubric.criteria, ratings);
  if (!scored.valid) return NextResponse.json({ error: "Required criteria or observation coverage is missing" }, { status: 400 });

  try {
    const evaluation = await prisma.$transaction(async (tx) => {
      const [liveAssignment, liveMembership, liveConflict] = await Promise.all([
        tx.evaluationAssignment.findUnique({ where: { id: assignmentId }, include: { round: true, _count: { select: { evaluations: true } } } }),
        tx.membership.findFirst({ where: { userId: user.id, cycleId: assignment.round.cycleId, active: true, role: { in: ["MEMBER", "BOARD", "PANEL", "OWNER"] } } }),
        tx.conflictDeclaration.findUnique({ where: { applicationId_declarerId: { applicationId: assignment.applicationId, declarerId: user.id } } }),
      ]);
      if (!liveMembership) throw new Error("ROLE_REVOKED");
      if (liveConflict) throw new Error("CONFLICT");
      if (!liveAssignment || liveAssignment.status !== "ASSIGNED" || liveAssignment._count.evaluations > 0 || liveAssignment.round.status !== "ACTIVE") throw new Error("ASSIGNMENT_CLOSED");
      const created = await tx.evaluation.create({
        data: {
          assignmentId,
          evaluatorId: user.id,
          rubricId: assignment.round.rubric!.id,
          status: "SUBMITTED",
          submittedAt: new Date(),
          evidence: typeof body?.evidence === "string" ? body.evidence.trim().slice(0, 4000) : null,
          ratings: { create: ratings.map((rating) => ({ ...rating, note: rating.note.slice(0, 2000) })) },
        },
      });
      await tx.evaluationAssignment.update({ where: { id: assignmentId }, data: { status: "SUBMITTED" } });
      await tx.auditEvent.create({ data: { actorId: user.id, cycleId: assignment.round.cycleId, action: "EVALUATION_SUBMITTED", resource: "Evaluation", resourceId: created.id } });
      return created;
    });
    return NextResponse.json({ id: evaluation.id, score: scored.score }, { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "ASSIGNMENT_CLOSED";
    return NextResponse.json(
      { error: code === "ROLE_REVOKED" ? "Your evaluator role is not active" : code === "CONFLICT" ? "You declared a conflict for this applicant" : "This assignment is no longer open" },
      { status: code === "ROLE_REVOKED" || code === "CONFLICT" ? 403 : 409 },
    );
  }
}
