import React from "react";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/server";
import { requireCommittee } from "@/lib/auth";
import { siteUrl } from "../../site";

const TYPE_LABEL: Record<string, string> = {
  open_rush: "Open Rush",
  invite_only: "Invite Only",
  internal: "Internal",
};

export default async function InternalEventsPage() {
  await requireCommittee();
  const supabase = await createClient();

  const [eventsResult, checkinsResult] = await Promise.all([
    supabase
      .from("recruitment_events")
      .select("id, title, event_type, event_date, location, attendance_code")
      .order("event_date", { ascending: true }),
    supabase
      .from("event_checkins")
      .select("id, email, applicant_name, created_at, event:recruitment_events(title)")
      .order("created_at", { ascending: false }),
  ]);

  const events = eventsResult.data;
  const checkins = checkinsResult.data;
  const loadError = eventsResult.error?.message || checkinsResult.error?.message;

  // Pre-render a scan-to-check-in QR per event alongside the plaintext code —
  // committee members can still read the code aloud/type it as a fallback.
  const qrByEventId = new Map<string, string>();
  await Promise.all(
    (events ?? [])
      .filter((event) => event.attendance_code)
      .map(async (event) => {
        const url = `${siteUrl}/apply/checkin/${encodeURIComponent(event.attendance_code!)}`;
        qrByEventId.set(event.id, await QRCode.toDataURL(url));
      })
  );

  return (
    <div className="grid gap-7">
      <section>
        <p className="eyebrow">Events</p>
        <h2 className="font-display mt-4 text-5xl font-bold uppercase tracking-[-0.06em]">
          Events & check-ins.
        </h2>
        <p className="mt-4 text-white/54">
          Schedule, attendance codes, and live check-ins. Bookmark this page —{" "}
          <code className="font-mono text-[var(--orange-soft)]">/internal/calendar</code> redirects
          here.
        </p>
      </section>

      {loadError ? (
        <p className="rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-red-100">
          Could not load events: {loadError}
        </p>
      ) : null}

      <section className="grid gap-4">
        {(events ?? []).length === 0 && !eventsResult.error ? (
          <p className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-white/45">
            No recruitment events yet. When events are seeded for the cycle, attendance codes
            and the check-in feed appear here.
          </p>
        ) : (
          (events ?? []).map((event) => (
            <article key={event.id} className="panel rounded-[1.5rem] p-6">
              <div className="grid gap-4 md:grid-cols-[1fr_12rem_14rem_10rem] md:items-center">
                <div>
                  <p className="text-sm font-bold text-[var(--orange)]">
                    {TYPE_LABEL[event.event_type] || "Event"}
                  </p>
                  <h3 className="font-display mt-2 text-3xl font-bold uppercase tracking-[-0.05em]">
                    {event.title}
                  </h3>
                </div>
                <p className="text-white/58">
                  {event.event_date ? new Date(event.event_date).toLocaleString() : "Date TBD"}
                </p>
                <p className="text-white/58">{event.location || "Location TBD"}</p>
                <div className="grid gap-2 justify-items-center">
                  <p className="w-full rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-center font-mono text-xs font-bold uppercase tracking-[0.14em] text-[var(--orange)]">
                    {event.attendance_code || "—"}
                  </p>
                  {qrByEventId.has(event.id) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={qrByEventId.get(event.id)}
                      alt={`QR code to check in for ${event.title}`}
                      className="h-24 w-24 rounded-lg border border-white/10 bg-white p-1"
                    />
                  ) : null}
                </div>
              </div>
            </article>
          ))
        )}
      </section>

      <section className="panel rounded-[2rem] p-6 md:p-8">
        <p className="eyebrow">Attendance feed</p>
        <div className="mt-5 grid gap-3">
          {(checkins ?? []).map((checkin) => {
            const event = checkin.event as { title?: string } | { title?: string }[] | null;
            const title = Array.isArray(event) ? event[0]?.title : event?.title;
            return (
              <article
                key={checkin.id}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
              >
                <h3 className="font-bold">{title || "Open Rush Event"}</h3>
                <p className="text-sm text-white/44">
                  {checkin.applicant_name || checkin.email}
                </p>
                <p className="mt-1 text-xs text-white/35">
                  {checkin.email} · {new Date(checkin.created_at).toLocaleString()}
                </p>
              </article>
            );
          })}
          {(checkins ?? []).length === 0 && !checkinsResult.error ? (
            <p className="text-white/45">No check-ins yet.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
