export default function ApplicantCheckinPage() {
  const events = [
    ["Mass Meeting", "BLUEGEAR", "Jan 16"],
    ["Career Panel", "PROJECT", "Jan 20"],
    ["Meet the Members", "CLIENT", "Jan 22"],
  ];

  return (
    <div className="grid gap-8">
      <section>
        <p className="eyebrow">Attendance</p>
        <h2 className="font-display mt-4 text-5xl font-bold uppercase tracking-[-0.06em] md:text-7xl">
          Event check-in.
        </h2>
        <p className="mt-4 max-w-2xl text-white/54">
          Applicants can enter an event phrase to simulate attendance tracking.
        </p>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <form className="panel grid gap-4 rounded-[2rem] p-6 md:p-8">
          <label className="grid gap-2">
            <span className="text-sm font-bold">Email</span>
            <input type="email" required className="rounded-xl border border-white/10 bg-white/[0.04] p-4 outline-none focus:border-[var(--orange)]" />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-bold">Event phrase</span>
            <input placeholder="BLUEGEAR" required className="rounded-xl border border-white/10 bg-white/[0.04] p-4 uppercase outline-none focus:border-[var(--orange)]" />
          </label>

          <button className="rounded-full bg-[var(--orange)] px-6 py-4 text-xs font-extrabold uppercase tracking-[0.16em]">
            Check in
          </button>
        </form>

        <div className="panel rounded-[2rem] p-6 md:p-8">
          <p className="eyebrow">Demo event codes</p>
          <div className="mt-5 grid gap-3">
            {events.map(([title, code, date]) => (
              <article key={title} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div>
                  <h3 className="font-bold">{title}</h3>
                  <p className="text-sm text-white/44">{date}</p>
                </div>
                <p className="font-mono text-sm font-bold text-[var(--orange)]">{code}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
