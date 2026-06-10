import { createClient } from "../../../../lib/supabase/server";

export default async function InternalCalendarPage() {
  const supabase = await createClient();

  const { data: events } = await supabase
    .from("recruitment_events")
    .select("*")
    .order("starts_at", { ascending: true });

  const { data: attendance } = await supabase
    .from("event_attendance")
    .select("event_id");

  const counts = new Map<string, number>();

  for (const item of attendance ?? []) {
    counts.set(item.event_id, (counts.get(item.event_id) ?? 0) + 1);
  }

  return (
    <div className="grid gap-7">
      <section>
        <p className="eyebrow">Internal calendar</p>
        <h1 className="font-display mt-4 text-5xl font-bold uppercase tracking-[-0.06em]">
          Recruitment events.
        </h1>
        <p className="mt-4 max-w-3xl text-white/54">
          Members can see event times, locations, check-in phrases, and attendance counts.
        </p>
      </section>

      <section className="grid gap-4">
        {(events ?? []).map((event) => (
          <article
            key={event.id}
            className="panel grid gap-5 rounded-[1.5rem] p-6 lg:grid-cols-[1fr_14rem_12rem_10rem]"
          >
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--orange)]">
                {event.event_type}
              </p>
              <h2 className="font-display mt-3 text-3xl font-bold uppercase tracking-[-0.05em]">
                {event.title}
              </h2>
              <p className="mt-2 text-white/48">{event.description}</p>
              <p className="mt-2 text-sm text-white/36">{event.location}</p>
            </div>

            <div>
              <p className="text-sm text-white/36">Starts</p>
              <p className="mt-1 font-bold">{new Date(event.starts_at).toLocaleString()}</p>
            </div>

            <div>
              <p className="text-sm text-white/36">Check-in phrase</p>
              <p className="mt-1 font-bold text-[var(--orange)]">
                {event.checkin_phrase ?? "None"}
              </p>
            </div>

            <div>
              <p className="text-sm text-white/36">Attendance</p>
              <p className="stat mt-1 text-4xl font-bold">
                {counts.get(event.id) ?? 0}
              </p>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
