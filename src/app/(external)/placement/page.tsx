import { clients } from "../../../lib/site-content";

export default function PlacementPage() {
  return (
    <main>
      <section className="px-6 py-20 md:px-12 md:py-28">
        <div className="mx-auto max-w-7xl">
          <p className="font-mono text-sm font-bold uppercase tracking-[0.24em] text-orange">
            [ Placement ]
          </p>
          <h1 className="mt-6 max-w-5xl text-5xl font-black uppercase leading-[0.9] tracking-[-0.06em] text-[var(--mecg-blue-dark)] md:text-8xl">
            Where MECG members and projects go.
          </h1>
          <p className="mt-8 max-w-3xl text-xl leading-relaxed text-muted">
            This page will become the placement and internship index. For now, it highlights MECG client-facing project experience from past semesters.
          </p>
        </div>
      </section>

      <section className="border-y border-line bg-white px-6 py-16 md:px-12">
        <div className="mx-auto max-w-7xl">
          <p className="font-mono text-sm font-bold uppercase tracking-[0.24em] text-orange">
            [ Project Index ]
          </p>
          <div className="mt-10 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
            {clients.map((client, index) => (
              <article key={client.name} className="flex min-h-40 flex-col justify-between border border-line bg-[var(--paper)] p-5 transition hover:-translate-y-1 hover:border-[var(--mecg-orange)]">
                <p className="font-mono text-sm font-bold text-orange">
                  [{String(index + 1).padStart(2, "0")}]
                </p>
                <div>
                  <h2 className="text-2xl font-black uppercase tracking-[-0.04em] text-[var(--mecg-blue-dark)]">
                    {client.name}
                  </h2>
                  <p className="mt-3 font-mono text-xs uppercase tracking-[0.16em] text-muted">
                    {client.term}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
