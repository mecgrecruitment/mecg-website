import { redirect } from "next/navigation";
import { currentDestination, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import PortalShell from "@/components/portal-shell";
import LogoutButton from "@/components/logout-button";
import { BuddyButton, OfferButtons, SlotButton, SurveyForm } from "./actions";

export default async function ApplicantDashboard({ searchParams }: { searchParams: Promise<{ submitted?: string }> }) {
  const { submitted } = await searchParams;
  await requireUser();
  const destination = await currentDestination();
  if (destination !== "/applicant") redirect(destination ?? "/login");
  const supabase = await createClient();
  const [{ data: applications, error }, { data: schedule }] = await Promise.all([
    supabase.rpc("applicant_dashboard"),
    supabase.rpc("applicant_schedule"),
  ]);
  if (error) throw error;
  if (!applications?.length) redirect("/apply");
  const plan = schedule && typeof schedule === "object" ? schedule as {
    rsvps?: { eventName: string; startsAt: string; location?: string }[];
    group?: { name: string; prompt: string } | null;
    buddy?: { startsAt: string } | null;
    openSlots?: { id: string; eventName: string; startsAt: string; remaining: number }[];
    openBuddy?: { id: string; startsAt: string }[];
  } : {};
  const offered = applications.some((application) => application.display_status === "OFFER" || application.released_outcome === "OFFER");

  return (
    <PortalShell eyebrow="Applicant portal" title={`Welcome, ${applications[0].applicant_name}.`} description="Only outcomes released by MECG appear here. Attendance and coffee chats are never scores.">
      <div className="space-y-4">
        {submitted === "1" && (
          <section role="status" className="rounded-2xl bg-emerald-50 p-6 text-emerald-950 shadow-[inset_0_0_0_1px_rgba(4,120,87,0.14)]">
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-emerald-700">Application received</p>
            <h2 className="mt-3 text-2xl font-semibold">You are all set.</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-900/70">MECG received your application. Your written responses will enter anonymous first-pass review, and any released updates will appear on this page.</p>
          </section>
        )}
        {applications.map((application) => {
          const responses = Array.isArray(application.responses) ? application.responses as { prompt?: string; answer?: string }[] : [];
          return (
            <section key={application.application_id} className="rounded-2xl bg-mecg-navy/[0.035] p-6 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.08)]">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-mecg-navy/45">{application.cycle_name}</p>
              <p className="mt-3 text-2xl font-semibold">{application.released_outcome ?? application.display_status}</p>
              <p className="mt-3 text-sm leading-6 text-mecg-navy/60">
                {application.released_outcome ? "This outcome has been approved and released by the MECG Board." : "No final outcome has been released."}
              </p>
              <p className="mt-4 text-sm text-mecg-navy/55">{application.has_resume ? "Resume on file." : "No resume on file."}</p>
              {offered && application.released_outcome === "OFFER" && <OfferButtons />}
              {responses.length > 0 && (
                <dl className="mt-5 space-y-4">
                  {responses.map((response) => (
                    <div key={response.prompt}>
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
          <ul className="mt-3 space-y-2 text-sm">
            {(plan.rsvps ?? []).map((item) => <li key={item.startsAt}>{item.eventName} · {new Date(item.startsAt).toLocaleString()} {item.location ?? ""}</li>)}
            {!plan.rsvps?.length && <li className="text-mecg-navy/50">No RSVPs yet.</li>}
          </ul>
          {plan.group && <p className="mt-4 text-sm"><span className="font-medium">{plan.group.name}.</span> {plan.group.prompt}</p>}
          {plan.buddy && <p className="mt-2 text-sm">Member chat: {new Date(plan.buddy.startsAt).toLocaleString()}</p>}
          <div className="mt-4 space-y-2">
            {(plan.openSlots ?? []).filter((slot) => slot.remaining > 0).map((slot) => (
              <p key={slot.id} className="flex items-center justify-between text-sm">{slot.eventName} · {new Date(slot.startsAt).toLocaleString()} <SlotButton id={slot.id} /></p>
            ))}
            {(plan.openBuddy ?? []).map((slot) => (
              <p key={slot.id} className="flex items-center justify-between text-sm">Member chat {new Date(slot.startsAt).toLocaleString()} <BuddyButton id={slot.id} /></p>
            ))}
          </div>
        </section>
        {applications.some((application) => application.released_outcome) && (
          <section className="rounded-2xl p-6 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.08)]">
            <h2 className="text-lg font-semibold">How was this cycle?</h2>
            <SurveyForm />
          </section>
        )}
      </div>
      <div className="mt-6"><LogoutButton /></div>
    </PortalShell>
  );
}
