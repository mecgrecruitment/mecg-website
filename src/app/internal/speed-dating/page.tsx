import React from "react";
export default function SpeedDatingPage() {
  const signups = [
    ["6:00-7:30 PM", "Sarah Wang", "Team 1"],
    ["6:00-7:30 PM", "Robert Anderson", "Team 2"],
    ["6:00-7:30 PM", "Ojasvi Vodela", "Team 3"],
    ["7:30-9:00 PM", "Natalie Hantz", "Team 1"],
    ["7:30-9:00 PM", "Virinchi Nandamuru", "Team 2"],
    ["7:30-9:00 PM", "Tess Davies", "Team 3"],
  ];

  return (
    <div className="grid gap-7">
      <section>
        <p className="eyebrow">Speed Dating</p>
        <h2 className="font-display mt-4 text-5xl font-bold uppercase tracking-[-0.06em]">
          Session sign-ups.
        </h2>
        <p className="mt-4 text-white/54">
          Demo view of candidate sign-ups and interview rotations.
        </p>
      </section>

      <section className="grid gap-4">
        {signups.map(([time, candidate, team]) => (
          <article key={`${time}-${candidate}`} className="panel rounded-[1.5rem] p-6">
            <div className="grid gap-4 md:grid-cols-[12rem_1fr_10rem] md:items-center">
              <p className="font-bold text-[var(--orange)]">{time}</p>
              <h3 className="font-display text-3xl font-bold uppercase tracking-[-0.05em]">{candidate}</h3>
              <p className="text-white/54">{team}</p>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
