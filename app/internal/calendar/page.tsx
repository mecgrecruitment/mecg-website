import React from "react";
import { createDemoAdminClient } from "@/lib/supabase/demo-admin";
import { requireInternalSession } from "@/lib/internal-portal/session";

function badgeClass(eventType: string | null) {
  if (eventType === "Open Rush") {
    return "border-green-300/30 bg-green-400/10 text-green-100";
  }

  if (eventType === "Invite Only") {
    return "border-purple-300/30 bg-purple-400/10 text-purple-100";
  }

  return "border-white/10 bg-white/[0.04] text-white/55";
}

function dotClass(eventType: string | null) {
  if (eventType === "Open Rush") return "bg-green-300";
  if (eventType === "Invite Only") return "bg-purple-300";
  return "bg-white/35";
}

export default async function CalendarPage() {
  await requireInternalSession();
  const supabase = createDemoAdminClient();

  const { data: events } = await supabase
    .from("demo_events")
    .select("id,title,event_type,event_date,location,active,attendance_code")
    .order("created_at", { ascending: true });

  const eventList = events ?? [];
  const openRushCount = eventList.filter((event) => event.event_type === "Open Rush").length;
  const inviteOnlyCount = eventList.filter((event) => event.event_type === "Invite Only").length;
  const activeCount = eventList.filter((event) => event.active).length;

  return (
    <div className="grid gap-8">
      <section className="panel-strong rounded-[2rem] p-7 md:p-10">
        <p className="eyebrow">Calendar</p>
        <div className="mt-5 grid gap-6 xl:grid-cols-[1.25fr_0.75fr] xl:items-end">
          <div>
            <h2 className="font-display text-5xl font-bold uppercase leading-[0.9] tracking-[-0.07em] md:text-7xl">
              Recruitment timeline.
            </h2>
            <p className="mt-5 max-w-2xl text-white/58">
              A cleaner overview of open rush, invite-only, and internal recruitment events.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-green-300/20 bg-green-400/10 p-4">
              <p className="text-3xl font-black">{openRushCount}</p>
              <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-green-100/70">
                Open Rush
              </p>
            </div>
            <div className="rounded-2xl border border-purple-300/20 bg-purple-400/10 p-4">
              <p className="text-3xl font-black">{inviteOnlyCount}</p>
              <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-purple-100/70">
                Invite Only
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-3xl font-black">{activeCount}</p>
              <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-white/45">
                Active
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.7fr_1.3fr]">
        <aside className="panel rounded-[2rem] p-6">
          <p className="eyebrow">Legend</p>

          <div className="mt-5 grid gap-3 text-sm">
            <div className="flex items-center gap-3 rounded-xl border border-green-300/20 bg-green-400/10 p-3">
              <span className="h-3 w-3 rounded-full bg-green-300" />
              <span className="font-bold text-green-100">Open Rush</span>
            </div>

            <div className="flex items-center gap-3 rounded-xl border border-purple-300/20 bg-purple-400/10 p-3">
              <span className="h-3 w-3 rounded-full bg-purple-300" />
              <span className="font-bold text-purple-100">Invite Only</span>
            </div>

            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3">
              <span className="h-3 w-3 rounded-full bg-white/35" />
              <span className="font-bold text-white/65">Other/Internal</span>
            </div>
          </div>

          <p className="mt-6 text-sm leading-6 text-white/45">
            Only active open-rush events count toward applicant attendance in the applicant dashboard and applicant list.
          </p>
        </aside>

        <section className="panel rounded-[2rem] p-5 md:p-6">
          <div className="grid gap-4">
            {eventList.map((event, index) => (
              <article
                key={event.id}
                className="grid gap-4 rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-5 md:grid-cols-[auto_1fr_auto] md:items-center"
              >
                <div className="flex items-center gap-4">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-sm font-black text-white/55">
                    {index + 1}
                  </div>
                  <span className={`h-3 w-3 rounded-full ${dotClass(event.event_type)}`} />
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xl font-black tracking-[-0.03em]">
                      {event.title}
                    </h3>
                    <span className={`rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] ${badgeClass(event.event_type)}`}>
                      {event.event_type || "Event"}
                    </span>
                    {!event.active ? (
                      <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-white/35">
                        Inactive
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-2 text-sm text-white/50">
                    {event.location || "Location TBD"}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left md:text-right">
                  <p className="text-sm font-black text-white/80">{event.event_date}</p>
                  {event.attendance_code && event.event_type === "Open Rush" ? (
                    <p className="mt-1 text-xs text-white/35">Check-in code set</p>
                  ) : null}
                </div>
              </article>
            ))}

            {eventList.length === 0 ? (
              <p className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-white/45">
                No recruitment events added yet.
              </p>
            ) : null}
          </div>
        </section>
      </section>
    </div>
  );
}
