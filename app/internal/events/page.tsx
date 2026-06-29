import React from "react";
import { createClient } from "@/lib/supabase/server";
import { requireCommittee } from "@/lib/auth";

const TYPE_LABEL: Record<string, string> = {
  open_rush: "Open Rush",
  invite_only: "Invite Only",
  internal: "Internal",
};

export default async function InternalEventsPage() {
  await requireCommittee();
  const supabase = await createClient();

  const { data: events } = await supabase
    .from("recruitment_events")
    .select("id, title, event_type, event_date, location, attendance_code")
    .order("event_date", { ascending: true });

  const { data: checkins } = await supabase
    .from("event_checkins")
    .select("id, email, applicant_name, created_at, event:recruitment_events(title)")
    .order("created_at", { ascending: false });

  return (
    <div className="grid gap-7">
      <section>
        <p className="eyebrow">Events</p>
        <h2 className="font-display mt-4 text-5xl font-bold uppercase tracking-[-0.06em]">
          Recruitment calendar.
        </h2>
        <p className="mt-4 text-white/54">
          Internal event schedule with attendance codes and check-in feed.
        </p>
      </section>

      <section className="grid gap-4">
        {(events ?? []).map((event) => (
          <article key={event.id} className="panel rounded-[1.5rem] p-6">
            <div className="grid gap-4 md:grid-cols-[1fr_12rem_14rem_10rem] md:items-center">
              <div>
                <p className="text-sm font-bold text-[var(--orange)]">{TYPE_LABEL[event.event_type] || "Event"}</p>
                <h3 className="font-display mt-2 text-3xl font-bold uppercase tracking-[-0.05em]">
                  {event.title}
                </h3>
              </div>
              <p className="text-white/58">{event.event_date ? new Date(event.event_date).toLocaleString() : "Date TBD"}</p>
              <p className="text-white/58">{event.location || "Location TBD"}</p>
              <p className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-center font-mono text-xs font-bold uppercase tracking-[0.14em] text-[var(--orange)]">
                {event.attendance_code || "—"}
              </p>
            </div>
          </article>
        ))}
      </section>

      <section className="panel rounded-[2rem] p-6 md:p-8">
        <p className="eyebrow">Attendance feed</p>
        <div className="mt-5 grid gap-3">
          {(checkins ?? []).map((checkin) => {
            const event = checkin.event as { title?: string } | { title?: string }[] | null;
            const title = Array.isArray(event) ? event[0]?.title : event?.title;
            return (
              <article key={checkin.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <h3 className="font-bold">{title || "Open Rush Event"}</h3>
                <p className="text-sm text-white/44">{checkin.applicant_name || checkin.email}</p>
                <p className="mt-1 text-xs text-white/35">
                  {checkin.email} · {new Date(checkin.created_at).toLocaleString()}
                </p>
              </article>
            );
          })}
          {(checkins ?? []).length === 0 ? (
            <p className="text-white/45">No check-ins yet.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
