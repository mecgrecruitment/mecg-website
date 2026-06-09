import { pillars } from "../../../lib/site-content";

export default function AboutPage() {
  return (
    <main>
      <section className="px-6 py-20 md:px-12 md:py-28">
        <div className="mx-auto max-w-7xl">
          <p className="font-mono text-sm font-bold uppercase tracking-[0.24em] text-orange">
            [ About MECG ]
          </p>
          <h1 className="mt-6 max-w-5xl text-5xl font-black uppercase leading-[0.9] tracking-[-0.06em] text-[var(--mecg-blue-dark)] md:text-8xl">
            A consulting community built for engineering-minded problem solvers.
          </h1>
          <p className="mt-8 max-w-3xl text-xl leading-relaxed text-muted">
            Michigan Engineering Consulting Group was founded in 2023 to give students of all majors a path into consulting through education, client experience, mentorship, and community.
          </p>
        </div>
      </section>

      <section className="border-y border-line bg-white px-6 py-16 md:px-12">
        <div className="mx-auto max-w-7xl">
          <p className="font-mono text-sm font-bold uppercase tracking-[0.24em] text-orange">
            [ Four Pillars ]
          </p>
          <div className="mt-10 grid gap-4 md:grid-cols-4">
            {pillars.map((pillar) => (
              <article key={pillar.index} className="border border-line bg-[var(--paper)] p-6">
                <p className="font-mono text-sm font-bold text-orange">[{pillar.index}]</p>
                <h2 className="mt-8 text-2xl font-black uppercase leading-none tracking-[-0.04em] text-[var(--mecg-blue-dark)]">
                  {pillar.title}
                </h2>
                <p className="mt-5 leading-relaxed text-muted">{pillar.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-20 md:px-12">
        <div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="font-mono text-sm font-bold uppercase tracking-[0.24em] text-orange">
              [ History ]
            </p>
            <h2 className="mt-4 text-4xl font-black uppercase tracking-[-0.05em] text-[var(--mecg-blue-dark)] md:text-6xl">
              Founded to close the consulting access gap.
            </h2>
          </div>
          <div className="space-y-6 text-lg leading-relaxed text-muted">
            <p>
              MECG was founded in 2023 by Jonathan Fay and Aaryan Singh with the vision of creating a space where students could grow personally, professionally, and socially.
            </p>
            <p>
              At the time, the University of Michigan had fewer consulting opportunities designed for non-business students. MECG filled that gap by helping students develop business acumen, gain project experience, and collaborate across disciplines.
            </p>
            <p>
              Today, MECG continues to prepare students to thrive in consulting and beyond by combining analytical work, client service, mentorship, and a close community.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
