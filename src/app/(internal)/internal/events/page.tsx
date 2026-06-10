export default function InternalEventsPage() {
  const events = [
    ["Mass Meeting", "Open rush", "Jan 16, 2026", "CCCB B0420", "BLUEGEAR"],
    ["Career Panel", "Open rush", "Jan 20, 2026", "NUB 1528", "PROJECT"],
    ["Meet the Members", "Open rush", "Jan 22, 2026", "Weiser 110", "CLIENT"],
    ["Speed Dating", "Invite only", "Jan 27, 2026", "TBD", "MEMBERFIT"],
    ["Group Case", "Invite only", "Jan 31, 2026", "TBD", "CASE"],
  ];

  return (
    <div className="grid gap-7">
      <section>
        <p className="eyebrow">Events</p>
        <h2 className="font-display mt-4 text-5xl font-bold uppercase tracking-[-0.06em]">
          Recruitment calendar.
        </h2>
        <p className="mt-4 text-white/54">
          Mock event control center for rush, check-ins, and invite-only stages.
        </p>
      </section>

      <section className="grid gap-4">
        {events.map(([title, type, date, location, phrase]) => (
          <article key={title} className="panel rounded-[1.5rem] p-6">
            <div className="grid gap-4 md:grid-cols-[1fr_12rem_12rem_10rem] md:items-center">
              <div>
                <p className="text-sm font-bold text-[var(--orange)]">{type}</p>
                <h3 className="font-display mt-2 text-3xl font-bold uppercase tracking-[-0.05em]">
                  {title}
                </h3>
              </div>
              <p className="text-white/58">{date}</p>
              <p className="text-white/58">{location}</p>
              <p className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-center text-xs font-bold uppercase tracking-[0.14em] text-white/50">
                {phrase}
              </p>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
