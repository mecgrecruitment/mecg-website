import { withWorkspaceCycle } from "@/lib/workspace-cycle-url";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import QRCode from "qrcode";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import GradingToggle from "./grading-toggle";
import RotateButton from "./rotate-button";
import SlotForm from "./slot-form";
import { requireAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";
import Link from "next/link";
import WorkspaceHeader from "@/components/workspace-header";
import WorkspaceNav from "@/components/workspace-nav";
import EventControls from "./event-controls";
import AssistedCheckinForm from "./assisted-checkin-form";
import { summarizeEventObservations } from "./observation-summary";
import { formatEasternDateTime } from "@/lib/date-time";
import AttendanceRefresh from "./attendance-refresh";
import { statusLabel } from "@/lib/labels";

export default async function EventDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ token?: string }> }) {
  const user = await requireAdmin();
  const { id } = await params;
  const { token } = await searchParams;
  const supabase = await createClient();
  const { data: event, error: eventError } = await supabase.from("events").select("id,name,cycle_id,kind,status,location,visibility,starts_at,ends_at,checkin_opens_at,checkin_closes_at,member_grading").eq("id", id).maybeSingle();
  if (eventError) throw eventError;
  if (!event) notFound();
  if (
    !event.cycle_id
    || (!hasPermission(user.memberships, event.cycle_id, "MANAGE_CYCLE")
      && !hasPermission(user.memberships, event.cycle_id, "RECRUITMENT_OPERATIONS"))
  ) redirect("/access-denied");
  const cycleId = event.cycle_id;
  const [
    { data: slots, error: slotsError },
    { data: checkins, error: checkinsError },
    { count: memberCheckinCount, error: memberCheckinsError },
    { data: impressions, error: impressionsError },
    { data: applications, error: applicationsError },
  ] = await Promise.all([
    supabase.from("event_slots").select("id,starts_at,ends_at,capacity").eq("event_id", id),
    supabase.from("checkins").select("pnm_id,checked_in_at,pnms(name)").eq("event_id", id),
    supabase.from("member_checkins").select("id", { count: "exact", head: true }).eq("event_id", id),
    supabase.from("event_impressions").select("application_id,tags,note").eq("event_id", id),
    supabase.from("applications").select("id,pnm_id,status").eq("cycle_id", event.cycle_id),
  ]);
  if (slotsError) console.error("event slot list failed", slotsError);
  if (checkinsError) console.error("event checkin list failed", checkinsError);
  if (memberCheckinsError) console.error("event member checkin count failed", memberCheckinsError);
  if (impressionsError) console.error("event observation list failed", impressionsError);
  if (applicationsError) console.error("event application list failed", applicationsError);
  const applicationByPnm = new Map((applications ?? []).filter((application) => application.status !== "DRAFT" && application.status !== "WITHDRAWN").map((application) => [application.pnm_id, application]));
  const observationsByApplication = summarizeEventObservations((impressions ?? []).map((observation) => ({
    applicationId: observation.application_id,
    tags: observation.tags,
    note: observation.note,
  })));
  const coverage = (checkins ?? [])
    .flatMap((checkin) => {
      const application = applicationByPnm.get(checkin.pnm_id);
      if (!application) return [];
      const observations = observationsByApplication.get(application.id);
      return [{
        applicationId: application.id,
        name: checkin.pnms?.name ?? "Unknown applicant",
        observationCount: observations?.count ?? 0,
        tags: observations?.topTags ?? [],
        notes: observations?.notes ?? [],
      }];
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  const headerList = await headers();
  const host = headerList.get("host");
  const protocol = host?.startsWith("localhost") || host?.startsWith("127.0.0.1") ? "http" : "https";
  const baseUrl = process.env.BASE_URL ?? `${protocol}://${host}`;
  const checkinUrl = token ? `${baseUrl}/checkin/${token}` : null;
  const qrDataUrl = checkinUrl ? await QRCode.toDataURL(checkinUrl) : null;

  return (
    <main className="workspace-stack mx-auto flex w-full max-w-4xl flex-col">
      <WorkspaceHeader
        eyebrow="Attendance event"
        title={event.name}
        description={formatEasternDateTime(event.starts_at)}
        action={<Link href={withWorkspaceCycle("/admin/rounds", cycleId)} className="button-secondary text-sm">Back to interviews</Link>}
      />
      {event.cycle_id && <WorkspaceNav user={user} cycleId={event.cycle_id} current="/admin/rounds" />}

      <nav aria-label="Event sections" className="flex flex-wrap gap-2">
        <a href="#event-checkin" className="button-secondary">Record attendance</a>
        <a href="#event-attendance" className="button-secondary">Live attendance</a>
        <a href="#event-qr" className="button-secondary">Check-in QR</a>
        <a href="#event-observations" className="button-secondary">Observations</a>
        <a href="#event-slots" className="button-secondary">RSVP slots</a>
        <a href="#event-settings" className="button-secondary">Event settings</a>
      </nav>
      <section className="workspace-panel">
        <h2 className="text-base font-semibold">{statusLabel(event.status)} · Attendance event</h2>
        <p className="mt-2 text-sm text-mecg-navy/65">Attendance and event observations are operational context. They do not establish round staffing, qualifying evaluations or applicant readiness.</p>
        <p className="mt-3 text-sm text-mecg-navy/60">
          Check-in window: {formatEasternDateTime(event.checkin_opens_at)} to {formatEasternDateTime(event.checkin_closes_at)}
        </p>
      </section>

      <section id="event-checkin" aria-label="Record attendance"><AssistedCheckinForm eventId={event.id} locked={event.status === "CLOSED" || event.status === "CANCELLED"} /></section>

      <section id="event-attendance" className="workspace-panel">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold">Live attendance</h2>
          <AttendanceRefresh />
        </div>
        {(checkinsError || memberCheckinsError || applicationsError) && (
          <p role="alert" className="mt-3 rounded-xl bg-mecg-orange/[0.1] p-3 text-sm text-mecg-orange-ink shadow-[inset_0_0_0_1px_rgba(254,144,77,0.3)]">
            Attendance data could not be fully refreshed. The counts below may be stale. Try Refresh now before recording someone again.
          </p>
        )}
        <p className="mt-3 text-sm">
          Applicant check-ins: <strong className="font-semibold text-mecg-navy">{checkinsError ? "Unavailable" : checkins?.length ?? 0}</strong>
        </p>
        <p className="mt-1.5 text-sm">
          Member check-ins: <strong className="font-semibold text-mecg-navy">{memberCheckinsError ? "Unavailable" : memberCheckinCount ?? 0}</strong>
        </p>
        {impressionsError && <p role="alert" className="mt-3 text-sm text-red-800">Observation records could not be loaded. Refresh to check them; missing records do not mean no observations.</p>}
        <ul className="mt-3 flex flex-col gap-1.5">
          {coverage.map((entry) => (
            <li key={entry.applicationId} className="border-t border-mecg-navy/[0.08] py-3 text-sm first:border-t-0">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium text-mecg-navy">{entry.name}</span>
                <span className="tabular text-mecg-navy/55">{impressionsError ? "Observations unavailable" : `${entry.observationCount} observation${entry.observationCount === 1 ? "" : "s"}`}</span>
              </div>
              {entry.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {entry.tags.map((tag) => <span key={tag} className="rounded-full bg-mecg-navy/[0.05] px-2.5 py-1 text-xs text-mecg-navy/60">{tag}</span>)}
                </div>
              )}
              {entry.notes.length > 0 && (
                <ul className="mt-2 flex flex-col gap-1 text-xs leading-5 text-mecg-navy/60">
                  {entry.notes.slice(0, 5).map((note, noteIndex) => <li key={`${noteIndex}-${note}`}>{note}</li>)}
                </ul>
              )}
            </li>
          ))}
        </ul>
        {!checkinsError && !coverage.length && (
          <p className="mt-3 text-sm text-mecg-navy/60">
            {checkins?.length ? "Check-ins are recorded, but applicant details are not available yet." : "No applicant check-ins yet."}
          </p>
        )}
      </section>

      <section id="event-qr" className="workspace-panel">
        <h2 className="text-base font-semibold">Check-in QR code</h2>
        {qrDataUrl ? (
          <div className="mt-3 flex flex-col items-start gap-2">
            <Image unoptimized src={qrDataUrl} alt="Check-in QR code" width={256} height={256} className="rounded-xl shadow-[inset_0_0_0_1px_rgba(7,13,31,0.12)]" />
            <p className="break-all text-xs text-mecg-navy/55">{checkinUrl}</p>
          </div>
        ) : (
          <p className="mt-3 rounded-xl bg-mecg-orange/[0.1] p-3 text-sm text-mecg-orange-ink shadow-[inset_0_0_0_1px_rgba(254,144,77,0.3)]">
            For security, the raw check-in token is shown only when created or rotated. Rotate it to display a new QR code.
          </p>
        )}
        <div className="mt-3.5">
          <RotateButton eventId={event.id} cycleId={cycleId} />
        </div>
      </section>

      <section id="event-observations" className="workspace-panel">
        <h2 className="text-base font-semibold">Member observations</h2>
        <p className="mt-2 text-sm leading-6 text-mecg-navy/55">Tags and anonymous notes provide event context. They do not affect applicant scores, readiness, or rank.</p>
        <p className="mt-3 text-sm">
          Currently: <strong className="font-semibold text-mecg-navy">{event.member_grading ? "Enabled" : "Disabled"}</strong>
        </p>
        <div className="mt-3.5">
          <GradingToggle eventId={event.id} cycleId={event.cycle_id} enabled={event.member_grading} />
        </div>
      </section>

      <section id="event-slots">
        <h2 className="text-base font-semibold">RSVP slots</h2>
        <ul className="mt-3 flex flex-col gap-1.5">
          {(slots ?? []).map((slot) => (
            <li key={slot.id} className="text-sm text-mecg-navy/70">
              {formatEasternDateTime(slot.starts_at)} · cap {slot.capacity}
            </li>
          ))}
        </ul>
        {slotsError
          ? <p className="text-sm text-mecg-orange-ink">Slots could not be loaded. Reload before adding one, this list may be incomplete.</p>
          : !slots?.length && <p className="text-sm text-mecg-navy/60">No slots yet.</p>}
        {event.cycle_id && <details className="mt-4"><summary className="min-h-11 cursor-pointer text-sm font-semibold">Add an RSVP slot</summary><SlotForm cycleId={event.cycle_id} eventId={event.id} /></details>}
      </section>
      <details id="event-settings" className="workspace-panel">
        <summary className="min-h-11 cursor-pointer text-base font-semibold">Event details and lifecycle</summary>
      <EventControls event={{
        id: event.id, name: event.name, kind: event.kind, status: event.status,
        location: event.location, visibility: event.visibility, startsAt: event.starts_at,
        endsAt: event.ends_at ?? event.checkin_closes_at,
        checkinOpensAt: event.checkin_opens_at, checkinClosesAt: event.checkin_closes_at,
      }} />
      </details>
    </main>
  );
}
