import React from "react";
import { createDemoAdminClient } from "@/lib/supabase/demo-admin";

export default async function InternalEventsPage() {
  const supabase = createDemoAdminClient();

  const { data: events } = await supabase
    .from("demo_events")
    .select("*")
    .order("created_at", { ascending: true });

  const { data: checkins } = await supabase
    .from("demo_checkins")
    .select("*")
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
            <div className="grid gap-4 md:grid-cols-[1fr_10rem_14rem_10rem] md:items-center">
              <div>
                <p className="text-sm font-bold text-[var(--orange)]">{event.event_type}</p>
                <h3 className="font-display mt-2 text-3xl font-bold uppercase tracking-[-0.05em]">
                  {event.title}
                </h3>
              </div>
              <p className="text-white/58">{event.event_date}</p>
              <p className="text-white/58">{event.location}</p>
              <p className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-center font-mono text-xs font-bold uppercase tracking-[0.14em] text-[var(--orange)]">
                {event.attendance_code}
              </p>
            </div>
          </article>
        ))}
      </section>

      <section className="panel rounded-[2rem] p-6 md:p-8">
        <p className="eyebrow">Attendance feed</p>
        <div className="mt-5 grid gap-3">
          {(checkins ?? []).map((checkin) => (
            <article key={checkin.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <h3 className="font-bold">{checkin.event_name}</h3>
              <p className="text-sm text-white/44">{checkin.email}</p>
              <p className="mt-2 font-mono text-sm font-bold text-[var(--orange)]">{checkin.event_phrase}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
