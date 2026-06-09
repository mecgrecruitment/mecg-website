import { contact } from "../../../lib/site-content";

export default function ContactPage() {
  return (
    <main>
      <section className="px-6 py-20 md:px-12 md:py-28">
        <div className="mx-auto max-w-7xl">
          <p className="font-mono text-sm font-bold uppercase tracking-[0.24em] text-orange">
            [ Contact ]
          </p>
          <h1 className="mt-6 max-w-5xl text-5xl font-black uppercase leading-[0.9] tracking-[-0.06em] text-[var(--mecg-blue-dark)] md:text-8xl">
            Send us a message.
          </h1>
          <p className="mt-8 max-w-3xl text-xl leading-relaxed text-muted">
            Reach out about recruitment, client projects, partnerships, or general questions.
          </p>
        </div>
      </section>

      <section className="border-y border-line bg-white px-6 py-16 md:px-12">
        <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-[1fr_0.8fr]">
          <form action={`mailto:${contact.email}`} method="post" encType="text/plain" className="grid gap-4">
            <input name="name" required placeholder="Full Name" className="border border-line bg-[var(--paper)] px-5 py-4 text-lg outline-none focus:border-[var(--mecg-orange)]" />
            <input name="email" required type="email" placeholder="Email" className="border border-line bg-[var(--paper)] px-5 py-4 text-lg outline-none focus:border-[var(--mecg-orange)]" />
            <input name="subject" required placeholder="Subject" className="border border-line bg-[var(--paper)] px-5 py-4 text-lg outline-none focus:border-[var(--mecg-orange)]" />
            <textarea name="message" required placeholder="Message" rows={8} className="border border-line bg-[var(--paper)] px-5 py-4 text-lg outline-none focus:border-[var(--mecg-orange)]" />
            <button className="bg-[var(--mecg-orange)] px-6 py-4 font-mono text-sm font-bold uppercase tracking-[0.18em] text-white transition hover:bg-[var(--mecg-orange-dark)]">
              Send Message
            </button>
          </form>

          <aside className="border border-line bg-[var(--paper)] p-6">
            <p className="font-mono text-sm font-bold uppercase tracking-[0.24em] text-orange">
              [ Connect ]
            </p>
            <a href={`mailto:${contact.email}`} className="mt-8 block text-2xl font-black text-[var(--mecg-blue-dark)]">
              {contact.email}
            </a>
            <p className="mt-6 leading-relaxed text-muted">{contact.location}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href={contact.instagram} target="_blank" rel="noreferrer" className="border border-line px-4 py-3 font-mono text-xs font-bold uppercase tracking-[0.16em] text-blue hover:border-[var(--mecg-orange)]">
                Instagram
              </a>
              <a href={contact.linkedin} target="_blank" rel="noreferrer" className="border border-line px-4 py-3 font-mono text-xs font-bold uppercase tracking-[0.16em] text-blue hover:border-[var(--mecg-orange)]">
                LinkedIn
              </a>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
