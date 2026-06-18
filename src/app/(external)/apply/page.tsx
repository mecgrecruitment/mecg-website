export default function ApplyPage() {
  return (
    <main>
      <section className="px-6 py-20 md:px-12 md:py-28">
        <div className="mx-auto max-w-7xl">
          <p className="font-mono text-sm font-bold uppercase tracking-[0.24em] text-orange">
            [ Apply ]
          </p>
          <h1 className="mt-6 max-w-5xl text-5xl font-black uppercase leading-[0.9] tracking-[-0.06em] text-[var(--mecg-blue-dark)] md:text-8xl">
            Start your MECG application.
          </h1>
          <p className="mt-8 max-w-3xl text-xl leading-relaxed text-muted">
            Native application intake is coming next. For now, this page gives applicants the structure and requirements for the recruitment cycle.
          </p>
        </div>
      </section>

      <section className="border-y border-line bg-white px-6 py-16 md:px-12">
        <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="font-mono text-sm font-bold uppercase tracking-[0.24em] text-orange">
              [ Requirements ]
            </p>
            <h2 className="mt-4 text-4xl font-black uppercase tracking-[-0.05em] text-[var(--mecg-blue-dark)]">
              What you’ll need.
            </h2>
          </div>
          <div className="grid gap-4">
            {["University of Michigan email", "Graduation year and major", "Resume PDF", "Short written responses", "Interest in consulting and collaboration"].map((item) => (
              <div key={item} className="border border-line bg-[var(--paper)] p-5 font-bold text-[var(--mecg-blue-dark)]">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-20 md:px-12">
        <div className="mx-auto max-w-4xl border border-line bg-white p-8 text-center">
          <p className="font-mono text-sm font-bold uppercase tracking-[0.24em] text-orange">
            [ Application Form ]
          </p>
          <h2 className="mt-4 text-4xl font-black uppercase tracking-[-0.05em] text-[var(--mecg-blue-dark)]">
            Native form coming soon.
          </h2>
          <p className="mx-auto mt-5 max-w-2xl leading-relaxed text-muted">
            The next implementation step is connecting this page to Supabase so applications write directly to the recruitment database with resume upload.
          </p>
          <a
            href="/recruitment"
            className="mt-8 inline-block bg-[var(--mecg-orange)] px-6 py-4 font-mono text-sm font-bold uppercase tracking-[0.18em] text-white transition hover:bg-[var(--mecg-orange-dark)]"
          >
            View Recruitment Timeline
          </a>
        </div>
      </section>
    </main>
  );
}
