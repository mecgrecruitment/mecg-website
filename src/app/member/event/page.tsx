import { selectWorkspaceMembership } from "@/lib/workspace-cycle";
import { withWorkspaceCycle } from "@/lib/workspace-cycle-url";
import type { Metadata } from "next";
import Link from "next/link";
import { requireMember } from "@/lib/auth";
import WorkspaceHeader from "@/components/workspace-header";
import WorkspaceNav from "@/components/workspace-nav";
import { createClient } from "@/lib/supabase/server";
import PillNav from "@/components/pill-nav";
import SectionLabel from "@/components/section-label";
import ObservationRoster from "./observation-roster";
import { observationFailure } from "./observation-state";
import { formatEasternDateTime } from "@/lib/date-time";
import { screeningRpc } from "@/lib/screening-rpc";

export const metadata: Metadata = { title: "Event Observations" };

export type ObservationRow = {
  application_id: string;
  applicant_name: string;
  observation_id: string | null;
  tags: string[] | null;
  note: string | null;
};

function formatStart(startsAt: string) {
  return formatEasternDateTime(startsAt);
}

export default async function EventGradingPage({ searchParams }: { searchParams: Promise<{ event?: string }> }) {
  const [user, { event: eventParam }] = await Promise.all([requireMember(), searchParams]);
  const membership = await selectWorkspaceMembership(user);
  const cycleId = membership?.cycleId ?? null;
  const supabase = await createClient();
  const { data: events, error: eventsError } = await supabase.rpc("my_grading_events");
  if (eventsError) throw eventsError;
  const { data: cycleEvents, error: cycleEventsError } = cycleId ? await supabase.from("events").select("id").eq("cycle_id", cycleId) : { data: [], error: null };
  if (cycleEventsError) throw cycleEventsError;
  const cycleEventIds = new Set((cycleEvents ?? []).map((event) => event.id));
  const eventRows = (events ?? []).filter((event) => cycleEventIds.has(event.event_id));
  const selected = eventRows.find((row) => row.event_id === eventParam)
    ?? eventRows.find((row) => row.grading_open)
    ?? eventRows[0];
  const roster = selected
    ? await screeningRpc<ObservationRow[]>(supabase, "event_observation_roster", { target_event_id: selected.event_id })
    : null;
  const rosterRows = roster?.data ?? [];
  const observedCount = rosterRows.filter((row) => row.observation_id).length;
  const failure = roster?.error ? observationFailure(roster.error) : null;
  const navLinks: Array<readonly [string, string]> = [
    [withWorkspaceCycle("/member", cycleId), "All work"],
    ...eventRows.map((row) => [withWorkspaceCycle(`/member/event?event=${row.event_id}`, cycleId), row.event_name] as const),
  ];
  const workspaceCycleId = cycleId;
  const currentWorkspace = withWorkspaceCycle(selected ? `/member/event?event=${selected.event_id}` : "/member/event", cycleId);

  return (
    <main className="workspace-private workspace-stack mx-auto flex max-w-3xl flex-col">
      <WorkspaceHeader
        eyebrow="Event observations"
        title={selected ? selected.event_name : "No event selected"}
        description={`Signed in as ${user.name}`}
      />
      {workspaceCycleId && <WorkspaceNav user={user} cycleId={workspaceCycleId} current="/member/event" />}
      <PillNav ariaLabel="Observation events" current={currentWorkspace} links={navLinks} />

      {!selected ? (
        <div className="rounded-xl border-[1.5px] border-dashed border-line p-7 text-center">
          <p className="font-semibold text-mecg-navy">No event observations yet</p>
          <p className="mt-1 text-sm text-muted">Assigned events appear here when they are available. Check with the event organizer if you expected an event.</p>
          <Link href={withWorkspaceCycle("/member", cycleId)} className="button-secondary mt-4 inline-flex text-sm">Back to my work</Link>
        </div>
      ) : failure ? (
        <div className="rounded-xl border-[1.5px] border-dashed border-line p-7 text-center">
          <p className="font-semibold text-mecg-navy">{failure.title}</p>
          <p className="mt-1 text-sm text-muted">{failure.detail}</p>
          <Link href={currentWorkspace} className="button-secondary mt-4 inline-flex text-sm">Reload event</Link>
        </div>
      ) : (
        <section>
          <div className="sticky top-0 z-20 -mx-6 border-b border-line bg-white/95 px-6 pb-4 pt-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
            <SectionLabel>Qualitative observations</SectionLabel>
            <h2 className="mt-2 text-[22px] font-semibold tracking-[-0.02em]">{observedCount} of {rosterRows.length} applicants observed</h2>
            <p className="mt-1 text-sm text-muted">Started {formatStart(selected.starts_at)} · observations never affect applicant scores or attendance decisions.</p>
            <div className="progress-track mt-3 sm:max-w-sm" aria-hidden="true">
              <div className="progress-fill" style={{ transform: `scaleX(${rosterRows.length ? observedCount / rosterRows.length : 0})` }} />
            </div>
          </div>
          <ObservationRoster eventId={selected.event_id} rows={rosterRows} />
        </section>
      )}
    </main>
  );
}
