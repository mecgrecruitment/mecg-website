import { withWorkspaceCycle } from "@/lib/workspace-cycle-url";
import Link from "@/components/workspace-link";
import { notFound, redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";
import { createClient } from "@/lib/supabase/server";
import { combineRoundScores } from "@/lib/evaluation.js";
import { roundEvidence } from "@/lib/round-evidence";
import { CLASS_YEAR_LABELS, PIPELINE_STATUSES, countWords, type ClassYear } from "@/lib/workflow";
import { applicantCode } from "@/lib/applicant-code";
import LogoutButton from "@/components/logout-button";
import StatusPill from "@/components/status-pill";
import WorkspaceNav from "@/components/workspace-nav";
import DecisionForm, { ApprovalButton, OfferDeadlineForm, PreviewForm, ReleaseButton } from "../../decision-form";
import DossierTabs from "./tabs";
import { formatEasternDateTime } from "@/lib/date-time";
import { applicationStatusLabel, decisionOutcomeLabel, decisionStatusLabel, evaluationStatusLabel, statusLabel } from "@/lib/labels";
import { applicantDossierHref, filterDossierNavigationRows, validateRecruitmentReturnTo, type DossierNavigationRow } from "./dossier-navigation";
import { isMissingSchemaObject } from "@/lib/schema-availability";

const TERMINAL_STATUSES = new Set<(typeof PIPELINE_STATUSES)[number]>(["OFFERED", "WAITLISTED", "REJECTED", "WITHDRAWN"]);

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
  pnm_id: string;
  offer_response: string | null;
  offer_responded_at: string | null;
  offer_expires_at: string | null;
  pnms: {
    name: string;
    contact: string;
    preferred_name: string | null;
    phone: string | null;
    class_year: string | null;
    major: string | null;
    linkedin_url: string | null;
    accessibility_notes: string | null;
  };
};

type ResumeDocumentRow = {
  original_filename: string;
  verified_size: number | null;
  page_count: number | null;
  ready_at: string | null;
};

function resumeSize(size: number | null) {
  if (size === null) return null;
  return size >= 1024 * 1024
    ? `${(size / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(size / 1024))} KB`;
}

function ApplicantNavigation({ previousId, nextId, returnTo }: { previousId: string | null; nextId: string | null; returnTo: string }) {
  return (
    <nav aria-label="Applicant dossier navigation" className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
      <Link href={returnTo} className="inline-flex min-h-11 items-center text-sm font-semibold text-mecg-orange-ink underline underline-offset-4">
        Back to Recruitment
      </Link>
      <div className="flex gap-2">
        {previousId ? (
          <Link href={applicantDossierHref(previousId, returnTo)} rel="prev" className="button-secondary text-sm">Previous</Link>
        ) : (
          <span className="button-secondary pointer-events-none text-sm opacity-45" aria-disabled="true">Previous</span>
        )}
        {nextId ? (
          <Link href={applicantDossierHref(nextId, returnTo)} rel="next" className="button-secondary text-sm">Next</Link>
        ) : (
          <span className="button-secondary pointer-events-none text-sm opacity-45" aria-disabled="true">Next</span>
        )}
      </div>
    </nav>
  );
}

function ResumePanel({
  applicationId,
  applicantName,
  hasResumePath,
  document,
  hidden,
  heightClass,
}: {
  applicationId: string;
  applicantName: string;
  hasResumePath: boolean;
  document: ResumeDocumentRow | null;
  hidden: boolean;
  heightClass: string;
}) {
  const details = document
    ? [
      resumeSize(document.verified_size),
      document.page_count ? `${document.page_count} ${document.page_count === 1 ? "page" : "pages"}` : null,
      document.ready_at ? `Verified ${formatEasternDateTime(document.ready_at)}` : null,
    ].filter(Boolean)
    : [];

  return (
    <div>
      <p className="text-[13px] font-semibold text-muted">Resume</p>
      {hidden ? (
        <p className="mt-2 text-sm text-muted">Contact details and the resume are hidden for Hash review.</p>
      ) : document ? (
        <div className="mt-2">
          <p className="break-words text-sm font-semibold text-mecg-navy">{document.original_filename}</p>
          {details.length > 0 && <p className="mt-1 text-xs text-muted">{details.join(" · ")}</p>}
          <div className="mt-3 overflow-hidden rounded-xl inset-ring inset-ring-line-strong">
            <iframe
              loading="lazy"
              src={`/api/admin/applications/${applicationId}/resume`}
              title={`${applicantName} resume`}
              className={`${heightClass} w-full bg-white`}
            />
            <div className="border-t border-line bg-wash p-2 text-center">
              <a
                className="text-[13px] font-semibold text-mecg-orange-ink"
                href={`/api/admin/applications/${applicationId}/resume`}
                target="_blank"
                rel="noreferrer"
              >
                Open in new tab ↗
              </a>
              <p className="mt-1 text-xs text-muted">If the preview does not load, open the PDF in a new tab.</p>
            </div>
          </div>
        </div>
      ) : hasResumePath ? (
        <p className="mt-2 text-sm text-danger" role="alert">The resume record is unavailable. Retry this page before review.</p>
      ) : (
        <p className="mt-2 text-sm text-muted">No resume on file.</p>
      )}
    </div>
  );
}

export default async function ApplicantDossier({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ returnTo?: string | string[] }> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const requestedReturnTo = validateRecruitmentReturnTo(query.returnTo);
  const user = await requireAdmin();
  const supabase = await createClient();
  const applicationSelect: string = "id,status,resume_storage_path,cycle_id,pnm_id,pnms!inner(name,contact,preferred_name,phone,class_year,major,linkedin_url,accessibility_notes)";
  const { data, error } = await supabase
    .from("applications")
    .select(applicationSelect)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) notFound();
  const application = data as unknown as ApplicationDossierRow;
  // Read separately and never fatally: this column arrives with a migration,
  // and a dossier that 500s for every operator until someone runs `db push` is
  // a far worse failure than a dossier without a photo.
  const headshotLookup = await supabase
    .from("applications")
    .select("headshot_storage_path")
    .eq("id", id)
    .maybeSingle();
  if (headshotLookup.error && !isMissingSchemaObject(headshotLookup.error)) {
    console.error("dossier headshot lookup failed", headshotLookup.error);
  }
  const headshotStoragePath = headshotLookup.data?.headshot_storage_path ?? null;
  const cycleId = application.cycle_id;
  const returnTo = withWorkspaceCycle(requestedReturnTo, cycleId);
  const canManageCycle = hasPermission(user.memberships, cycleId, "MANAGE_CYCLE");
  const canOperate = hasPermission(user.memberships, cycleId, "RECRUITMENT_OPERATIONS");
  const canPanel = hasPermission(user.memberships, cycleId, "HASH_PANEL_ACCESS");
  const canDecide = hasPermission(user.memberships, cycleId, "DECIDE");
  const canRelease = hasPermission(user.memberships, cycleId, "RELEASE");
  const committeeOnly = canOperate && !canManageCycle && !canPanel;
  // Blind Hash review: a PANEL-only viewer (no MANAGE_CYCLE/RECRUITMENT_OPERATIONS) gets an
  // applicant code instead of a name, no contact/phone/LinkedIn/resume, and no evaluator
  // identity, matching blind screening's pseudonymous review. BOARD and OWNER are unaffected.
  const panelOnly = canPanel && !canManageCycle && !canOperate;
  if (!canManageCycle && !canPanel && !canOperate) redirect("/member");

  // Fail closed: a failed lookup is indistinguishable from "no conflict declared", so it must not
  // fall through to the dossier.
  const { data: conflict, error: conflictError } = await supabase.from("conflict_declarations").select("id").eq("application_id", id).eq("declarer_id", user.id).maybeSingle();
  if (conflictError) console.error("conflict declaration lookup failed", conflictError);
  if (conflictError || conflict) {
    return (
      <main className="mx-auto flex max-w-3xl flex-col gap-6 p-6 sm:p-10">
        <p className="rounded-xl bg-wash p-5 text-sm leading-6 text-mecg-navy inset-ring inset-ring-line-strong">
          {conflictError
            ? "Your conflict-of-interest status for this applicant could not be verified, so their file is withheld. Try again in a moment."
            : "You have declared a conflict of interest on this applicant and are recused from viewing their file."}
        </p>
        <Link href={returnTo} className="text-[13px] font-semibold text-mecg-orange-ink underline underline-offset-4">
          Back to Recruitment
        </Link>
      </main>
    );
  }

  const person = application.pnms;
  const displayName = panelOnly ? applicantCode(application.id) : person.name;
  const linkedinHref = person.linkedin_url ? httpUrl(person.linkedin_url) : null;
  const year = person.class_year && person.class_year in CLASS_YEAR_LABELS ? CLASS_YEAR_LABELS[person.class_year as ClassYear] : person.class_year;
  const isTerminal = TERMINAL_STATUSES.has(application.status as (typeof PIPELINE_STATUSES)[number]);
  const { data: navigationRows, error: navigationError } = await supabase
    .from("applications")
    .select("id,submitted_at,status,resume_storage_path,pnms!inner(name,contact)")
    .eq("cycle_id", cycleId)
    .neq("status", "DRAFT")
    .order("submitted_at", { ascending: true })
    .order("id", { ascending: true });
  if (navigationError) console.error("applicant dossier navigation lookup failed", navigationError);
  const filteredNavigationRows = filterDossierNavigationRows((navigationRows ?? []) as unknown as DossierNavigationRow[], returnTo);
  const navigationIndex = filteredNavigationRows.findIndex((row) => row.id === application.id);
  const previousId = navigationIndex > 0 ? filteredNavigationRows[navigationIndex - 1]?.id ?? null : null;
  const nextId = navigationIndex >= 0 ? filteredNavigationRows[navigationIndex + 1]?.id ?? null : null;
  let resumeDocument: ResumeDocumentRow | null = null;
  if (!panelOnly && application.resume_storage_path) {
    const { data: document, error: documentError } = await supabase
      .from("application_documents")
      .select("original_filename,verified_size,page_count,ready_at")
      .eq("application_id", application.id)
      .eq("object_path", application.resume_storage_path)
      .eq("status", "ATTACHED")
      .maybeSingle();
    if (documentError) console.error("resume metadata lookup failed", documentError);
    resumeDocument = document;
  }

  const checkinsResult = await supabase.from("checkins").select("checked_in_at,events!inner(name,starts_at,cycle_id)").eq("pnm_id", application.pnm_id).eq("events.cycle_id", cycleId);
  if (checkinsResult.error) throw checkinsResult.error;
  const eventsAttended = checkinsResult.data.map((checkin) => checkin.events).sort((a, b) => a.starts_at.localeCompare(b.starts_at)).map((event) => event.name);

  if (committeeOnly) {
    return (
      <main className="mx-auto flex max-w-4xl flex-col gap-6 p-6 sm:p-10">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[13px] font-semibold text-mecg-orange-ink">Applicant operations</p>
            <h1 className="workspace-title mt-2.5">{person.name}</h1>
          </div>
          <LogoutButton />
        </header>
        <WorkspaceNav user={user} cycleId={cycleId} current="/admin" />
        <ApplicantNavigation previousId={previousId} nextId={nextId} returnTo={returnTo} />
        <section className="flex flex-col gap-4 rounded-xl bg-wash p-5 inset-ring inset-ring-line-strong">

          <dl className="grid gap-3 text-sm leading-6 text-mecg-navy sm:grid-cols-2">
            {person.preferred_name && <div><dt className="text-[13px] font-semibold text-muted">Preferred name</dt><dd>{person.preferred_name}</dd></div>}
            <div><dt className="text-[13px] font-semibold text-muted">Contact</dt><dd>{person.contact}</dd></div>
            {person.phone && <div><dt className="text-[13px] font-semibold text-muted">Phone</dt><dd>{person.phone}</dd></div>}
            {year && <div><dt className="text-[13px] font-semibold text-muted">Class year</dt><dd>{year}</dd></div>}
            {person.major && <div><dt className="text-[13px] font-semibold text-muted">Major</dt><dd>{person.major}</dd></div>}
            <div><dt className="text-[13px] font-semibold text-muted">Events attended</dt><dd>{eventsAttended.length ? eventsAttended.join(", ") : "None"}</dd></div>
            {person.linkedin_url && <div><dt className="text-[13px] font-semibold text-muted">LinkedIn</dt><dd>{linkedinHref ? <a className="underline decoration-mecg-navy/30 underline-offset-2 hover:decoration-mecg-navy" href={linkedinHref} target="_blank" rel="noreferrer">{person.linkedin_url}</a> : person.linkedin_url}</dd></div>}
          </dl>
          <ResumePanel
            applicationId={application.id}
            applicantName={person.name}
            hasResumePath={Boolean(application.resume_storage_path)}
            document={resumeDocument}
            hidden={false}
            heightClass="h-[560px]"
          />
        </section>
        <Link href={returnTo} className="text-[13px] font-semibold text-mecg-orange-ink underline underline-offset-4">Back to Recruitment</Link>
      </main>
    );
  }

  const offerSelect: string = "offer_response,offer_responded_at,offer_expires_at";
  const [offerResult, responsesResult, roundsResult, evalAppResult, decisionsResult] = await Promise.all([
    supabase.from("applications").select(offerSelect).eq("id", id).single(),
    supabase.from("application_responses").select("question_key,question_text,question_word_limit,response_text").eq("application_id", id),
    supabase.from("rounds").select("id,name,kind,status,weight,rubrics!rubrics_round_id_fkey(id,version,minimum_observed_criteria,rubric_criteria(id,name,description,weight,required,position))").eq("cycle_id", cycleId).order("name"),
    supabase
      .from("applications")
      .select("id,evaluation_assignments(id,round_id,evaluator_id,evaluations(id,status,rubric_id,version,voided_at,submitted_at,criterion_ratings(criterion_id,score,note),evaluator:profiles(display_name)))")
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
  const offer = offerResult.data as unknown as Pick<ApplicationDossierRow, "offer_response" | "offer_responded_at" | "offer_expires_at">;
  application.offer_response = offer.offer_response;
  application.offer_responded_at = offer.offer_responded_at;
  application.offer_expires_at = offer.offer_expires_at;

  const responses = responsesResult.data ?? [];
  const rounds = (roundsResult.data ?? []).map((round) => ({ ...round, rubric: [...round.rubrics].sort((a, b) => b.version - a.version)[0] }));
  const assignments = evalAppResult.data?.evaluation_assignments ?? [];
  const decisions = decisionsResult.data ?? [];
  const visibleDecisions = decisions;

  const evaluationRounds = rounds.map((round) => {
    const criteria = round.rubric?.rubric_criteria ?? [];
    const evaluations = assignments.filter((assignment) => assignment.round_id === round.id).flatMap((assignment) => assignment.evaluations);
    const { aggregate } = roundEvidence({ roundId: round.id, rubric: round.rubric, assignments });
    return { round, criteria, aggregate, evaluations };
  });
  const finalScore = combineRoundScores(evaluationRounds.map(({ round, aggregate }) => ({ score: aggregate.score, weight: round.weight })));

  const decisionIds = decisions.map((decision) => decision.id);
  const [applicationAuditResult, decisionAuditResult, messagesResult, priorCyclesResult] = await Promise.all([
    supabase.from("audit_events").select("id,actor_id,action,resource,resource_id,metadata,created_at").eq("resource", "Application").eq("resource_id", id),
    decisionIds.length
      ? supabase.from("audit_events").select("id,actor_id,action,resource,resource_id,metadata,created_at").eq("resource", "Decision").in("resource_id", decisionIds)
      : Promise.resolve({ data: [], error: null }),
    panelOnly
      ? Promise.resolve({ data: [], error: null })
      : supabase.from("messages").select("id,kind,recipient,subject,delivered,created_at").eq("application_id", id).order("created_at", { ascending: false }),
    supabase.rpc("applicant_prior_cycles", { target_application_id: id }),
  ]);
  const auditEvents = [...(applicationAuditResult.data ?? []), ...(decisionAuditResult.data ?? [])].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  if (applicationAuditResult.error) console.error("application audit lookup failed", applicationAuditResult.error);
  if (decisionAuditResult.error) console.error("decision audit lookup failed", decisionAuditResult.error);
  const auditUnavailable = Boolean(applicationAuditResult.error || decisionAuditResult.error);
  if (messagesResult.error) console.error("message log lookup failed", messagesResult.error);
  const messages = messagesResult.data ?? [];
  if (priorCyclesResult.error) console.error("prior cycle lookup failed", priorCyclesResult.error);
  const priorCycles = Array.isArray(priorCyclesResult.data)
    ? priorCyclesResult.data.flatMap((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
      const row = entry as Record<string, unknown>;
      if (typeof row.cycleName !== "string" || typeof row.status !== "string") return [];
      return [{ cycleName: row.cycleName, status: row.status, submittedAt: typeof row.submittedAt === "string" ? row.submittedAt : null }];
    })
    : [];
  const actorIds = [...new Set(auditEvents.map((event) => event.actor_id).filter((actorId): actorId is string => Boolean(actorId)))];
  const { data: actorProfiles, error: actorProfilesError } = actorIds.length ? await supabase.from("profiles").select("id,display_name").in("id", actorIds) : { data: [], error: null };
  if (actorProfilesError) console.error("audit actor lookup failed", actorProfilesError);
  const actorNameById = new Map((actorProfiles ?? []).map((profile) => [profile.id, profile.display_name]));

  return (
    <main className="workspace-private workspace-stack mx-auto flex max-w-7xl flex-col">
      <header className="flex flex-wrap items-start justify-between gap-4">
        {/* Never in the panelOnly branch: that view hides contact and the resume,
            and a face is candidate material. Plain <img>, same-origin route. */}
        <div className="flex items-center gap-4">
          {!panelOnly && headshotStoragePath && (
            // eslint-disable-next-line @next/next/no-img-element -- authorized same-origin route, no images.remotePatterns
            <img
              src={`/api/admin/applications/${application.id}/headshot`}
              alt=""
              className="size-14 shrink-0 rounded-full object-cover shadow-xs"
            />
          )}
          <div>

            <h1 className="workspace-title mt-2.5">{displayName}</h1>
            <div className="mt-2"><StatusPill tone={isTerminal ? "navy" : "orange"}>{applicationStatusLabel(application.status)}</StatusPill></div>
          </div>
        </div>
        <LogoutButton />
      </header>
      <WorkspaceNav user={user} cycleId={cycleId} current="/admin" />
      <ApplicantNavigation previousId={previousId} nextId={nextId} returnTo={returnTo} />

      <div className="flex min-w-0 flex-col gap-4">
        <details className="reading-profile">
          <summary>Applicant details <span>Contact, background and event attendance</span></summary>
          <div className="mt-4 flex flex-col gap-4">

          {application.offer_response && (
            <div className="rounded-xl bg-white/70 p-3 text-sm inset-ring inset-ring-line">
              <p className="text-[13px] font-semibold text-muted">Offer response</p>
              <p className="mt-1 font-semibold text-mecg-navy">{statusLabel(application.offer_response)}</p>
              {application.offer_responded_at && (
                <time dateTime={application.offer_responded_at} className="mt-1 block text-xs text-muted">
                  Recorded {formatEasternDateTime(application.offer_responded_at)}
                </time>
              )}
            </div>
          )}
          <dl className="flex flex-col gap-2.5 text-sm leading-6 text-mecg-navy">
            {!panelOnly && (
              <div>
                <dt className="text-[13px] font-semibold text-muted">Applicant code</dt>
                <dd className="font-mono">{applicantCode(application.id)}</dd>
              </div>
            )}
            {!panelOnly && person.preferred_name && (
              <div>
                <dt className="text-[13px] font-semibold text-muted">Preferred name</dt>
                <dd>{person.preferred_name}</dd>
              </div>
            )}
            {!panelOnly && (
              <div>
                <dt className="text-[13px] font-semibold text-muted">Contact</dt>
                <dd>{person.contact}</dd>
              </div>
            )}
            {!panelOnly && person.phone && (
              <div>
                <dt className="text-[13px] font-semibold text-muted">Phone</dt>
                <dd>{person.phone}</dd>
              </div>
            )}
            {year && (
              <div>
                <dt className="text-[13px] font-semibold text-muted">Class year</dt>
                <dd>{year}</dd>
              </div>
            )}
            {person.major && (
              <div>
                <dt className="text-[13px] font-semibold text-muted">Major</dt>
                <dd>{person.major}</dd>
              </div>
            )}
            <div>
              <dt className="text-[13px] font-semibold text-muted">Events attended</dt>
              <dd>{eventsAttended.length ? eventsAttended.join(", ") : "None"}</dd>
            </div>
            {!panelOnly && person.linkedin_url && (
              <div>
                <dt className="text-[13px] font-semibold text-muted">LinkedIn</dt>
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

          {/* Collected at intake since the first cycle and read by nobody until
              now. An applicant declaring an access need and never hearing back
              is an accessibility failure, not a missing feature. */}
          {person.accessibility_notes && (
            <div className="rounded-xl bg-mecg-blue/10 p-4 inset-ring inset-ring-mecg-blue/20">
              <p className="text-[13px] font-semibold text-mecg-blue">Accessibility request</p>
              <p className="mt-1.5 whitespace-pre-wrap text-sm leading-6 text-muted">{person.accessibility_notes}</p>
              <p className="mt-2 text-xs text-muted">Arrange this before scheduling them for anything timed or in person.</p>
            </div>
          )}


        </div>
        </details>

        <div className="min-w-0">
          <DossierTabs
            panels={{
              evidence: (
                <section className="application-document" aria-label="Application responses">
                  <nav className="reading-contents" aria-label="Jump to application section">
                    {responses.map((response, index) => <a key={response.question_key} href={`#board-response-${index + 1}`} title={response.question_text}>Response {index + 1}</a>)}
                    <a href="#board-resume">Resume</a>
                  </nav>
                  {responses.length === 0 && <p className="text-sm text-muted">No responses on file.</p>}
                  {responses.map((response, index) => (
                    <article key={response.question_key} id={`board-response-${index + 1}`} className="reading-response">
                      <h2 className="font-medium text-mecg-navy">{response.question_text}</h2>
                      <p className="reading-answer whitespace-pre-wrap">{response.response_text}</p>
                      <p className="mt-2 text-[13px] text-muted">
                        {countWords(response.response_text)} words{response.question_word_limit ? ` · ${response.question_word_limit}-word limit` : ""}
                      </p>
                    </article>
                  ))}
                  <details id="board-resume" className="reading-resume">
                    <summary>Resume <span>Open document</span></summary>
          <ResumePanel
            applicationId={application.id}
            applicantName={displayName}
            hasResumePath={Boolean(application.resume_storage_path)}
            document={resumeDocument}
            hidden={panelOnly}
            heightClass="h-[75vh] min-h-[480px]"
          />
                  </details>
                </section>
              ),
              interviews: !canPanel ? (
                <p className="rounded-xl bg-wash p-5 text-sm leading-6 text-muted inset-ring inset-ring-line-strong">
                  Round scores and evaluator ratings are visible to the Hash panel only, so nothing is shown here for your role.
                </p>
              ) : (
                <div className="flex flex-col gap-5">
                  {finalScore !== null && (
                    <p className="text-[13px] font-semibold text-muted">
                      Combined score <span className="text-mecg-navy">{finalScore.toFixed(1)}</span>
                    </p>
                  )}
                  {evaluationRounds.map(({ round, criteria, aggregate, evaluations }) => (
                    <section key={round.id} className="rounded-xl bg-wash p-5 inset-ring inset-ring-line-strong">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h2 className="font-semibold text-mecg-navy">{round.name}</h2>
                        <p className="tabular text-xs text-muted">
                          {aggregate.score === null ? (aggregate.status === "PENDING" ? "Pending" : "—") : aggregate.score.toFixed(1)}
                          <span className="ml-2 text-muted">
                            {aggregate.count} ratings{aggregate.spread != null ? ` · spread ${aggregate.spread.toFixed(0)}` : ""}
                            {aggregate.status === "REVIEW" ? " · review" : ""}
                          </span>
                        </p>
                      </div>
                      <div className="mt-4 flex flex-col gap-3">
                        {evaluations.length === 0 && <p className="text-sm text-muted">No evaluations submitted yet.</p>}
                        {evaluations.map((evaluation) => (
                          <div key={evaluation.id} className="rounded-xl bg-white p-3.5 inset-ring inset-ring-line">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-sm font-medium text-mecg-navy">{panelOnly ? "Evaluator" : (evaluation.evaluator?.display_name ?? "Evaluator")}</p>
                              <span className="text-[13px] font-semibold text-muted">{evaluationStatusLabel(evaluation.status)}</span>
                            </div>
                            <ul className="mt-2 flex flex-col gap-1 text-xs text-muted">
                              {evaluation.criterion_ratings.map((rating) => (
                                <li key={rating.criterion_id}>
                                  <span className="font-medium text-mecg-navy">{criteria.find((c) => c.id === rating.criterion_id)?.name ?? rating.criterion_id}:</span>{" "}
                                  {rating.score ?? "—"}
                                  {rating.note && <span className="text-muted"> — {rating.note}</span>}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </section>
                  ))}
                  {evaluationRounds.length === 0 && <p className="text-sm text-muted">No evaluation rounds configured.</p>}
                </div>
              ),
              decision: (
                <div className="flex flex-col gap-4">
                  {visibleDecisions.length === 0 && canDecide && (
                    <div className="rounded-xl bg-wash p-5 inset-ring inset-ring-line-strong">
                      <p className="mb-3 text-sm text-muted">No decision yet.</p>
                      <DecisionForm cycleId={cycleId} applicationId={application.id} />
                    </div>
                  )}
                  {visibleDecisions.length === 0 && !canDecide && (
                    <p className="rounded-xl bg-wash p-5 text-sm leading-6 text-muted inset-ring inset-ring-line-strong">Decision controls are available only to authorized Hash panel members.</p>
                  )}
                  {visibleDecisions.map((decision) => (
                    <div key={decision.id} className="flex flex-col gap-3 rounded-xl bg-wash p-5 inset-ring inset-ring-line-strong">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-mecg-navy">
                          {decisionOutcomeLabel(decision.outcome)} · {decisionStatusLabel(decision.status)}
                        </p>
                        <span className="tabular text-xs text-muted">{decision.decision_approvals.length}/2 approvals</span>
                      </div>
                      <p className="text-sm text-muted">{decision.reason}</p>
                      {!["LOCKED", "RELEASED"].includes(decision.status) && canDecide && <ApprovalButton decisionId={decision.id} />}
                      {decision.status === "LOCKED" && canRelease && <ReleaseButton decisionId={decision.id} />}
                      {canDecide && <PreviewForm decisionId={decision.id} cycleId={cycleId} current={decision.communication_preview} />}
                      {canDecide && decision.outcome === "OFFER" && ["LOCKED", "RELEASED"].includes(decision.status) && !application.offer_response && (
                        <OfferDeadlineForm applicationId={application.id} current={application.offer_expires_at} />
                      )}
                    </div>
                  ))}
                </div>
              ),
              messages: panelOnly ? (
                <p className="rounded-xl bg-wash p-5 text-sm leading-6 text-muted inset-ring inset-ring-line-strong">
                  Message recipients and delivery metadata remain hidden during blind Hash review.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  <p className="text-sm text-muted">The delivery log stores message subjects and delivery metadata, but not message bodies.</p>
                  {messages.map((message) => (
                    <article key={message.id} className="rounded-xl bg-white px-4 py-3 inset-ring inset-ring-line">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h2 className="break-words text-sm font-semibold text-mecg-navy">{message.subject}</h2>
                          <p className="mt-1 text-xs text-muted">{statusLabel(message.kind)} · {message.recipient}</p>
                        </div>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[13px] font-semibold ${message.delivered ? "bg-success-wash text-success" : "bg-danger-wash text-danger"}`}>
                          {message.delivered ? "Delivered" : "Failed"}
                        </span>
                      </div>
                      <time dateTime={message.created_at} className="mt-2 block tabular text-xs text-muted">{formatEasternDateTime(message.created_at)}</time>
                    </article>
                  ))}
                  {!messages.length && <p className="text-sm text-muted">Nothing has been sent to this applicant yet.</p>}
                </div>
              ),
              history: (
                <div className="flex flex-col gap-2">
                  {auditUnavailable && <p className="text-sm text-mecg-orange-ink">Activity could not be loaded. What is shown here may be incomplete.</p>}
                  {!auditUnavailable && auditEvents.length === 0 && <p className="text-sm text-muted">No activity recorded, or you do not have permission to view activity for this cycle.</p>}
                  {priorCycles.length > 0 && (
                    <div className="mt-6">
                      <p className="text-[13px] font-semibold text-muted">Earlier applications</p>
                      <p className="mt-1 text-sm text-muted">
                        Applying again is not held against anyone. Screening reviewers and evaluators never see this.
                      </p>
                      <div className="mt-3 flex flex-col gap-2">
                        {priorCycles.map((prior) => (
                          <div key={`${prior.cycleName}-${prior.status}`} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-xl bg-white px-3.5 py-2.5 inset-ring inset-ring-line">
                            <span className="text-[13px] font-semibold text-mecg-navy">{prior.cycleName}</span>
                            <span className="text-[13px] text-muted">{applicationStatusLabel(prior.status)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {auditEvents.map((event) => (
                    <div key={event.id} className="flex items-start justify-between gap-3 rounded-xl bg-wash px-4 py-3 text-sm inset-ring inset-ring-line">
                      <div>
                        <p className="font-medium text-mecg-navy">{statusLabel(event.action)}</p>
                        <p className="text-xs text-muted">{event.actor_id ? (actorNameById.get(event.actor_id) ?? "Unknown board member") : "System"}</p>
                      </div>
                      <time className="shrink-0 tabular text-xs text-muted">{formatEasternDateTime(event.created_at)}</time>
                    </div>
                  ))}
                </div>
              ),
            }}
          />
        </div>
      </div>

      <Link href={returnTo} className="text-[13px] font-semibold text-mecg-orange-ink underline underline-offset-4">
        Back to Recruitment
      </Link>
    </main>
  );
}
