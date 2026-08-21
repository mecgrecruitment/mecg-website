import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";
import { prisma } from "@/lib/db";
import { aggregateRound, combineRoundScores, scoreEvaluation } from "@/lib/evaluation.js";
import LogoutButton from "./logout-button";
import SetupForm from "./setup-form";
import RushControls from "./rush-controls";
import DecisionForm, { ApprovalButton, ReleaseButton } from "./decision-form";
import { selectAuthorizedCycleId } from "@/lib/cycles";

export default async function AdminDashboard() {
  const user = await requireUser();
  const cycleCount = await prisma.rushCycle.count();
  if (!cycleCount) {
    return <main className="mx-auto flex max-w-5xl flex-col gap-8 p-8"><header className="flex items-center justify-between"><div><h1 className="text-2xl font-semibold">MECG rush setup</h1><p className="text-gray-600">Signed in as {user.name}</p></div><LogoutButton /></header><SetupForm /></main>;
  }
  const cycleId = selectAuthorizedCycleId(user.memberships, "MANAGE_CYCLE") ?? selectAuthorizedCycleId(user.memberships, "HASH_PANEL_ACCESS");
  if (!cycleId) redirect("/member");
  const cycle = await prisma.rushCycle.findUnique({ where: { id: cycleId } });
  if (!cycle) redirect("/member");
  const canManage = hasPermission(user.memberships, cycle.id, "MANAGE_CYCLE");
  const canPanel = hasPermission(user.memberships, cycle.id, "HASH_PANEL_ACCESS");
  const canManageUsers = user.memberships.some((membership) => membership.cycleId === cycle.id && membership.active && membership.role === "OWNER");
  if (!canManage && !canPanel) redirect("/member");

  const [rounds, applications, members, events, decisions] = await Promise.all([
    prisma.round.findMany({ where: { cycleId: cycle.id }, include: { rubric: { include: { criteria: { orderBy: { position: "asc" } } } } }, orderBy: { name: "asc" } }),
    prisma.application.findMany({
      where: { cycleId: cycle.id },
      include: {
        pnm: true,
        assignments: { include: { round: { include: { rubric: { include: { criteria: true } } } }, evaluations: { where: { status: { in: ["SUBMITTED", "LOCKED"] } }, include: { ratings: true } }, evaluator: true } },
      },
      orderBy: { pnm: { name: "asc" } },
    }),
    prisma.membership.findMany({ where: { cycleId: cycle.id, active: true, role: { in: ["MEMBER", "BOARD", "PANEL", "OWNER"] } }, include: { user: true }, orderBy: { user: { name: "asc" } } }),
    prisma.event.findMany({ where: { OR: [{ cycleId: cycle.id }, { cycleId: null }] }, orderBy: { date: "asc" } }),
    prisma.decision.findMany({ where: { cycleId: cycle.id }, include: { approvals: true }, orderBy: { createdAt: "desc" } }),
  ]);
  const hashOpen = canPanel && cycle.status === "DECISION_LOCK" && rounds.length >= 2 && rounds.every((round) => ["FROZEN", "FINALIZED"].includes(round.status));
  const decisionByApplication = new Map<string, (typeof decisions)[number]>();
  for (const decision of decisions) {
    if (!decisionByApplication.has(decision.applicationId)) decisionByApplication.set(decision.applicationId, decision);
  }

  const rankings = applications.map((application) => {
    const byRound = rounds.map((round) => {
      const scored = application.assignments
        .filter((assignment) => assignment.roundId === round.id)
        .flatMap((assignment) => assignment.evaluations)
        .map((evaluation) => scoreEvaluation(round.rubric?.criteria ?? [], evaluation.ratings));
      return { round, aggregate: aggregateRound(scored) };
    });
    return {
      application,
      rounds: byRound,
      finalScore: combineRoundScores(byRound.map(({ round, aggregate }) => ({ score: aggregate.score, weight: round.weight }))),
    };
  }).sort((a, b) => (b.finalScore ?? -1) - (a.finalScore ?? -1));

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-9 p-6 sm:p-10">
      <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm text-orange-700">{cycle.name} · {cycle.status}</p><h1 className="text-3xl font-semibold">Board dashboard</h1><p className="mt-1 text-gray-600">Signed in as {user.name}</p></div><div className="flex gap-2"><Link href="/member" className="rounded border px-3 py-2 text-sm">Evaluation Hub</Link><LogoutButton /></div></header>

      {canManage && <RushControls cycleId={cycle.id} cycleStatus={cycle.status} canManageUsers={canManageUsers} rounds={rounds.map((round) => ({ id: round.id, label: round.name, status: round.status }))} members={members.map((membership) => ({ id: membership.user.id, label: `${membership.user.name} · ${membership.role}` }))} applications={applications.map((application) => ({ id: application.id, label: application.pnm.name }))} />}

      <section>
        <div className="flex items-center justify-between"><div><h2 className="text-xl font-semibold">Hash decision workspace</h2><p className="text-sm text-gray-600">Aggregates appear only after every evaluated round is frozen.</p></div><span className={`rounded-full px-3 py-1 text-sm ${hashOpen ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>{hashOpen ? "Open" : "Locked"}</span></div>
        {hashOpen ? <div className="mt-4 overflow-x-auto rounded-xl border"><table className="w-full text-left text-sm"><thead className="bg-gray-50"><tr><th className="p-3">Applicant</th>{rounds.map((round) => <th key={round.id} className="p-3">{round.name}</th>)}<th className="p-3">Combined</th><th className="p-3">Decision</th></tr></thead><tbody>{rankings.map(({ application, rounds: roundResults, finalScore }) => { const decision = decisionByApplication.get(application.id); return <tr key={application.id} className="border-t align-top"><td className="p-3 font-medium">{application.pnm.name}<span className="block text-xs font-normal text-gray-500">{application.status}</span></td>{roundResults.map(({ round, aggregate }) => <td key={round.id} className="p-3">{aggregate.score === null ? "Pending" : aggregate.score.toFixed(1)}<span className="block text-xs text-gray-500">{aggregate.count} ratings{aggregate.spread !== null ? ` · spread ${aggregate.spread.toFixed(1)}` : ""}{aggregate.status === "REVIEW" ? " · review" : ""}</span></td>)}<td className="p-3 font-semibold">{finalScore === null ? "Pending" : finalScore.toFixed(1)}</td><td className="min-w-72 p-3">{decision ? <div><p className="font-medium">{decision.outcome} · {decision.status}</p><p className="text-xs text-gray-600">{decision.reason}</p><p className="mt-1 text-xs">{decision.approvals.length}/2 approvals</p>{!["LOCKED", "RELEASED"].includes(decision.status) && <ApprovalButton decisionId={decision.id} />}{decision.status === "LOCKED" && <ReleaseButton decisionId={decision.id} />}</div> : <DecisionForm cycleId={cycle.id} applicationId={application.id} />}</td></tr>; })}</tbody></table></div> : <p className="mt-4 rounded-xl border border-dashed p-6 text-gray-600">Freeze Speed Dating and Group Case after submissions close to reveal the Hash panel data.</p>}
      </section>

      <section><div className="flex items-center justify-between"><h2 className="text-xl font-semibold">Attendance events</h2><Link href="/admin/events/new" className="rounded border px-3 py-2 text-sm">New event</Link></div><p className="mt-1 text-sm text-gray-600">Attendance is operational only and does not contribute to applicant rankings.</p><ul className="mt-3 grid gap-2 sm:grid-cols-2">{events.map((event) => <li key={event.id} className="rounded-lg border p-3"><Link href={`/admin/events/${event.id}`} className="font-medium underline">{event.name}</Link><p className="text-sm text-gray-500">{event.date.toLocaleDateString()}</p></li>)}</ul></section>
    </main>
  );
}
