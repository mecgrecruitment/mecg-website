export default function SpeedDatingPage() {
  const rooms = [
    ["Room A", "Maya Shah", "Annie + Jandy", "6:00 PM"],
    ["Room B", "Ethan Lee", "Abby + Blake", "6:10 PM"],
    ["Room C", "Sofia Martinez", "Nandini + Maya", "6:20 PM"],
    ["Room D", "Noah Patel", "Selena + Angela", "6:30 PM"],
  ];

  return (
    <div className="grid gap-7">
      <section>
        <p className="eyebrow">Speed Dating</p>
        <h2 className="font-display mt-4 text-5xl font-bold uppercase tracking-[-0.06em]">
          Interview rotation.
        </h2>
        <p className="mt-4 text-white/54">
          Mock schedule for candidate/member rotations and quick evaluation notes.
        </p>
      </section>

      <section className="grid gap-4">
        {rooms.map(([room, candidate, reviewers, time]) => (
          <article key={room} className="panel rounded-[1.5rem] p-6">
            <div className="grid gap-4 md:grid-cols-[8rem_1fr_1fr_8rem] md:items-center">
              <p className="font-bold text-[var(--orange)]">{room}</p>
              <h3 className="font-display text-3xl font-bold uppercase tracking-[-0.05em]">
                {candidate}
              </h3>
              <p className="text-white/54">{reviewers}</p>
              <p className="text-white/54">{time}</p>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
