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

export default async function EventDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ token?: string }> }) {
  const user = await requireAdmin();
  const { id } = await params;
  const { token } = await searchParams;
  const supabase = await createClient();
  const { data: event, error: eventError } = await supabase.from("events").select("id,name,cycle_id,starts_at,checkin_opens_at,checkin_closes_at,member_grading").eq("id", id).maybeSingle();
  if (eventError) throw eventError;
  if (!event) notFound();
  if (
    !event.cycle_id
    || (!hasPermission(user.memberships, event.cycle_id, "MANAGE_CYCLE")
      && !hasPermission(user.memberships, event.cycle_id, "RECRUITMENT_OPERATIONS"))
  ) redirect("/access-denied");
  const { data: slots, error: slotsError } = await supabase.from("event_slots").select("id,starts_at,ends_at,capacity").eq("event_id", id);
  if (slotsError) console.error("event slot list failed", slotsError);
  const { data: checkins, error: checkinsError } = await supabase.from("checkins").select("pnm_id,checked_in_at,pnms(name)").eq("event_id", id);
  if (checkinsError) console.error("event checkin list failed", checkinsError);
  const { count: memberCheckinCount, error: memberCheckinsError } = await supabase.from("member_checkins").select("id", { count: "exact", head: true }).eq("event_id", id);
  if (memberCheckinsError) console.error("event member checkin count failed", memberCheckinsError);
  const { data: impressions, error: impressionsError } = await supabase.from("event_impressions").select("application_id,score").eq("event_id", id);
  if (impressionsError) console.error("event impression list failed", impressionsError);
  const { data: applications, error: applicationsError } = await supabase.from("applications").select("id,pnm_id,status").eq("cycle_id", event.cycle_id);
  if (applicationsError) console.error("event application list failed", applicationsError);
  const applicationByPnm = new Map((applications ?? []).filter((application) => application.status !== "DRAFT" && application.status !== "WITHDRAWN").map((application) => [application.pnm_id, application]));
  const scoresByApplication = new Map<string, number[]>();
  for (const impression of impressions ?? []) {
    const scores = scoresByApplication.get(impression.application_id) ?? [];
    scores.push(impression.score);
    scoresByApplication.set(impression.application_id, scores);
  }
  const coverage = (checkins ?? [])
    .flatMap((checkin) => {
      const application = applicationByPnm.get(checkin.pnm_id);
      if (!application) return [];
      const scores = scoresByApplication.get(application.id) ?? [];
      return [{
        applicationId: application.id,
        name: checkin.pnms?.name ?? "Unknown applicant",
        impressionCount: scores.length,
        averageScore: scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null,
      }];
    })
    .sort((a, b) => a.impressionCount - b.impressionCount);
  const headerList = await headers();
  const host = headerList.get("host");
  const protocol = host?.startsWith("localhost") || host?.startsWith("127.0.0.1") ? "http" : "https";
  const baseUrl = process.env.BASE_URL ?? `${protocol}://${host}`;
  const checkinUrl = token ? `${baseUrl}/checkin/${token}` : null;
  const qrDataUrl = checkinUrl ? await QRCode.toDataURL(checkinUrl) : null;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6 sm:p-10">
      <header>
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-mecg-orange-ink">Attendance event</p>
        <h1 className="mt-2.5 text-3xl font-semibold tracking-[-0.03em] sm:text-[34px]">{event.name}</h1>
        <p className="mt-1.5 text-[15px] text-mecg-navy/55">{new Date(event.starts_at).toLocaleString()}</p>
      </header>

      <section className="rounded-2xl p-5 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.12)]">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-mecg-navy/50">Operational attendance only</p>
        <p className="mt-3 text-sm text-mecg-navy/60">
          Check-in window: {new Date(event.checkin_opens_at).toLocaleString()} – {new Date(event.checkin_closes_at).toLocaleString()}
        </p>
      </section>

      <section className="rounded-2xl p-5 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.12)]">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-mecg-navy/50">Member grading</p>
        <p className="mt-3 text-sm">
          Currently: <strong className="font-semibold text-mecg-navy">{event.member_grading ? "Enabled" : "Disabled"}</strong>
        </p>
        <div className="mt-3.5">
          <GradingToggle eventId={event.id} cycleId={event.cycle_id} enabled={event.member_grading} />
        </div>
      </section>

      <section className="rounded-2xl p-5 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.12)]">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-mecg-navy/50">Live attendance</p>
        <p className="mt-3 text-sm">
          Applicant check-ins: <strong className="font-semibold text-mecg-navy">{checkins?.length ?? 0}</strong>
        </p>
        <p className="mt-1.5 text-sm">
          Member check-ins: <strong className="font-semibold text-mecg-navy">{memberCheckinCount ?? 0}</strong>
        </p>
        <ul className="mt-3 flex flex-col gap-1.5">
          {coverage.map((entry) => (
            <li key={entry.applicationId} className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm ${entry.impressionCount === 0 ? "bg-mecg-orange/[0.1] text-mecg-orange-ink shadow-[inset_0_0_0_1px_rgba(254,144,77,0.3)]" : "text-mecg-navy/70"}`}>
              <span className="font-medium">{entry.name}</span>
              <span>
                {entry.impressionCount === 0
                  ? "No impressions yet"
                  : `${entry.impressionCount} impression${entry.impressionCount === 1 ? "" : "s"} · avg ${entry.averageScore?.toFixed(1)}`}
              </span>
            </li>
          ))}
        </ul>
        {!coverage.length && <p className="mt-3 text-sm text-mecg-navy/45">No applicant check-ins yet.</p>}
      </section>

      <section className="rounded-2xl p-5 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.12)]">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-mecg-navy/50">Check-in QR code</p>
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
          <RotateButton eventId={event.id} />
        </div>
      </section>

      {event.cycle_id && <SlotForm cycleId={event.cycle_id} eventId={event.id} />}

      <section>
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-mecg-navy/50">RSVP slots</p>
        <ul className="mt-3 flex flex-col gap-1.5">
          {(slots ?? []).map((slot) => (
            <li key={slot.id} className="text-sm text-mecg-navy/70">
              {new Date(slot.starts_at).toLocaleString()} · cap {slot.capacity}
            </li>
          ))}
        </ul>
        {slotsError
          ? <p className="text-sm text-mecg-orange-ink">Slots could not be loaded. Reload before adding one, this list may be incomplete.</p>
          : !slots?.length && <p className="text-sm text-mecg-navy/45">No slots yet.</p>}
      </section>
    </main>
  );
}
