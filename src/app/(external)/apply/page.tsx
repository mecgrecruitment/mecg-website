export default function ApplyPage() {
  return (
    <main>
      <section className="grid-bg relative px-5 py-20 md:px-8 md:py-28">
        <div className="orb right-[-12rem] top-[-12rem] h-[34rem] w-[34rem] bg-[var(--orange-dark)]" />

        <div className="container relative grid gap-12 lg:grid-cols-[1fr_0.9fr] lg:items-start">
          <div>
            <p className="eyebrow">Application</p>
            <h1 className="display mt-7 max-w-4xl text-6xl uppercase text-white md:text-8xl">
              Apply to MECG.
            </h1>
            <p className="mt-8 max-w-2xl text-xl leading-relaxed text-white/60">
              MECG is open to University of Michigan students across majors. The application asks for basic academic information, a resume, and short written responses.
            </p>
          </div>

          <aside className="panel-strong rounded-[2rem] p-7 md:p-9">
            <p className="eyebrow">Application materials</p>

            <div className="mt-8 grid gap-1">
              {[
                "University of Michigan email",
                "Graduation year and major",
                "Resume PDF",
                "Short written responses",
                "Interest in consulting and teamwork",
              ].map((item, index) => (
                <div
                  key={item}
                  className="grid grid-cols-[3rem_1fr] items-center border-b border-white/10 py-5"
                >
                  <span className="text-sm font-bold text-[var(--orange)]">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="font-semibold text-white/72">{item}</span>
                </div>
              ))}
            </div>

            <div className="mt-8 rounded-[1.5rem] bg-white p-6 text-[var(--navy-950)]">
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--orange-dark)]">
                Status
              </p>
              <h2 className="font-display mt-4 text-3xl font-bold uppercase tracking-[-0.05em]">
                Native form coming soon.
              </h2>
              <p className="mt-4 leading-relaxed text-black/58">
                The next implementation step is connecting this page to Supabase for application responses and private resume upload.
              </p>
            </div>

            <a
              href="/recruitment"
              className="focus-ring mt-7 inline-block rounded-full bg-[var(--orange)] px-7 py-4 text-xs font-extrabold uppercase tracking-[0.16em] text-white transition hover:bg-white hover:text-[var(--navy-950)]"
            >
              View recruitment timeline
            </a>
          </aside>
        </div>
      </section>
    </main>
  );
}
