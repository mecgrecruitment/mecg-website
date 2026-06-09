import { faqs, recruitmentEvents } from "../../../lib/site-content";

export default function RecruitmentPage() {
  return (
    <main>
      <section className="px-6 py-20 md:px-12 md:py-28">
        <div className="mx-auto max-w-7xl">
          <p className="font-mono text-sm font-bold uppercase tracking-[0.24em] text-orange">
            [ Recruitment ]
          </p>
          <h1 className="mt-6 max-w-6xl text-5xl font-black uppercase leading-[0.9] tracking-[-0.06em] text-[var(--mecg-blue-dark)] md:text-8xl">
            Apply to MECG this Winter.
          </h1>
          <p className="mt-8 max-w-3xl text-xl leading-relaxed text-muted">
            Join an open-rush process designed to help you learn about the club, meet members, and show how you think.
          </p>
          <a
            href="/apply"
            className="focus-ring mt-10 inline-block bg-[var(--mecg-orange)] px-6 py-4 font-mono text-sm font-bold uppercase tracking-[0.18em] text-white transition hover:bg-[var(--mecg-orange-dark)]"
          >
            Apply Now
          </a>
        </div>
      </section>

      <section className="border-y border-line bg-white px-6 py-16 md:px-12">
        <div className="mx-auto max-w-7xl">
          <p className="font-mono text-sm font-bold uppercase tracking-[0.24em] text-orange">
            [ Winter 2026 Timeline ]
          </p>
          <div className="mt-10 grid gap-4">
            {recruitmentEvents.map((event) => (
              <article key={event.code} className="grid gap-6 border border-line bg-[var(--paper)] p-6 md:grid-cols-[10rem_1fr_16rem]">
                <div>
                  <p className="font-mono text-2xl font-bold text-orange">{event.code}</p>
                  <p className="mt-2 font-mono text-xs font-bold uppercase tracking-[0.16em] text-blue">
                    {event.type}
                  </p>
                </div>
                <div>
                  <h2 className="text-3xl font-black uppercase tracking-[-0.04em] text-[var(--mecg-blue-dark)]">
                    {event.title}
                  </h2>
                  <p className="mt-3 leading-relaxed text-muted">{event.body}</p>
                </div>
                <div className="font-mono text-sm uppercase leading-relaxed tracking-[0.08em] text-muted">
                  <p>{event.date}</p>
                  <p>{event.time}</p>
                  <p>{event.location}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-20 md:px-12">
        <div className="mx-auto max-w-7xl">
          <p className="font-mono text-sm font-bold uppercase tracking-[0.24em] text-orange">
            [ FAQ ]
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {faqs.map((faq) => (
              <article key={faq.question} className="border border-line bg-white p-6">
                <h2 className="text-2xl font-black uppercase tracking-[-0.04em] text-[var(--mecg-blue-dark)]">
                  {faq.question}
                </h2>
                <p className="mt-4 leading-relaxed text-muted">{faq.answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
