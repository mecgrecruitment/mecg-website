import { teamMembers } from "../../../lib/site-content";

export default function TeamPage() {
  return (
    <main>
      <section className="px-6 py-20 md:px-12 md:py-28">
        <div className="mx-auto max-w-7xl">
          <p className="font-mono text-sm font-bold uppercase tracking-[0.24em] text-orange">
            [ Our Team ]
          </p>
          <h1 className="mt-6 max-w-5xl text-5xl font-black uppercase leading-[0.9] tracking-[-0.06em] text-[var(--mecg-blue-dark)] md:text-8xl">
            Meet the students leading MECG.
          </h1>
          <p className="mt-8 max-w-3xl text-xl leading-relaxed text-muted">
            MECG is led by students across consulting, education, recruitment, finance, marketing, internal operations, and external relations.
          </p>
        </div>
      </section>

      <section className="border-y border-line bg-white px-6 py-16 md:px-12">
        <div className="mx-auto grid max-w-7xl gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {teamMembers.map((member, index) => (
            <article key={member.name} className="group border border-line bg-[var(--paper)] p-5 transition hover:-translate-y-1 hover:border-[var(--mecg-orange)]">
              <div className="grid aspect-square place-items-center bg-[var(--mecg-blue)] text-4xl font-black text-white">
                {member.name
                  .split(" ")
                  .map((part) => part[0])
                  .join("")}
              </div>
              <p className="mt-5 font-mono text-xs font-bold uppercase tracking-[0.18em] text-orange">
                [{String(index + 1).padStart(2, "0")}] {member.group}
              </p>
              <h2 className="mt-3 text-2xl font-black uppercase leading-none tracking-[-0.04em] text-[var(--mecg-blue-dark)]">
                {member.name}
              </h2>
              <p className="mt-3 text-muted">{member.role}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
