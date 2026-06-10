// TODO(Track B): recruitment events + attendance need schema (fold into cycle
// configuration §9.14 or a new spec) — the old recruitment_events /
// event_attendance tables never existed in the canonical PRD §10 model.
export default function InternalCalendarPage() {
  return (
    <div className="grid gap-7">
      <section>
        <p className="eyebrow">Internal calendar</p>
        <h1 className="font-display mt-4 text-5xl font-bold uppercase tracking-[-0.06em]">
          Recruitment events.
        </h1>
        <p className="mt-4 max-w-3xl text-white/54">
          Event times, locations, check-in phrases, and attendance counts will
          appear here once Fall 2026 events are configured.
        </p>
      </section>

      <section className="panel rounded-panel p-7">
        <p className="text-sm text-white/44">
          No events configured for this cycle yet.
        </p>
      </section>
    </div>
  );
}
