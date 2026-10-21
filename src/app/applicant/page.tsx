import type { Metadata } from "next";
import Link from "@/components/workspace-link";
import { redirect } from "next/navigation";
import { currentDestination, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";
import PortalShell from "@/components/portal-shell";
import LogoutButton from "@/components/logout-button";
import { BuddyButton, OfferButtons, SlotButton, SurveyForm, WithdrawButton } from "./actions";
import ApplicantStatusRefresh from "./status-refresh";
import HeadshotUpload from "./headshot-upload";
import ResumeReplace from "./resume-replace";
import { formatEasternDateTime, parseOffsetDateTime } from "@/lib/date-time";
import { decisionOutcomeLabel } from "@/lib/labels";
import ApplicantOnboarding from "./onboarding";
import { ONBOARDING_LABELS, onboardingRpc, parseApplicantOnboarding } from "./onboarding-data";
import ScheduleActionButton from "./schedule-action";
import { applicationEditAccess, editableApplicationNextAction, editableApplicationStatus } from "./application-status";
import { mapSearchUrl, safeHumanLocation } from "./safe-location";
import { scheduleNextAction, type ApplicantSchedule, type ApplicantScheduleState, type NextAction } from "./next-action";

export const metadata: Metadata = { title: "Applicant portal" };

const STAGE_LABELS = ["Submitted", "In review", "Final review", "Decision"] as const;
const IN_REVIEW_STATUSES = new Set(["ELIGIBLE", "INVITED", "GROUP_CASE", "IN_PROCESS"]);

function pipelineStage(displayStatus: string, released: boolean) {
  if (released) return 3;
  if (displayStatus === "FINAL_REVIEW") return 2;
  if (IN_REVIEW_STATUSES.has(displayStatus)) return 1;
  return 0; // Submitted applications; editable states do not render this stepper.
}

function DateTimeRange({ startsAt, endsAt }: { startsAt: string; endsAt: string }) {
  return (
    <>
      <time dateTime={startsAt}>{formatEasternDateTime(startsAt)}</time>
      {" to "}
      <time dateTime={endsAt}>{formatEasternDateTime(endsAt)}</time>
    </>
  );
}

function applicationHeadline(application: { display_status: string; released_outcome: string | null }) {
  const editable = editableApplicationStatus(application);
  if (editable) return editable.headline;
  if (application.display_status === "WITHDRAWN" && !application.released_outcome) return "Application withdrawn";
  if (application.released_outcome === "OFFER") return "You have an offer to join MECG.";
  if (application.released_outcome === "WAITLIST") return "You're on the waitlist.";
  if (application.released_outcome === "REJECT") return "We won't be extending an offer this cycle.";
  if (application.released_outcome) return decisionOutcomeLabel(application.released_outcome);
  return "Your application is moving through review.";
}

function LocationLink({ location }: { location: string | null | undefined }) {
  const safeLocation = safeHumanLocation(location);
  const mapUrl = mapSearchUrl(location);
  if (!safeLocation || !mapUrl) return null;
  return <a href={mapUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center font-semibold text-mecg-blue underline underline-offset-4">{safeLocation} · Map</a>;
}

function NextActionCard({ action }: { action: NextAction }) {
  return (
    <section className="applicant-next-action rounded-xl bg-white p-5 inset-ring inset-ring-line sm:p-6" aria-labelledby="next-action-heading">
      <p className="text-[13px] font-semibold text-mecg-orange-ink">{action.eyebrow}</p>
      <h2 id="next-action-heading" className="mt-2 text-xl font-semibold tracking-[-0.02em]">{action.title}</h2>
      <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted">{action.detail}</p>
      {action.href && action.label && (
        <Link href={action.href} className="button-primary mt-4 inline-flex text-sm">
          {action.label}
        </Link>
      )}
    </section>
  );
}

function scheduleFromJson(value: Json): ApplicantSchedule {
  return value && typeof value === "object" && !Array.isArray(value) ? value as ApplicantSchedule : {};
}

function StatusStepper({ stage, dark = false }: { stage: number; dark?: boolean }) {
  return (
    <ol className="mt-5 flex items-center">
      {STAGE_LABELS.map((label, index) => {
        const state = index < stage ? "done" : index === stage ? "current" : "upcoming";
        return (
          <li key={label} aria-current={state === "current" ? "step" : undefined} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <span
                className={`grid size-7 shrink-0 place-items-center rounded-full tabular text-xs ${
                  state === "current"
                    ? "bg-mecg-orange font-semibold text-mecg-navy"
                    : state === "done"
                      ? dark ? "bg-white text-mecg-navy" : "bg-mecg-navy text-white"
                      : dark ? "bg-white/10 text-white/70" : "bg-mecg-navy/10 text-muted"
                }`}
              >
                {state === "done" ? "✓" : index + 1}
              </span>
              <span
                className={`text-center text-xs font-medium ${
                  state === "current"
                    ? dark ? "text-white" : "text-mecg-navy"
                    : state === "done"
                      ? dark ? "text-white" : "text-muted"
                      : dark ? "text-white/70" : "text-muted"
                }`}
              >
                {label}{state === "current" && <span className="block font-semibold">Current</span>}
              </span>
            </div>
            {index < STAGE_LABELS.length - 1 && <div className={`mx-2 mb-4 h-px flex-1 ${index < stage ? (dark ? "bg-white/25" : "bg-mecg-navy/25") : (dark ? "bg-white/10" : "bg-mecg-navy/10")}`} />}
          </li>
        );
      })}
    </ol>
  );
}

function OutcomeCard({ outcome }: { outcome: string }) {
  if (outcome === "OFFER") {
    return (
      <div className="mt-1">
        <p className="text-[13px] text-mecg-orange-ink">Decision released</p>
        <h2 className="mt-2 text-2xl font-semibold">You have an offer to join MECG.</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">The Board reviewed your full file and would like to bring you into the group. Accept below to lock in your spot, or decline if it&rsquo;s not the right fit right now.</p>
      </div>
    );
  }
  if (outcome === "WAITLIST") {
    return (
      <div className="mt-1 rounded-xl bg-mecg-blue/10 p-4 inset-ring inset-ring-mecg-blue/20">
        <p className="text-[13px] text-mecg-blue">Waitlisted</p>
        <h2 className="mt-2 text-xl font-semibold">You&rsquo;re on the waitlist.</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">We don&rsquo;t have a spot to offer right now, but your file stays active. If room opens up in this cohort, we&rsquo;ll come back to it, no action needed from you. Anything that changes will show up here first.</p>
      </div>
    );
  }
  if (outcome === "REJECT") {
    return (
      <div className="mt-1 rounded-xl bg-wash p-4 inset-ring inset-ring-line">
        <p className="text-[13px] text-muted">Decision released</p>
        <h2 className="mt-2 text-xl font-semibold">We won&rsquo;t be extending an offer this cycle.</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Thank you for the time you put into your application. There is nothing further you need to submit for this cycle.</p>
      </div>
    );
  }
  return (
    <div className="mt-1">
      <p className="text-[13px] text-muted">Decision released</p>
      <h2 className="mt-2 text-xl font-semibold">{decisionOutcomeLabel(outcome)}</h2>
    </div>
  );
}

export default async function ApplicantDashboard({ searchParams }: { searchParams: Promise<{ submitted?: string; action?: string }> }) {
  const { submitted, action } = await searchParams;
  await requireUser();
  const destination = await currentDestination();
  // /apply is allowed through. A past applicant with a newly open cycle is now
  // routed there on login, but must still be able to open their own history.
  if (destination !== "/applicant" && destination !== "/apply") redirect(destination ?? "/login");
  const supabase = await createClient();
  const [{ data: applications, error }, { data: schedule, error: scheduleError }, { data: canStartApplication }, messagesResult, deadlinesResult, recruitmentResult] = await Promise.all([
    supabase.rpc("applicant_dashboard"),
    supabase.rpc("applicant_schedule"),
    supabase.rpc("can_start_application"),
    // messages_read_internal already lets an applicant read their own rows, so
    // this needs no new access path. Removes the "check your spam folder"
    // support load: what we sent is visible where they already are.
    supabase.from("messages").select("id,kind,subject,created_at,application_id").order("created_at", { ascending: false }),
    supabase.rpc("my_offer_deadlines"),
    // Same public RPC the /join page uses. The stepper says which of four
    // stages they are in; this says what actually happens next and when.
    supabase.rpc("public_recruitment"),
  ]);
  if (error) throw error;
  if (!applications?.length) redirect("/apply");
  let editableIntake: unknown = null;
  let ownedEditableApplications: unknown = null;
  const editableIds = applications.filter((application) => editableApplicationStatus(application)).map((application) => application.application_id);
  if (editableIds.length > 0) {
    try {
      const [intakeResult, ownedResult] = await Promise.all([
        supabase.rpc("intake_schema"),
        supabase.from("applications").select("id,cycle_id,status").in("id", editableIds),
      ]);
      if (intakeResult.error) console.error("applicant editing access lookup failed", intakeResult.error);
      if (ownedResult.error) console.error("applicant application identity lookup failed", ownedResult.error);
      editableIntake = intakeResult.error ? null : intakeResult.data;
      ownedEditableApplications = ownedResult.error ? null : ownedResult.data;
    } catch (accessError) { console.error("applicant editing access lookup failed", accessError); }
  }
  const onboardingResult = await onboardingRpc<unknown>(supabase, "my_member_onboarding");
  if (onboardingResult.error) console.error("member onboarding lookup failed", onboardingResult.error);
  if (scheduleError) console.error("applicant schedule lookup failed", scheduleError);
  if (messagesResult.error) console.error("applicant message lookup failed", messagesResult.error);
  if (deadlinesResult.error) console.error("offer deadline lookup failed", deadlinesResult.error);
  if (recruitmentResult.error) console.error("recruitment schedule lookup failed", recruitmentResult.error);
  const recruitment = recruitmentResult.data && typeof recruitmentResult.data === "object" && !Array.isArray(recruitmentResult.data)
    ? recruitmentResult.data as { events?: Array<{ id: string; name: string; startsAt: string; location?: string | null }> }
    : {};
  const now = new Date().getTime();
  const timeline = (recruitment.events ?? [])
    .filter((event) => typeof event?.startsAt === "string" && typeof event?.name === "string")
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  const deadlineData: unknown = deadlinesResult.data;
  const deadlines: Record<string, string | null> = {};
  let deadlinesAvailable = !deadlinesResult.error && !!deadlineData && typeof deadlineData === "object" && !Array.isArray(deadlineData);
  if (deadlinesAvailable && deadlineData && typeof deadlineData === "object") {
    for (const [applicationId, value] of Object.entries(deadlineData)) {
      if (value === null || (typeof value === "string" && parseOffsetDateTime(value))) deadlines[applicationId] = value;
      else deadlinesAvailable = false;
    }
  }
  // The RPC deliberately omits applications whose offer_expires_at is null.
  // A missing key in a successful valid map means no deadline; a bad map is unknown.
  const messagesByApplication = new Map<string, Array<{ id: string; kind: string; subject: string; created_at: string }>>();
  for (const message of messagesResult.data ?? []) {
    if (!message.application_id) continue;
    const existing = messagesByApplication.get(message.application_id) ?? [];
    existing.push(message);
    messagesByApplication.set(message.application_id, existing);
  }
  const dashboardApplications = applications;
  const scheduleState: ApplicantScheduleState = scheduleError
    ? { kind: "unavailable" }
    : { kind: "loaded", plan: scheduleFromJson(schedule) };
  const plan = scheduleState.kind === "loaded" ? scheduleState.plan : {};
  const confirmedSlotIds = new Set((plan.rsvps ?? []).map((item) => item.slotId));
  const confirmedBookingsByEvent = new Map((plan.rsvps ?? []).map((item) => [item.eventId, item]));
  const confirmedBuddies = plan.buddies ?? (plan.buddy ? [plan.buddy] : []);
  const buddyByCycle = new Map(confirmedBuddies.map((item) => [item.cycleId, item]));
  const releasedSurveyApplication = dashboardApplications.find((application) => application.released_outcome);
  const heroApplication = dashboardApplications[0];
  let submissionConfirmed = false;
  if (submitted && dashboardApplications.some((application) => application.application_id === submitted)) {
    try {
      const receipt = await supabase.from("applications").select("id,status,submitted_at").eq("id", submitted).maybeSingle();
      submissionConfirmed = !receipt.error && receipt.data?.id === submitted && !!receipt.data.submitted_at && !["DRAFT", "NEEDS_INFO", "WITHDRAWN"].includes(receipt.data.status);
    } catch { /* Keep the independently loaded dashboard; an uncertain receipt is not success. */ }
  }
  const onboardingItems = parseApplicantOnboarding(onboardingResult.data).filter((item) => item.applicationId === heroApplication.application_id);
  const onboardingRemaining = onboardingItems.filter((item) => !item.completedAt).length;
  const applicantOnboardingRemaining = onboardingItems.filter((item) => !item.completedAt && ONBOARDING_LABELS[item.key]?.selfCompletable).length;
  const heroEditable = editableApplicationStatus(heroApplication);
  const heroEditAccess = applicationEditAccess({ applicationId: heroApplication.application_id, intake: editableIntake, ownedApplications: ownedEditableApplications });
  const offerDeadline = deadlines[heroApplication.application_id];
  const offerExpired = offerDeadline ? new Date(offerDeadline).getTime() <= now : false;
  let nextAction: NextAction;
  if (heroApplication.released_outcome === "OFFER" && !heroApplication.offer_response && !deadlinesAvailable) {
    nextAction = {
      eyebrow: "Offer deadline unavailable",
      title: "Check your offer response window",
      detail: "We could not verify your deadline. Retry below or contact the Board before relying on the response window.",
      href: "#current-application", label: "View retry options",
    };
  } else if (heroApplication.released_outcome === "OFFER" && !heroApplication.offer_response && !offerExpired) {
    nextAction = {
      eyebrow: "Decision ready",
      title: "Respond to your offer",
      detail: offerDeadline ? `Choose by ${formatEasternDateTime(offerDeadline, "full")}.` : "Review the offer and record your response.",
      href: "#current-application",
      label: "Review offer",
    };
  } else if (heroApplication.released_outcome === "OFFER" && !heroApplication.offer_response && offerExpired) {
    nextAction = {
      eyebrow: "Response window closed",
      title: "Your offer deadline has passed",
      detail: "Contact the Board if you still want to join MECG.",
      href: "mailto:mecg-board@umich.edu",
      label: "Contact the Board",
    };
  } else if (heroApplication.offer_response === "ACCEPTED" && onboardingRemaining > 0) {
    nextAction = {
      eyebrow: "Member onboarding",
      title: applicantOnboardingRemaining > 0
        ? `${applicantOnboardingRemaining} ${applicantOnboardingRemaining === 1 ? "step" : "steps"} for you to complete`
        : "Your steps are complete",
      detail: applicantOnboardingRemaining > 0
        ? "Review your contact and profile details below. Board-owned steps are listed separately."
        : "MECG is completing the remaining onboarding steps. You can check their progress below.",
      href: "#member-onboarding",
      label: "Continue onboarding",
    };
  } else if (heroEditable && (heroEditAccess === "available" || canStartApplication !== true)) {
    nextAction = editableApplicationNextAction(heroEditable, heroEditAccess);
  } else if (canStartApplication === true) {
    nextAction = {
      eyebrow: "Next action",
      title: "Start this cycle's application",
      detail: "Applications are open and your earlier applications will stay available here.",
      href: "/apply",
      label: "Start application",
    };
  } else if (heroApplication.released_outcome) {
    nextAction = {
      eyebrow: "No action needed",
      title: heroApplication.offer_response === "ACCEPTED"
        ? "Your acceptance is recorded"
        : heroApplication.offer_response === "DECLINED"
          ? "Your response is recorded"
          : "Your decision is complete",
      detail: heroApplication.offer_response === "ACCEPTED"
        ? "The Board will follow up with onboarding details. Any update will also appear here."
        : "There is nothing else you need to submit for this cycle.",
    };
  } else {
    nextAction = scheduleNextAction({ schedule: scheduleState, now });
  }

  return (
    <PortalShell
      eyebrow={heroApplication.applicant_name}
      title={applicationHeadline(heroApplication)}
      description={`${heroApplication.cycle_name} · Attendance and coffee chats are never scores.`}
      workspace
      headerAction={<LogoutButton />}
      heroExtra={heroEditable ? <p className="text-sm font-semibold text-mecg-orange-ink">{heroEditable.label}</p> : undefined}
    >
      <div className="applicant-dashboard-layout">
        {submissionConfirmed && (
          <section role="status" className="panel-seat rounded-xl bg-success-wash p-6 text-success inset-ring inset-ring-success/15">
            <p className="text-[13px] text-success">Application received</p>
            <h2 className="mt-3 text-2xl font-semibold">You are all set.</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-900/70">MECG received your application. Your written packet omits profile identifiers. Assigned reviewers may view your original resume, which can identify you. Released updates will appear on this page.</p>
          </section>
        )}
        {(action === "rsvp" || action === "buddy" || action === "schedule") && (
          <section role="status" className="panel-seat rounded-xl bg-success-wash p-4 text-sm text-success inset-ring inset-ring-success/15">
            {action === "rsvp" ? "Your RSVP is confirmed." : action === "buddy" ? "Your member chat is booked." : "Your schedule was updated."}
          </section>
        )}
        <NextActionCard action={nextAction} />
        {onboardingItems.length > 0 && <ApplicantOnboarding items={onboardingItems} />}
        {dashboardApplications.map((application) => {
          const responses = Array.isArray(application.responses) ? application.responses as { key: string; prompt?: string; answer?: string }[] : [];
          const editable = editableApplicationStatus(application);
          const editAccess = applicationEditAccess({ applicationId: application.application_id, intake: editableIntake, ownedApplications: ownedEditableApplications });
          const withdrawn = application.display_status === "WITHDRAWN" && !application.released_outcome;
          const isCurrentApplication = application.application_id === heroApplication.application_id;
          return (
            <details id={isCurrentApplication ? "current-application" : undefined} key={application.application_id} open={isCurrentApplication} className="scroll-mt-6 rounded-xl bg-wash p-6 inset-ring inset-ring-line">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 marker:content-none">
                <span>
                  <span className="block text-[13px] font-semibold text-muted">{application.cycle_name}</span>
                  <span className="mt-1 block text-sm text-muted">{isCurrentApplication ? "Current application" : "Earlier application"}{editable ? ` · ${editable.label}` : ""}</span>
                </span>
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className="disclosure-chevron shrink-0 text-mecg-blue" aria-hidden="true">
                  <path d="M5 8l5 5 5-5" />
                </svg>
              </summary>
              <div className="disclosure-panel">
              {editable ? (
                <>
                  <p className="mt-3 text-2xl font-semibold">{editable.headline}</p>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{editable.detail}</p>
                  {!isCurrentApplication && <p className="mt-2 text-sm text-muted">{editAccess === "available" ? "You can continue this application in the application workspace." : editAccess === "unavailable" ? "Editing and submission are not available for this application right now." : "We could not verify editing and submission access for this application."}</p>}
                  {editAccess === "available" && <Link href="/apply" className="button-secondary mt-4 inline-flex text-sm">{editable.actionLabel}</Link>}
                </>
              ) : withdrawn ? (
                <>
                  <p className="mt-3 text-2xl font-semibold">Application withdrawn</p>
                  <p className="mt-2 text-sm leading-6 text-muted">This application is no longer in the running.</p>
                </>
              ) : application.released_outcome ? (
                <>
                  <OutcomeCard outcome={application.released_outcome} />
                  {application.application_id !== heroApplication.application_id && <StatusStepper stage={pipelineStage(application.display_status, true)} />}
                </>
              ) : (
                <>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">No final outcome has been released yet. Check for updates here.</p>
                  {application.application_id !== heroApplication.application_id && <StatusStepper stage={pipelineStage(application.display_status, false)} />}
                  <ApplicantStatusRefresh />
                </>
              )}
              <p className="mt-4 text-sm text-muted">{application.has_resume ? "Resume on file." : "No resume on file."}</p>
              {/* The RPCs refuse a replacement once a screening packet exists or
                  the window closes; this only hides the control for files that
                  are already finished either way. */}
              {!withdrawn && !editable && !application.released_outcome && application.display_status !== "REJECTED" && (
                <>
                  <ResumeReplace hasResume={application.has_resume} />
                  <HeadshotUpload />
                </>
              )}
              {application.released_outcome === "OFFER" && (
                <>
                  {(() => {
                    const deadline = deadlines[application.application_id];
                    if (application.offer_response) return null;
                    if (!deadlinesAvailable) return (
                      <div role="alert" className="mt-4 rounded-xl bg-warning-wash px-4 py-3 text-sm text-warning">
                        <p>We could not verify your offer deadline. Your response window may have closed.</p>
                        <form action="/applicant#current-application" method="get" className="mt-3"><button type="submit" className="button-secondary">Retry offer deadline lookup</button></form>
                        <a href="mailto:mecg-board@umich.edu" className="mt-3 inline-flex min-h-11 items-center underline">Contact the Board</a>
                      </div>
                    );
                    if (!deadline) return null;
                    const expired = new Date(deadline).getTime() <= Date.now();
                    return (
                      <p className={`mt-4 rounded-xl px-4 py-3 text-sm font-medium ${expired ? "bg-danger-wash text-danger" : "bg-mecg-orange/15 text-mecg-orange-ink"}`}>
                        {expired ? "This offer expired on " : "Respond by "}
                        <time dateTime={deadline}>
                          {formatEasternDateTime(deadline, "full")}
                        </time>
                        {expired ? ". Contact the board if you still want to join." : "."}
                      </p>
                    );
                  })()}
                  {(deadlinesAvailable || application.offer_response) && <OfferButtons applicationId={application.application_id} initialResponse={application.offer_response as "ACCEPTED" | "DECLINED" | null} />}
                </>
              )}
              {/* The RPC refuses DRAFT, WITHDRAWN and REJECTED; mirror that here
                  so the option only appears when it would actually work. An
                  answered offer is already a final decision either way. */}
              {!withdrawn
                && !["DRAFT", "REJECTED"].includes(application.display_status)
                && !application.offer_response && (
                <WithdrawButton applicationId={application.application_id} />
              )}
              {(messagesByApplication.get(application.application_id)?.length ?? 0) > 0 && (
                <details className="applicant-record-disclosure mt-5">
                  <summary className="min-h-11 cursor-pointer font-semibold">Message history</summary>
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {(messagesByApplication.get(application.application_id) ?? []).map((message) => (
                      <li key={message.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 rounded-xl bg-white px-3.5 py-2.5 inset-ring inset-ring-line">
                        <span className="text-[13px] font-medium text-mecg-navy">{message.subject}</span>
                        <time dateTime={message.created_at} className="tabular text-xs text-muted">
                          {formatEasternDateTime(message.created_at)}
                        </time>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-muted">These are message records, not confirmation of inbox delivery. Check spam if a message is missing.</p>
                </details>
              )}
              {responses.length > 0 && (
                <details className="applicant-record-disclosure mt-5">
                  <summary className="min-h-11 cursor-pointer font-semibold">{editable ? "Saved answers" : "Application answers"}</summary>
                  <dl className="mt-3 space-y-4">
                  {responses.map((response) => (
                    <div key={response.key}>
                      <dt className="text-sm font-medium">{response.prompt}</dt>
                      <dd className="mt-1 whitespace-pre-wrap text-sm leading-6 text-muted">{response.answer}</dd>
                    </div>
                  ))}
                  </dl>
                </details>
              )}
              </div>
            </details>
          );
        })}
        <section id="applicant-schedule" className="scroll-mt-6 rounded-xl p-6 inset-ring inset-ring-line">
          <h2 className="text-lg font-semibold">Your schedule</h2>
          <p className="mt-1 text-xs text-muted">All times are Eastern. Calendar downloads are a snapshot of the event.</p>
          {scheduleState.kind === "unavailable" ? (
            <div role="alert" className="mt-4">
              <p className="font-semibold">Your schedule could not be loaded</p>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">We could not check your bookings or available times. Retry the lookup, or contact the recruitment team if this continues.</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <form action="/applicant#applicant-schedule" method="get">
                  <button type="submit" className="button-primary text-sm">Retry schedule lookup</button>
                </form>
                <a href="mailto:mecg-board@umich.edu" className="button-secondary text-sm">Contact recruitment team</a>
              </div>
            </div>
          ) : (
            <>
              <p className="mt-1 text-[13px] text-muted">Confirmed</p>
              <ul className="mt-2 space-y-2">
                {(plan.rsvps ?? []).map((item) => (
                  <li key={item.slotId} className="flex flex-col gap-3 rounded-xl bg-wash px-4 py-3 text-sm inset-ring inset-ring-line sm:flex-row sm:items-center sm:justify-between">
                    <div><span className="font-medium">{item.eventName}</span><span className="text-muted"> · <DateTimeRange startsAt={item.startsAt} endsAt={item.endsAt} /></span><div className="mt-1 flex flex-wrap gap-3"><LocationLink location={item.location} /><a href={`/api/events/${item.eventId}/ics`} className="inline-flex min-h-11 items-center font-semibold text-mecg-blue underline underline-offset-4">Add to calendar</a></div></div>
                    {new Date(item.startsAt).getTime() > now && <ScheduleActionButton action="CANCEL_RSVP" currentSlotId={item.slotId} label="Cancel RSVP" confirmationText={`${item.eventName} · ${formatEasternDateTime(item.startsAt)}. This removes your booking.`} />}
                  </li>
                ))}
                {!plan.rsvps?.length && <li className="text-sm text-muted">No RSVPs yet.</li>}
              </ul>
              {plan.group && <p className="mt-4 text-sm"><span className="font-medium">{plan.group.name}.</span> {plan.group.prompt}</p>}
              {confirmedBuddies.map((buddy) => <div key={buddy.slotId} className="mt-2 flex flex-col gap-3 rounded-xl bg-wash px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"><span>Member chat: <DateTimeRange startsAt={buddy.startsAt} endsAt={buddy.endsAt} /></span>{new Date(buddy.startsAt).getTime() > now && <ScheduleActionButton action="CANCEL_BUDDY" currentSlotId={buddy.slotId} label="Cancel chat" confirmationText={`Member chat · ${formatEasternDateTime(buddy.startsAt)}. This removes your booking.`} />}</div>)}
              {(Boolean(plan.openSlots?.some((slot) => slot.remaining > 0 && !confirmedSlotIds.has(slot.id))) || Boolean(plan.openBuddy?.length)) && (
                <>
                  <p className="mt-5 text-[13px] text-muted">Open slots</p>
                  <div className="mt-2 space-y-2">
                    {(plan.openSlots ?? []).filter((slot) => slot.remaining > 0 && !confirmedSlotIds.has(slot.id)).map((slot) => {
                      const booked = confirmedBookingsByEvent.get(slot.eventId);
                      return <div key={slot.id} className="flex flex-col items-start justify-between gap-3 rounded-xl bg-wash px-4 py-3 text-sm inset-ring inset-ring-line sm:flex-row sm:items-center">
                        <span>{slot.eventName} · <DateTimeRange startsAt={slot.startsAt} endsAt={slot.endsAt} /></span>
                        {booked
                          ? <ScheduleActionButton action="RESCHEDULE_RSVP" currentSlotId={booked.slotId} nextSlotId={slot.id} label="Change to this time" confirmationText={`${slot.eventName}: ${formatEasternDateTime(booked.startsAt)} → ${formatEasternDateTime(slot.startsAt)}. Your current booking is replaced only if this change succeeds.`} />
                          : <SlotButton id={slot.id} />}
                      </div>;
                    })}
                    {(plan.openBuddy ?? []).map((slot) => {
                      const booked = buddyByCycle.get(slot.cycleId);
                      return <div key={slot.id} className="flex flex-col items-start justify-between gap-3 rounded-xl bg-wash px-4 py-3 text-sm inset-ring inset-ring-line sm:flex-row sm:items-center">
                        <span>Member chat · <DateTimeRange startsAt={slot.startsAt} endsAt={slot.endsAt} /></span>
                        {booked
                          ? <ScheduleActionButton action="RESCHEDULE_BUDDY" currentSlotId={booked.slotId} nextSlotId={slot.id} label="Change to this time" confirmationText={`Member chat: ${formatEasternDateTime(booked.startsAt)} → ${formatEasternDateTime(slot.startsAt)}. Your current booking is replaced only if this change succeeds.`} />
                          : <BuddyButton id={slot.id} />}
                      </div>;
                    })}
                  </div>
                </>
              )}
            </>
          )}
        </section>
        {timeline.length > 0 && (
          <details className="applicant-timeline rounded-xl bg-wash p-6 inset-ring inset-ring-line">
            <summary className="min-h-11 cursor-pointer font-semibold">Recruitment dates</summary>
            <ol className="mt-4 flex flex-col gap-2">
              {timeline.map((event) => {
                const past = new Date(event.startsAt).getTime() < now;
                return (
                  <li key={event.id} className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl bg-white px-4 py-3 inset-ring inset-ring-line ${past ? "opacity-50" : ""}`}>
                    <span className="text-sm font-semibold text-mecg-navy">{event.name}</span>
                    <span className="text-right text-xs text-muted">
                      <time dateTime={event.startsAt}>
                        {formatEasternDateTime(event.startsAt)}
                      </time>
                      {safeHumanLocation(event.location) && <> · <LocationLink location={event.location} /></>}
                      {!past && <a href={`/api/events/${event.id}/ics`} className="ml-3 inline-flex min-h-11 items-center font-semibold text-mecg-blue underline underline-offset-4">Add to calendar</a>}
                    </span>
                  </li>
                );
              })}
            </ol>
            <p className="mt-3 text-xs text-muted">Published recruitment dates. Your confirmed bookings and available times are in Your schedule.</p>
          </details>
        )}
        {releasedSurveyApplication && (
          <section className="rounded-xl p-6 inset-ring inset-ring-line">
            <h2 className="text-lg font-semibold">How was this cycle?</h2>
            {releasedSurveyApplication.survey_submitted ? (
              <p className="mt-4 text-sm text-muted">{"Thanks for the feedback. It's anonymous and goes straight to the Board."}</p>
            ) : (
              <SurveyForm applicationId={releasedSurveyApplication.application_id} />
            )}
          </section>
        )}
      </div>
    </PortalShell>
  );
}
