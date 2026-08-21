import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";
import { createClient } from "@/lib/supabase/server";
import { aggregateRound, combineRoundScores, scoreEvaluation } from "@/lib/evaluation.js";
import LogoutButton from "./logout-button";
import SetupForm from "./setup-form";
import RushControls from "./rush-controls";
import DecisionForm, { ApprovalButton, ReleaseButton } from "./decision-form";
import { selectAuthorizedCycleId } from "@/lib/cycles";

export default async function AdminDashboard() {
  const user = await requireUser();
  const supabase = await createClient();
  const { count: cycleCount, error: countError } = await supabase.from("rush_cycles").select("id", { count: "exact", head: true });
  if (countError) throw countError;
  if (!cycleCount) return <main className="mx-auto flex max-w-5xl flex-col gap-8 p-8"><header className="flex items-center justify-between"><div><h1 className="text-2xl font-semibold">MECG rush setup</h1><p className="text-gray-600">Signed in as {user.name}</p></div><LogoutButton /></header><SetupForm /></main>;
  const cycleId = selectAuthorizedCycleId(user.memberships, "MANAGE_CYCLE") ?? selectAuthorizedCycleId(user.memberships, "HASH_PANEL_ACCESS");
  if (!cycleId) redirect("/member");
  const canManage = hasPermission(user.memberships, cycleId, "MANAGE_CYCLE");
  const canPanel = hasPermission(user.memberships, cycleId, "HASH_PANEL_ACCESS");
  const canManageUsers = user.memberships.some((membership) => membership.cycleId === cycleId && membership.role === "OWNER");
  const [cycleResult, roundsResult, appsResult, membersResult, eventsResult, decisionsResult] = await Promise.all([
    supabase.from("rush_cycles").select("id,name,status").eq("id", cycleId).single(),
    supabase.from("rounds").select("id,name,kind,status,weight,rubrics(id,version,rubric_criteria(id,name,description,weight,required,position))").eq("cycle_id", cycleId).order("name"),
    supabase.from("applications").select("id,status,pnms!inner(id,name),evaluation_assignments(id,round_id,evaluations(id,status,criterion_ratings(criterion_id,score,note)))").eq("cycle_id", cycleId),
    supabase.from("memberships").select("id,user_id,role,profiles!inner(display_name)").eq("cycle_id", cycleId).eq("active", true),
    supabase.from("events").select("id,name,starts_at").eq("cycle_id", cycleId).order("starts_at"),
    supabase.from("decisions").select("id,application_id,outcome,status,reason,decision_approvals(id)").eq("cycle_id", cycleId).order("created_at", { ascending: false }),
  ]);
  for (const result of [cycleResult,roundsResult,appsResult,membersResult,eventsResult,decisionsResult]) if (result.error) throw result.error;
  const cycle = cycleResult.data;
  if (!cycle) redirect("/member");
  const rounds = (roundsResult.data ?? []).map((round) => ({ ...round, rubric: [...round.rubrics].sort((a,b) => b.version-a.version)[0] }));
  const applications = (appsResult.data ?? []).sort((a,b) => a.pnms.name.localeCompare(b.pnms.name));
  const decisions = decisionsResult.data ?? [];
  const decisionByApplication = new Map(decisions.map((decision) => [decision.application_id, decision]));
  const hashOpen = canPanel && cycle.status === "DECISION_LOCK" && rounds.length >= 2 && rounds.every((round) => ["FROZEN","FINALIZED"].includes(round.status));
  const rankings = applications.map((application) => {
    const byRound = rounds.map((round) => {
      const criteria = round.rubric?.rubric_criteria ?? [];
      const scored = application.evaluation_assignments.filter((assignment) => assignment.round_id === round.id).flatMap((assignment) => assignment.evaluations).filter((evaluation) => ["SUBMITTED","LOCKED"].includes(evaluation.status)).map((evaluation) => scoreEvaluation(criteria, evaluation.criterion_ratings.map((rating) => ({ criterionId: rating.criterion_id, score: rating.score }))));
      return { round, aggregate: aggregateRound(scored) };
    });
    return { application, rounds: byRound, finalScore: combineRoundScores(byRound.map(({round,aggregate}) => ({ score: aggregate.score, weight: round.weight }))) };
  }).sort((a,b) => (b.finalScore ?? -1)-(a.finalScore ?? -1));

  return <main className="mx-auto flex max-w-7xl flex-col gap-9 p-6 sm:p-10"><header className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm text-orange-700">{cycle.name} · {cycle.status}</p><h1 className="text-3xl font-semibold">Board dashboard</h1><p className="mt-1 text-gray-600">Signed in as {user.name}</p></div><div className="flex gap-2"><Link href="/member" className="rounded border px-3 py-2 text-sm">Evaluation Hub</Link><LogoutButton /></div></header>
    {canManage && <RushControls cycleId={cycle.id} cycleStatus={cycle.status} canManageUsers={canManageUsers} rounds={rounds.map((round) => ({id:round.id,label:round.name,status:round.status}))} members={(membersResult.data ?? []).map((membership) => ({id:membership.user_id,label:`${membership.profiles.display_name} · ${membership.role}`}))} applications={applications.map((application) => ({id:application.id,label:application.pnms.name}))} />}
    <section><div className="flex items-center justify-between"><div><h2 className="text-xl font-semibold">Hash decision workspace</h2><p className="text-sm text-gray-600">Aggregates appear only after every evaluated round is frozen.</p></div><span className={`rounded-full px-3 py-1 text-sm ${hashOpen?"bg-green-100 text-green-800":"bg-amber-100 text-amber-800"}`}>{hashOpen?"Open":"Locked"}</span></div>{hashOpen ? <div className="mt-4 overflow-x-auto rounded-xl border"><table className="w-full text-left text-sm"><thead className="bg-gray-50"><tr><th className="p-3">Applicant</th>{rounds.map((round)=><th key={round.id} className="p-3">{round.name}</th>)}<th className="p-3">Combined</th><th className="p-3">Decision</th></tr></thead><tbody>{rankings.map(({application,rounds:results,finalScore})=>{const decision=decisionByApplication.get(application.id);return <tr key={application.id} className="border-t align-top"><td className="p-3 font-medium">{application.pnms.name}<span className="block text-xs font-normal text-gray-500">{application.status}</span></td>{results.map(({round,aggregate})=><td key={round.id} className="p-3">{aggregate.score===null?"Pending":aggregate.score.toFixed(1)}<span className="block text-xs text-gray-500">{aggregate.count} ratings</span></td>)}<td className="p-3 font-semibold">{finalScore===null?"Pending":finalScore.toFixed(1)}</td><td className="min-w-72 p-3">{decision?<div><p className="font-medium">{decision.outcome} · {decision.status}</p><p className="text-xs text-gray-600">{decision.reason}</p><p className="mt-1 text-xs">{decision.decision_approvals.length}/2 approvals</p>{!["LOCKED","RELEASED"].includes(decision.status)&&<ApprovalButton decisionId={decision.id}/>} {decision.status==="LOCKED"&&<ReleaseButton decisionId={decision.id}/>}</div>:<DecisionForm cycleId={cycle.id} applicationId={application.id}/>}</td></tr>})}</tbody></table></div>:<p className="mt-4 rounded-xl border border-dashed p-6 text-gray-600">Freeze every round to reveal panel data.</p>}</section>
    <section><div className="flex items-center justify-between"><h2 className="text-xl font-semibold">Attendance events</h2><Link href="/admin/events/new" className="rounded border px-3 py-2 text-sm">New event</Link></div><ul className="mt-3 grid gap-2 sm:grid-cols-2">{(eventsResult.data ?? []).map((event)=><li key={event.id} className="rounded-lg border p-3"><Link href={`/admin/events/${event.id}`} className="font-medium underline">{event.name}</Link><p className="text-sm text-gray-500">{new Date(event.starts_at).toLocaleDateString()}</p></li>)}</ul></section>
  </main>;
}
