import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentDestination, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";
import PortalShell from "@/components/portal-shell";
import LogoutButton from "@/components/logout-button";
import { BuddyButton, OfferButtons, SlotButton, SurveyForm, WithdrawButton } from "./actions";
import ApplicantStatusRefresh from "./status-refresh";

export const metadata: Metadata = { title: "Applicant portal" };

const STAGE_LABELS = ["Submitted", "In review", "Final review", "Decision"] as const;
const IN_REVIEW_STATUSES = new Set(["ELIGIBLE", "INVITED", "IN_PROCESS"]);

function pipelineStage(displayStatus: string, released: boolean) {
  if (released) return 3;
  if (displayStatus === "FINAL_REVIEW") return 2;
  if (IN_REVIEW_STATUSES.has(displayStatus)) return 1;
  return 0; // SUBMITTED, NEEDS_INFO
}

function DateTimeRange({ startsAt, endsAt }: { startsAt: string; endsAt: string }) {
  const format = (value: string) => new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  return (
    <>
      <time dateTime={startsAt}>{format(startsAt)}</time>
      {" to "}
      <time dateTime={endsAt}>{format(endsAt)}</time>
    </>
  );
}

type ApplicantSchedule = {
  rsvps?: { slotId: string; eventName: string; startsAt: string; endsAt: string; location: string | null }[];
  group?: { name: string; prompt: string } | null;
  buddy?: { startsAt: string; endsAt: string } | null;
  openSlots?: { id: string; eventName: string; startsAt: string; endsAt: string; remaining: number }[];
  openBuddy?: { id: string; startsAt: string; endsAt: string }[];
};

function scheduleFromJson(value: Json): ApplicantSchedule {
  return value && typeof value === "object" && !Array.isArray(value) ? value as ApplicantSchedule : {};
}

function StatusStepper({ stage }: { stage: number }) {
  return (
    <ol className="mt-5 flex items-center">
      {STAGE_LABELS.map((label, index) => {
        const state = index < stage ? "done" : index === stage ? "current" : "upcoming";
        return (
          <li key={label} aria-current={state === "current" ? "step" : undefined} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <span
                className={`grid size-7 shrink-0 place-items-center rounded-full font-mono text-xs ${
                  state === "current"
                    ? "bg-mecg-orange font-semibold text-mecg-navy"
                    : state === "done"
                      ? "bg-mecg-navy text-white"
                      : "bg-mecg-navy/[0.08] text-mecg-navy/60"
                }`}
              >
                {state === "done" ? "✓" : index + 1}
              </span>
              <span className={`text-center text-[11px] font-medium ${state === "current" ? "text-mecg-navy" : state === "done" ? "text-mecg-navy/65" : "text-mecg-navy/60"}`}>
                {label}{state === "current" && <span className="block font-semibold">Current</span>}
              </span>
            </div>
            {index < STAGE_LABELS.length - 1 && <div className={`mx-2 mb-4 h-px flex-1 ${index < stage ? "bg-mecg-navy/25" : "bg-mecg-navy/10"}`} />}
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
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-mecg-orange-ink">Decision released</p>
        <h2 className="mt-2 text-2xl font-semibold">You have an offer to join MECG.</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-mecg-navy/65">The Board reviewed your full file and would like to bring you into the group. Accept below to lock in your spot, or decline if it&rsquo;s not the right fit right now.</p>
      </div>
    );
  }
  if (outcome === "WAITLIST") {
    return (
      <div className="mt-1 rounded-xl bg-mecg-blue/[0.06] p-4 shadow-[inset_0_0_0_1px_rgba(63,99,175,0.18)]">
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-mecg-blue">Waitlisted</p>
        <h2 className="mt-2 text-xl font-semibold">You&rsquo;re on the waitlist.</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-mecg-navy/65">We don&rsquo;t have a spot to offer right now, but your file stays active. If room opens up in this cohort, we&rsquo;ll come back to it, no action needed from you. Anything that changes will show up here first.</p>
      </div>
    );
  }
  if (outcome === "REJECT") {
    return (
      <div className="mt-1 rounded-xl bg-mecg-navy/[0.03] p-4 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)]">
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-mecg-navy/45">Decision released</p>
        <h2 className="mt-2 text-xl font-semibold">We won&rsquo;t be extending an offer this cycle.</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-mecg-navy/65">This was a genuinely competitive process, and the call came down to cohort fit and the limited spots we had this rush, not a shortfall in what you brought to it. Thank you for the time you put into your application and for showing up to our events, we hope you&rsquo;ll stay in touch.</p>
      </div>
    );
  }
  return (
    <div className="mt-1">
      <p className="font-mono text-xs uppercase tracking-[0.16em] text-mecg-navy/45">Decision released</p>
      <h2 className="mt-2 text-xl font-semibold">{outcome.replaceAll("_", " ")}</h2>
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
  const [{ data: applications, error }, { data: schedule }, { data: canStartApplication }, messagesResult, deadlinesResult] = await Promise.all([
    supabase.rpc("applicant_dashboard"),
    supabase.rpc("applicant_schedule"),
    supabase.rpc("can_start_application"),
    // messages_read_internal already lets an applicant read their own rows, so
    // this needs no new access path. Removes the "check your spam folder"
    // support load: what we sent is visible where they already are.
    supabase.from("messages").select("id,kind,subject,created_at,application_id").order("created_at", { ascending: false }),
    supabase.rpc("my_offer_deadlines"),
  ]);
  if (error) throw error;
  if (!applications?.length) redirect("/apply");
  if (messagesResult.error) console.error("applicant message lookup failed", messagesResult.error);
  if (deadlinesResult.error) console.error("offer deadline lookup failed", deadlinesResult.error);
  const deadlines = deadlinesResult.data && typeof deadlinesResult.data === "object" && !Array.isArray(deadlinesResult.data)
    ? deadlinesResult.data as Record<string, string | null>
    : {};
  const messagesByApplication = new Map<string, Array<{ id: string; kind: string; subject: string; created_at: string }>>();
  for (const message of messagesResult.data ?? []) {
    if (!message.application_id) continue;
    const existing = messagesByApplication.get(message.application_id) ?? [];
    existing.push(message);
    messagesByApplication.set(message.application_id, existing);
  }
  const dashboardApplications = applications;
  const plan = scheduleFromJson(schedule);
  const confirmedSlotIds = new Set((plan.rsvps ?? []).map((item) => item.slotId));
  const releasedSurveyApplication = dashboardApplications.find((application) => application.released_outcome);

  return (
    <PortalShell
      eyebrow="Applicant portal"
      title={`Welcome, ${dashboardApplications[0].applicant_name}.`}
      description="Your application, schedule, and released decisions live here. Attendance and coffee chats are never scores."
      workspace
      headerAction={<LogoutButton />}
    >
      <div className="space-y-4">
        {submitted === "1" && (
          <section role="status" className="rounded-2xl bg-emerald-50 p-6 text-emerald-950 shadow-[inset_0_0_0_1px_rgba(4,120,87,0.14)]">
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-emerald-700">Application received</p>
            <h2 className="mt-3 text-2xl font-semibold">You are all set.</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-900/70">MECG received your application. Your written responses will enter anonymous first-pass review, and any released updates will appear on this page.</p>
          </section>
        )}
        {canStartApplication === true && (
          <section className="rounded-2xl bg-mecg-orange/[0.12] p-6 shadow-[inset_0_0_0_1px_rgba(254,144,77,0.4)]">
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-mecg-orange-ink">Applications are open</p>
            <h2 className="mt-3 text-2xl font-semibold">You can apply again this cycle.</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-mecg-navy/65">
              A new recruitment cycle is accepting applications and you have not started one yet. Your earlier
              applications stay on this page.
            </p>
            <Link href="/apply" className="button-primary mt-5 inline-flex">Start a new application</Link>
          </section>
        )}
        {(action === "rsvp" || action === "buddy") && (
          <section role="status" className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-950 shadow-[inset_0_0_0_1px_rgba(4,120,87,0.14)]">
            {action === "rsvp" ? "Your RSVP is confirmed." : "Your member chat is booked."}
          </section>
        )}
        {dashboardApplications.map((application) => {
          const responses = Array.isArray(application.responses) ? application.responses as { key: string; prompt?: string; answer?: string }[] : [];
          const withdrawn = application.display_status === "WITHDRAWN" && !application.released_outcome;
          return (
            <section key={application.application_id} className="rounded-2xl bg-mecg-navy/[0.035] p-6 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.08)]">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-mecg-navy/45">{application.cycle_name}</p>
              {withdrawn ? (
                <>
                  <p className="mt-3 text-2xl font-semibold">Application withdrawn</p>
                  <p className="mt-2 text-sm leading-6 text-mecg-navy/60">This application is no longer active in the pipeline.</p>
                </>
              ) : application.released_outcome ? (
                <>
                  <OutcomeCard outcome={application.released_outcome} />
                  <StatusStepper stage={pipelineStage(application.display_status, true)} />
                </>
              ) : (
                <>
                  <p className="mt-3 text-2xl font-semibold">Your application is moving through review.</p>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-mecg-navy/60">No final outcome has been released yet. This page updates automatically once the Board releases a decision.</p>
                  <StatusStepper stage={pipelineStage(application.display_status, false)} />
                  <ApplicantStatusRefresh />
                </>
              )}
              <p className="mt-4 text-sm text-mecg-navy/55">{application.has_resume ? "Resume on file." : "No resume on file."}</p>
              {application.released_outcome === "OFFER" && (
                <>
                  {(() => {
                    const deadline = deadlines[application.application_id];
                    if (!deadline || application.offer_response) return null;
                    const expired = new Date(deadline).getTime() <= Date.now();
                    return (
                      <p className={`mt-4 rounded-xl px-4 py-3 text-sm font-medium ${expired ? "bg-red-50 text-red-800" : "bg-mecg-orange/[0.14] text-mecg-orange-ink"}`}>
                        {expired ? "This offer expired on " : "Respond by "}
                        <time dateTime={deadline}>
                          {new Date(deadline).toLocaleString("en-US", { dateStyle: "full", timeStyle: "short", timeZone: "America/Detroit" })}
                        </time>
                        {expired ? ". Contact the board if you still want to join." : "."}
                      </p>
                    );
                  })()}
                  <OfferButtons applicationId={application.application_id} initialResponse={application.offer_response as "ACCEPTED" | "DECLINED" | null} />
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
                <div className="mt-5">
                  <p className="font-mono text-xs uppercase tracking-[0.16em] text-mecg-navy/45">What we have sent you</p>
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {(messagesByApplication.get(application.application_id) ?? []).map((message) => (
                      <li key={message.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 rounded-xl bg-white px-3.5 py-2.5 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.08)]">
                        <span className="text-[13px] font-medium text-mecg-navy">{message.subject}</span>
                        <time dateTime={message.created_at} className="font-mono text-[11px] tabular-nums text-mecg-navy/45">
                          {new Date(message.created_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
                        </time>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-mecg-navy/45">If something here never reached your inbox, check your spam folder.</p>
                </div>
              )}
              {responses.length > 0 && (
                <dl className="mt-5 space-y-4">
                  {responses.map((response) => (
                    <div key={response.key}>
                      <dt className="text-sm font-medium">{response.prompt}</dt>
                      <dd className="mt-1 whitespace-pre-wrap text-sm leading-6 text-mecg-navy/65">{response.answer}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </section>
          );
        })}
        <section className="rounded-2xl p-6 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.08)]">
          <h2 className="text-lg font-semibold">Your schedule</h2>
          <p className="mt-1 font-mono text-xs uppercase tracking-[0.16em] text-mecg-navy/40">Confirmed</p>
          <ul className="mt-2 space-y-2">
            {(plan.rsvps ?? []).map((item) => (
              <li key={item.slotId} className="rounded-xl bg-mecg-navy/[0.035] px-4 py-3 text-sm shadow-[inset_0_0_0_1px_rgba(7,13,31,0.08)]">
                <span className="font-medium">{item.eventName}</span>
                <span className="text-mecg-navy/70"> · <DateTimeRange startsAt={item.startsAt} endsAt={item.endsAt} />{item.location ? ` · ${item.location}` : ""}</span>
              </li>
            ))}
            {!plan.rsvps?.length && <li className="text-sm text-mecg-navy/65">No RSVPs yet.</li>}
          </ul>
          {plan.group && <p className="mt-4 text-sm"><span className="font-medium">{plan.group.name}.</span> {plan.group.prompt}</p>}
          {plan.buddy && <p className="mt-2 text-sm">Member chat: <DateTimeRange startsAt={plan.buddy.startsAt} endsAt={plan.buddy.endsAt} /></p>}
          {(Boolean(plan.openSlots?.some((slot) => slot.remaining > 0 && !confirmedSlotIds.has(slot.id))) || Boolean(plan.openBuddy?.length)) && (
            <>
              <p className="mt-5 font-mono text-xs uppercase tracking-[0.16em] text-mecg-navy/40">Open slots</p>
              <div className="mt-2 space-y-2">
                {(plan.openSlots ?? []).filter((slot) => slot.remaining > 0 && !confirmedSlotIds.has(slot.id)).map((slot) => (
                  <div key={slot.id} className="flex flex-col items-start justify-between gap-3 rounded-xl bg-mecg-navy/[0.035] px-4 py-3 text-sm shadow-[inset_0_0_0_1px_rgba(7,13,31,0.08)] sm:flex-row sm:items-center">
                    <span>{slot.eventName} · <DateTimeRange startsAt={slot.startsAt} endsAt={slot.endsAt} /></span>
                    <SlotButton id={slot.id} />
                  </div>
                ))}
                {(plan.openBuddy ?? []).map((slot) => (
                  <div key={slot.id} className="flex flex-col items-start justify-between gap-3 rounded-xl bg-mecg-navy/[0.035] px-4 py-3 text-sm shadow-[inset_0_0_0_1px_rgba(7,13,31,0.08)] sm:flex-row sm:items-center">
                    <span>Member chat · <DateTimeRange startsAt={slot.startsAt} endsAt={slot.endsAt} /></span>
                    <BuddyButton id={slot.id} />
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
        {releasedSurveyApplication && (
          <section className="rounded-2xl p-6 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.08)]">
            <h2 className="text-lg font-semibold">How was this cycle?</h2>
            {releasedSurveyApplication.survey_submitted ? (
              <p className="mt-4 text-sm text-mecg-navy/70">{"Thanks for the feedback. It's anonymous and goes straight to the Board."}</p>
            ) : (
              <SurveyForm applicationId={releasedSurveyApplication.application_id} />
            )}
          </section>
        )}
      </div>
    </PortalShell>
  );
}
