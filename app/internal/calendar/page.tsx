import React from "react";
import { createDemoAdminClient } from "@/lib/supabase/demo-admin";

export default async function CalendarPage() {
  const supabase = createDemoAdminClient();

  const { data: events } = await supabase
    .from("demo_events")
    .select("*")
    .order("created_at", { ascending: true });

  return (
    <div className="grid gap-7">
      <section>
        <p className="eyebrow">Calendar</p>
        <h2 className="font-display mt-4 text-5xl font-bold uppercase tracking-[-0.06em]">
          Recruitment timeline.
        </h2>
        <p className="mt-4 text-white/54">
          Internal overview of upcoming recruitment meetings, interview stages, and check-in codes.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {(events ?? []).map((event) => (
          <article key={event.id} className="panel rounded-[1.5rem] p-6">
            <p className="text-sm font-bold text-[var(--orange)]">{event.event_type}</p>
            <h3 className="font-display mt-3 text-3xl font-bold uppercase tracking-[-0.05em]">{event.title}</h3>
            <p className="mt-3 text-white/54">{event.event_date}</p>
            <p className="mt-1 text-white/44">{event.location}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
