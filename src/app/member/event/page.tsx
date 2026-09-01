import type { Metadata } from "next";
import Link from "next/link";
import { requireMember } from "@/lib/auth";
import WorkspaceHeader from "@/components/workspace-header";
import WorkspaceNav from "@/components/workspace-nav";
import { createClient } from "@/lib/supabase/server";
import PillNav from "@/components/pill-nav";
import SectionLabel from "@/components/section-label";
import ImpressionForm from "./impression-form";

export const metadata: Metadata = { title: "Live Event Grading" };

function formatStart(startsAt: string) {
  return new Date(startsAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default async function EventGradingPage({ searchParams }: { searchParams: Promise<{ event?: string }> }) {
  const [user, { event: eventParam }] = await Promise.all([requireMember(), searchParams]);
  const supabase = await createClient();
  const { data: events, error: eventsError } = await supabase.rpc("my_grading_events");
  if (eventsError) throw eventsError;
  const eventRows = events ?? [];
  const selected = eventRows.find((row) => row.event_id === eventParam)
    ?? eventRows.find((row) => row.grading_open)
    ?? eventRows[0];
  const roster = selected ? await supabase.rpc("event_grading_roster", { target_event_id: selected.event_id }) : null;
  const rosterRows = roster?.data ?? [];
  const gradedCount = rosterRows.filter((row) => row.impression_id).length;
  const firstUngradedId = rosterRows.find((row) => !row.impression_id)?.application_id;
  const navLinks: Array<readonly [string, string]> = [
    ["/member", "All work"],
    ...eventRows.map((row) => [`/member/event?event=${row.event_id}`, row.event_name] as const),
  ];
  const workspaceCycleId = user.memberships.find((membership) => membership.active)?.cycleId ?? null;
  const currentWorkspace = selected ? `/member/event?event=${selected.event_id}` : "/member/event";

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 p-6 sm:p-10">
      <WorkspaceHeader
        eyebrow="Live event grading"
        title={selected ? selected.event_name : "No event selected"}
        description={`Signed in as ${user.name}`}
      />
      {workspaceCycleId && <WorkspaceNav user={user} cycleId={workspaceCycleId} current="/member/event" />}
      <PillNav ariaLabel="Grading events" current={currentWorkspace} links={navLinks} />

      {!selected ? (
        <div className="rounded-2xl border-[1.5px] border-dashed border-mecg-navy/[0.14] p-7 text-center">
          <p className="font-semibold text-mecg-navy">No events to grade yet</p>
          <p className="mt-1 text-sm text-mecg-navy/55">Check in at a closed rush event to unlock grading.</p>
          <Link href="/member" className="button-secondary mt-4 inline-flex text-sm">Back to the Evaluation Hub</Link>
        </div>
      ) : roster?.error ? (
        <div className="rounded-2xl border-[1.5px] border-dashed border-mecg-navy/[0.14] p-7 text-center">
          <p className="font-semibold text-mecg-navy">The grading window is closed</p>
          <p className="mt-1 text-sm text-mecg-navy/55">Impressions for this event can no longer be added or edited.</p>
          <Link href="/member" className="button-secondary mt-4 inline-flex text-sm">Back to the Evaluation Hub</Link>
        </div>
      ) : (
        <section>
          <SectionLabel>Quick impressions</SectionLabel>
          <h2 className="mt-2 text-[22px] font-semibold tracking-[-0.02em]">{gradedCount} of {rosterRows.length} applicants graded</h2>
          <p className="mt-1 text-sm text-mecg-navy/55">Started {formatStart(selected.starts_at)} · you can edit an impression until the grading window closes.</p>
          <div className="mt-3.5 flex flex-col gap-4">
            {rosterRows.map((row) => (
              <article key={row.application_id} className="rounded-2xl p-5 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)] sm:p-6">
                <h3 className="text-lg font-semibold text-mecg-navy">{row.applicant_name}</h3>
                {row.impression_id ? (
                  <details className="group mt-3 rounded-xl">
                    <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-lg px-3 py-2 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.12)] marker:content-none">
                      <span className="text-sm font-semibold text-mecg-navy">Graded · Score {row.score} · edit</span>
                      <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 text-mecg-navy/60 transition-transform group-open:rotate-180">
                        <path d="M5 8l5 5 5-5" />
                      </svg>
                    </summary>
                    <ImpressionForm eventId={selected.event_id} applicationId={row.application_id} initial={{ score: row.score, tags: row.tags ?? [], note: row.note ?? "" }} />
                  </details>
                ) : (
                  <details className="group mt-3 rounded-xl" open={row.application_id === firstUngradedId}>
                    <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-lg px-3 py-2 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.12)] marker:content-none">
                      <span className="text-sm font-semibold text-mecg-navy">Not graded yet</span>
                      <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 text-mecg-navy/60 transition-transform group-open:rotate-180">
                        <path d="M5 8l5 5 5-5" />
                      </svg>
                    </summary>
                    <ImpressionForm eventId={selected.event_id} applicationId={row.application_id} />
                  </details>
                )}
              </article>
            ))}
            {!rosterRows.length && (
              <div className="rounded-2xl border-[1.5px] border-dashed border-mecg-navy/[0.14] p-7 text-center">
                <p className="font-semibold text-mecg-navy">No applicants to grade</p>
                <p className="mt-1 text-sm text-mecg-navy/55">Checked-in applicants will appear here, minus your declared conflicts.</p>
              </div>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
