import { contact } from "../../../lib/site-content";

export const metadata = {
  title: "Contact — MECG",
  description:
    "Reach the Michigan Engineering Consulting Group about recruitment, client projects, partnerships, or general questions.",
};

const inputClasses =
  "focus-ring w-full rounded-[0.85rem] border border-white/12 bg-white/[0.045] px-5 py-4 text-base text-white placeholder:text-white/35 outline-none transition-colors focus:border-[var(--orange)]/70";

export default function ContactPage() {
  return (
    <main>
      {/* Sheet header */}
      <section className="grid-bg relative overflow-hidden px-5 pb-16 pt-36 md:px-8 md:pb-24 md:pt-44">
        <div className="orb right-[-12rem] top-[-10rem] h-[28rem] w-[28rem] bg-[var(--blue)]" />
        <div className="container relative">
          <p className="annotation annotation-accent" data-reveal>
            Sheet 07 — Contact
          </p>
          <h1 className="display-xl mt-6 max-w-6xl text-white" data-split>
            Open a <span className="text-ghost">channel.</span>
          </h1>
          <p className="mt-8 max-w-3xl text-xl leading-relaxed text-white/62" data-reveal>
            Recruitment, client projects, partnerships, or general questions —
            the board reads everything.
          </p>
          <div className="dim-rule mt-12" data-reveal />
        </div>
      </section>

      {/* Form + connect */}
      <section className="px-5 pb-24 md:px-8">
        <div className="container grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <form
            action={`mailto:${contact.email}`}
            method="post"
            encType="text/plain"
            className="panel grid gap-4 rounded-[2rem] p-7 md:p-10"
            data-reveal
          >
            <p className="annotation annotation-accent">Transmission form</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2">
                <span className="annotation !text-white/45">Full name</span>
                <input name="name" required placeholder="Your name" className={inputClasses} />
              </label>
              <label className="grid gap-2">
                <span className="annotation !text-white/45">Email</span>
                <input
                  name="email"
                  required
                  type="email"
                  placeholder="you@umich.edu"
                  className={inputClasses}
                />
              </label>
            </div>
            <label className="grid gap-2">
              <span className="annotation !text-white/45">Subject</span>
              <input name="subject" required placeholder="What is this about?" className={inputClasses} />
            </label>
            <label className="grid gap-2">
              <span className="annotation !text-white/45">Message</span>
              <textarea
                name="message"
                required
                placeholder="Tell us about it"
                rows={8}
                className={inputClasses}
              />
            </label>
            <button
              data-magnetic
              className="focus-ring mt-2 justify-self-start rounded-full bg-[var(--orange)] px-8 py-4 font-mono text-xs font-bold uppercase tracking-[0.18em] text-white transition-colors hover:bg-white hover:text-[var(--navy-950)]"
            >
              Send message
            </button>
          </form>

          <aside className="grid content-start gap-5">
            <div className="sheet rounded-[2rem] p-7 md:p-9" data-reveal="wipe">
              <p className="annotation !text-[var(--orange-dark)]">Direct line</p>
              <a
                href={`mailto:${contact.email}`}
                className="focus-ring mt-6 block break-all font-display text-2xl font-bold tracking-[-0.03em] text-[var(--navy-950)] hover:text-[var(--orange-dark)] md:text-3xl"
              >
                {contact.email}
              </a>
              <p className="mt-6 leading-relaxed text-[var(--on-paper-muted)]">{contact.location}</p>
            </div>

            <div className="panel rounded-[2rem] p-7 md:p-9" data-reveal>
              <p className="annotation annotation-accent">Elsewhere</p>
              <div className="mt-6 grid gap-3">
                <a
                  href={contact.instagram}
                  target="_blank"
                  rel="noreferrer"
                  className="focus-ring group flex items-center justify-between border-b border-white/10 pb-4"
                >
                  <span className="font-display text-xl font-bold uppercase tracking-[-0.03em] text-white group-hover:text-[var(--orange)]">
                    Instagram
                  </span>
                  <span className="annotation">@mecgmichigan ↗</span>
                </a>
                <a
                  href={contact.linkedin}
                  target="_blank"
                  rel="noreferrer"
                  className="focus-ring group flex items-center justify-between pb-1"
                >
                  <span className="font-display text-xl font-bold uppercase tracking-[-0.03em] text-white group-hover:text-[var(--orange)]">
                    LinkedIn
                  </span>
                  <span className="annotation">MECG ↗</span>
                </a>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
