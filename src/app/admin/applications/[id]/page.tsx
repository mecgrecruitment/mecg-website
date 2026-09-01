import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";
import { createClient } from "@/lib/supabase/server";
import { aggregateRound, combineRoundScores, scoreEvaluation } from "@/lib/evaluation.js";
import { CLASS_YEAR_LABELS, PIPELINE_STATUSES, type ClassYear } from "@/lib/workflow";
import LogoutButton from "@/components/logout-button";
import BoardNav from "../../board-nav";
import DecisionForm, { ApprovalButton, PreviewForm, ReleaseButton } from "../../decision-form";
import DossierTabs from "./tabs";

const TERMINAL_STATUSES = new Set<(typeof PIPELINE_STATUSES)[number]>(["OFFERED", "WAITLISTED", "REJECTED", "WITHDRAWN"]);

function humanize(value: string) {
  return value.replaceAll("_", " ");
}

function httpUrl(value: string) {
  if (!/^https?:\/\//i.test(value)) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? value : null;
  } catch {
    return null;
  }
}

type ApplicationDossierRow = {
  id: string;
  status: string;
  resume_storage_path: string | null;
  cycle_id: string;
  offer_response: string | null;
  offer_responded_at: string | null;
  pnms: {
    name: string;
    contact: string;
    preferred_name: string | null;
    phone: string | null;
    class_year: string | null;
    major: string | null;
    linkedin_url: string | null;
  };
};

export default async function ApplicantDossier({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAdmin();
  const supabase = await createClient();
  const applicationSelect: string = "id,status,resume_storage_path,cycle_id,pnms!inner(name,contact,preferred_name,phone,class_year,major,linkedin_url)";
  const { data, error } = await supabase
    .from("applications")
    .select(applicationSelect)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) notFound();
  const application = data as unknown as ApplicationDossierRow;
  const cycleId = application.cycle_id;
  const canManageCycle = hasPermission(user.memberships, cycleId, "MANAGE_CYCLE");
  const canOperate = hasPermission(user.memberships, cycleId, "RECRUITMENT_OPERATIONS");
  const canPanel = hasPermission(user.memberships, cycleId, "HASH_PANEL_ACCESS");
  const canDecide = hasPermission(user.memberships, cycleId, "DECIDE");
  const canRelease = hasPermission(user.memberships, cycleId, "RELEASE");
  const committeeOnly = canOperate && !canManageCycle && !canPanel;
  if (!canManageCycle && !canPanel && !canOperate) redirect("/member");

  // Fail closed: a failed lookup is indistinguishable from "no conflict declared", so it must not
  // fall through to the dossier.
  const { data: conflict, error: conflictError } = await supabase.from("conflict_declarations").select("id").eq("application_id", id).eq("declarer_id", user.id).maybeSingle();
  if (conflictError) console.error("conflict declaration lookup failed", conflictError);
  if (conflictError || conflict) {
    return (
      <main className="mx-auto flex max-w-3xl flex-col gap-6 p-6 sm:p-10">
        <p className="rounded-2xl bg-mecg-navy/[0.035] p-5 text-sm leading-6 text-mecg-navy shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)]">
          {conflictError
            ? "Your conflict-of-interest status for this applicant could not be verified, so their file is withheld. Try again in a moment."
            : "You have declared a conflict of interest on this applicant and are recused from viewing their file."}
        </p>
        <Link href="/admin" className="font-mono text-xs font-semibold uppercase tracking-[0.08em] text-mecg-orange-ink underline underline-offset-4">
          Back to pipeline
        </Link>
      </main>
    );
  }

  const person = application.pnms;
  const linkedinHref = person.linkedin_url ? httpUrl(person.linkedin_url) : null;
  const year = person.class_year && person.class_year in CLASS_YEAR_LABELS ? CLASS_YEAR_LABELS[person.class_year as ClassYear] : person.class_year;
  const isTerminal = TERMINAL_STATUSES.has(application.status as (typeof PIPELINE_STATUSES)[number]);

  if (committeeOnly) {
    return (
      <main className="mx-auto flex max-w-4xl flex-col gap-6 p-6 sm:p-10">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-mecg-orange-ink">Applicant operations</p>
            <h1 className="mt-2.5 text-3xl font-semibold tracking-[-0.03em] sm:text-[34px]">{person.name}</h1>
          </div>
          <LogoutButton />
        </header>
        <BoardNav current="/admin" recruitmentOperations={canOperate} hashPanel={canPanel} />
        <section className="flex flex-col gap-4 rounded-2xl bg-mecg-navy/[0.035] p-5 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)]">
          <span className={`inline-flex w-fit items-center rounded-full px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] ${isTerminal ? "bg-mecg-navy text-white" : "bg-mecg-orange/15 text-mecg-orange-ink shadow-[inset_0_0_0_1px_rgba(254,144,77,0.35)]"}`}>
            {humanize(application.status)}
          </span>
          <dl className="grid gap-3 text-sm leading-6 text-mecg-navy/80 sm:grid-cols-2">
            {person.preferred_name && <div><dt className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-mecg-navy/45">Preferred name</dt><dd>{person.preferred_name}</dd></div>}
            <div><dt className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-mecg-navy/45">Contact</dt><dd>{person.contact}</dd></div>
            {person.phone && <div><dt className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-mecg-navy/45">Phone</dt><dd>{person.phone}</dd></div>}
            {year && <div><dt className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-mecg-navy/45">Class year</dt><dd>{year}</dd></div>}
            {person.major && <div><dt className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-mecg-navy/45">Major</dt><dd>{person.major}</dd></div>}
            {person.linkedin_url && <div><dt className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-mecg-navy/45">LinkedIn</dt><dd>{linkedinHref ? <a className="underline decoration-mecg-navy/30 underline-offset-2 hover:decoration-mecg-navy" href={linkedinHref} target="_blank" rel="noreferrer">{person.linkedin_url}</a> : person.linkedin_url}</dd></div>}
          </dl>
          <div>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-mecg-navy/45">Resume</p>
            {application.resume_storage_path ? (
              <div className="mt-2 overflow-hidden rounded-xl shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)]">
                <iframe src={`/api/admin/applications/${application.id}/resume`} title={`${person.name} resume`} className="h-[560px] w-full bg-white" />
                <a className="block border-t border-mecg-navy/10 bg-mecg-navy/[0.02] p-2 text-center font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-mecg-orange-ink" href={`/api/admin/applications/${application.id}/resume`} target="_blank" rel="noreferrer">Open in new tab ↗</a>
              </div>
            ) : <p className="mt-2 text-sm text-mecg-navy/45">No resume on file.</p>}
          </div>
        </section>
        <Link href="/admin" className="font-mono text-xs font-semibold uppercase tracking-[0.08em] text-mecg-orange-ink underline underline-offset-4">Back to pipeline</Link>
      </main>
    );
  }

  const offerSelect: string = "offer_response,offer_responded_at";
  const [offerResult, responsesResult, roundsResult, evalAppResult, decisionsResult] = await Promise.all([
    supabase.from("applications").select(offerSelect).eq("id", id).single(),
    supabase.from("application_responses").select("question_key,question_text,response_text").eq("application_id", id),
    supabase.from("rounds").select("id,name,kind,status,weight,rubrics(id,version,rubric_criteria(id,name,description,weight,required,position))").eq("cycle_id", cycleId).order("name"),
    supabase
      .from("applications")
      .select("id,evaluation_assignments(id,round_id,evaluations(id,status,submitted_at,criterion_ratings(criterion_id,score,note),evaluator:profiles(display_name)))")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("decisions")
      .select("id,application_id,outcome,status,reason,communication_preview,decision_approvals(id)")
      .eq("cycle_id", cycleId)
      .eq("application_id", id)
      .order("created_at", { ascending: false }),
  ]);
  for (const result of [offerResult, responsesResult, roundsResult, evalAppResult, decisionsResult]) if (result.error) throw result.error;
  if (!offerResult.data) notFound();
  const offer = offerResult.data as unknown as Pick<ApplicationDossierRow, "offer_response" | "offer_responded_at">;
  application.offer_response = offer.offer_response;
  application.offer_responded_at = offer.offer_responded_at;

  const responses = responsesResult.data ?? [];
  const rounds = (roundsResult.data ?? []).map((round) => ({ ...round, rubric: [...round.rubrics].sort((a, b) => b.version - a.version)[0] }));
  const assignments = evalAppResult.data?.evaluation_assignments ?? [];
  const decisions = decisionsResult.data ?? [];
  const visibleDecisions = decisions;

  const evaluationRounds = rounds.map((round) => {
    const criteria = round.rubric?.rubric_criteria ?? [];
    const evaluations = assignments.filter((assignment) => assignment.round_id === round.id).flatMap((assignment) => assignment.evaluations);
    const scored = evaluations
      .filter((evaluation) => ["SUBMITTED", "LOCKED"].includes(evaluation.status))
      .map((evaluation) => scoreEvaluation(criteria, evaluation.criterion_ratings.map((rating) => ({ criterionId: rating.criterion_id, score: rating.score }))));
    return { round, criteria, aggregate: aggregateRound(scored), evaluations };
  });
  const finalScore = combineRoundScores(evaluationRounds.map(({ round, aggregate }) => ({ score: aggregate.score, weight: round.weight })));

  const decisionIds = decisions.map((decision) => decision.id);
  const [applicationAuditResult, decisionAuditResult] = await Promise.all([
    supabase.from("audit_events").select("id,actor_id,action,resource,resource_id,metadata,created_at").eq("resource", "Application").eq("resource_id", id),
    decisionIds.length
      ? supabase.from("audit_events").select("id,actor_id,action,resource,resource_id,metadata,created_at").eq("resource", "Decision").in("resource_id", decisionIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const auditEvents = [...(applicationAuditResult.data ?? []), ...(decisionAuditResult.data ?? [])].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  if (applicationAuditResult.error) console.error("application audit lookup failed", applicationAuditResult.error);
  if (decisionAuditResult.error) console.error("decision audit lookup failed", decisionAuditResult.error);
  const auditUnavailable = Boolean(applicationAuditResult.error || decisionAuditResult.error);
  const actorIds = [...new Set(auditEvents.map((event) => event.actor_id).filter((actorId): actorId is string => Boolean(actorId)))];
  const { data: actorProfiles, error: actorProfilesError } = actorIds.length ? await supabase.from("profiles").select("id,display_name").in("id", actorIds) : { data: [], error: null };
  if (actorProfilesError) console.error("audit actor lookup failed", actorProfilesError);
  const actorNameById = new Map((actorProfiles ?? []).map((profile) => [profile.id, profile.display_name]));

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 p-6 sm:p-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-mecg-orange-ink">Applicant dossier</p>
          <h1 className="mt-2.5 text-3xl font-semibold tracking-[-0.03em] sm:text-[34px]">{person.name}</h1>
        </div>
        <LogoutButton />
      </header>
      <BoardNav current="/admin" recruitmentOperations={canOperate} hashPanel={canPanel} />

      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,320px)_1fr] lg:items-start lg:gap-8">
        <section className="order-2 flex flex-col gap-4 rounded-2xl bg-mecg-navy/[0.035] p-5 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)] lg:order-none">
          <span
            className={`inline-flex w-fit items-center rounded-full px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] ${
              isTerminal ? "bg-mecg-navy text-white" : "bg-mecg-orange/15 text-mecg-orange-ink shadow-[inset_0_0_0_1px_rgba(254,144,77,0.35)]"
            }`}
          >
            {humanize(application.status)}
          </span>
          {application.offer_response && (
            <div className="rounded-xl bg-white/70 p-3 text-sm shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)]">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-mecg-navy/60">Offer response</p>
              <p className="mt-1 font-semibold text-mecg-navy">{humanize(application.offer_response)}</p>
              {application.offer_responded_at && (
                <time dateTime={application.offer_responded_at} className="mt-1 block text-xs text-mecg-navy/65">
                  Recorded {new Date(application.offer_responded_at).toLocaleString()}
                </time>
              )}
            </div>
          )}
          <dl className="flex flex-col gap-2.5 text-sm leading-6 text-mecg-navy/80">
            {person.preferred_name && (
              <div>
                <dt className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-mecg-navy/45">Preferred name</dt>
                <dd>{person.preferred_name}</dd>
              </div>
            )}
            <div>
              <dt className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-mecg-navy/45">Contact</dt>
              <dd>{person.contact}</dd>
            </div>
            {person.phone && (
              <div>
                <dt className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-mecg-navy/45">Phone</dt>
                <dd>{person.phone}</dd>
              </div>
            )}
            {year && (
              <div>
                <dt className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-mecg-navy/45">Class year</dt>
                <dd>{year}</dd>
              </div>
            )}
            {person.major && (
              <div>
                <dt className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-mecg-navy/45">Major</dt>
                <dd>{person.major}</dd>
              </div>
            )}
            {person.linkedin_url && (
              <div>
                <dt className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-mecg-navy/45">LinkedIn</dt>
                <dd>
                  {linkedinHref ? (
                    <a className="underline decoration-mecg-navy/30 underline-offset-2 hover:decoration-mecg-navy" href={linkedinHref} target="_blank" rel="noreferrer">
                      {person.linkedin_url}
                    </a>
                  ) : person.linkedin_url}
                </dd>
              </div>
            )}
          </dl>

          <div>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-mecg-navy/45">Resume</p>
            {application.resume_storage_path ? (
              <div className="mt-2 overflow-hidden rounded-xl shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)]">
                <iframe src={`/api/admin/applications/${application.id}/resume`} title={`${person.name} resume`} className="h-[440px] w-full bg-white" />
                <a
                  className="block border-t border-mecg-navy/10 bg-mecg-navy/[0.02] p-2 text-center font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-mecg-orange-ink"
                  href={`/api/admin/applications/${application.id}/resume`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open in new tab ↗
                </a>
              </div>
            ) : (
              <p className="mt-2 text-sm text-mecg-navy/45">No resume on file.</p>
            )}
          </div>
        </section>

        <div className="order-1 lg:order-none">
          <DossierTabs
            panels={{
              responses: (
                <div className="flex flex-col gap-4">
                  {responses.length === 0 && <p className="text-sm text-mecg-navy/45">No responses on file.</p>}
                  {responses.map((response) => (
                    <article key={response.question_key} className="rounded-2xl bg-mecg-navy/[0.035] p-5 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)]">
                      <h2 className="font-medium text-mecg-navy">{response.question_text}</h2>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-mecg-navy/70">{response.response_text}</p>
                    </article>
                  ))}
                </div>
              ),
              evaluations: !canPanel ? (
                <p className="rounded-2xl bg-mecg-navy/[0.035] p-5 text-sm leading-6 text-mecg-navy/70 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)]">
                  Round scores and evaluator ratings are visible to the Hash panel only, so nothing is shown here for your role.
                </p>
              ) : (
                <div className="flex flex-col gap-5">
                  {finalScore !== null && (
                    <p className="font-mono text-xs font-semibold uppercase tracking-[0.08em] text-mecg-navy/55">
                      Combined score <span className="text-mecg-navy">{finalScore.toFixed(1)}</span>
                    </p>
                  )}
                  {evaluationRounds.map(({ round, criteria, aggregate, evaluations }) => (
                    <section key={round.id} className="rounded-2xl bg-mecg-navy/[0.035] p-5 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)]">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h2 className="font-semibold text-mecg-navy">{round.name}</h2>
                        <p className="font-mono text-xs text-mecg-navy/55">
                          {aggregate.score === null ? (aggregate.status === "PENDING" ? "Pending" : "—") : aggregate.score.toFixed(1)}
                          <span className="ml-2 text-mecg-navy/40">
                            {aggregate.count} ratings{aggregate.spread != null ? ` · spread ${aggregate.spread.toFixed(0)}` : ""}
                            {aggregate.status === "REVIEW" ? " · review" : ""}
                          </span>
                        </p>
                      </div>
                      <div className="mt-4 flex flex-col gap-3">
                        {evaluations.length === 0 && <p className="text-sm text-mecg-navy/45">No evaluations submitted yet.</p>}
                        {evaluations.map((evaluation) => (
                          <div key={evaluation.id} className="rounded-xl bg-white p-3.5 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)]">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-sm font-medium text-mecg-navy">{evaluation.evaluator?.display_name ?? "Evaluator"}</p>
                              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-mecg-navy/45">{evaluation.status}</span>
                            </div>
                            <ul className="mt-2 flex flex-col gap-1 text-xs text-mecg-navy/65">
                              {evaluation.criterion_ratings.map((rating) => (
                                <li key={rating.criterion_id}>
                                  <span className="font-medium text-mecg-navy/80">{criteria.find((c) => c.id === rating.criterion_id)?.name ?? rating.criterion_id}:</span>{" "}
                                  {rating.score ?? "—"}
                                  {rating.note && <span className="text-mecg-navy/50"> — {rating.note}</span>}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </section>
                  ))}
                  {evaluationRounds.length === 0 && <p className="text-sm text-mecg-navy/45">No evaluation rounds configured.</p>}
                </div>
              ),
              decision: (
                <div className="flex flex-col gap-4">
                  {visibleDecisions.length === 0 && canDecide && (
                    <div className="rounded-2xl bg-mecg-navy/[0.035] p-5 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)]">
                      <p className="mb-3 text-sm text-mecg-navy/55">No decision yet.</p>
                      <DecisionForm cycleId={cycleId} applicationId={application.id} />
                    </div>
                  )}
                  {visibleDecisions.length === 0 && !canDecide && (
                    <p className="rounded-2xl bg-mecg-navy/[0.035] p-5 text-sm leading-6 text-mecg-navy/70 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)]">Decision controls are available only to authorized Hash panel members.</p>
                  )}
                  {visibleDecisions.map((decision) => (
                    <div key={decision.id} className="flex flex-col gap-3 rounded-2xl bg-mecg-navy/[0.035] p-5 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.14)]">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-mecg-navy">
                          {decision.outcome} · {decision.status}
                        </p>
                        <span className="font-mono text-[11px] text-mecg-navy/45">{decision.decision_approvals.length}/2 approvals</span>
                      </div>
                      <p className="text-sm text-mecg-navy/65">{decision.reason}</p>
                      {!["LOCKED", "RELEASED"].includes(decision.status) && canDecide && <ApprovalButton decisionId={decision.id} />}
                      {decision.status === "LOCKED" && canRelease && <ReleaseButton decisionId={decision.id} />}
                      {canDecide && <PreviewForm decisionId={decision.id} cycleId={cycleId} current={decision.communication_preview} />}
                    </div>
                  ))}
                </div>
              ),
              activity: (
                <div className="flex flex-col gap-2">
                  {auditUnavailable && <p className="text-sm text-mecg-orange-ink">The audit log could not be loaded. What is shown here may be incomplete.</p>}
                  {!auditUnavailable && auditEvents.length === 0 && <p className="text-sm text-mecg-navy/45">No activity recorded, or you do not have permission to view the audit log for this cycle.</p>}
                  {auditEvents.map((event) => (
                    <div key={event.id} className="flex items-start justify-between gap-3 rounded-xl bg-mecg-navy/[0.035] px-4 py-3 text-sm shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)]">
                      <div>
                        <p className="font-medium text-mecg-navy">{humanize(event.action)}</p>
                        <p className="text-xs text-mecg-navy/45">{event.actor_id ? (actorNameById.get(event.actor_id) ?? "Unknown board member") : "System"}</p>
                      </div>
                      <time className="shrink-0 font-mono text-[11px] text-mecg-navy/45">{new Date(event.created_at).toLocaleString()}</time>
                    </div>
                  ))}
                </div>
              ),
            }}
          />
        </div>
      </div>

      <Link href="/admin" className="font-mono text-xs font-semibold uppercase tracking-[0.08em] text-mecg-orange-ink underline underline-offset-4">
        Back to pipeline
      </Link>
    </main>
  );
}
