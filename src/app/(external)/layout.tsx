import { contact, navLinks } from "../../lib/site-content";

export default function ExternalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <header className="sticky top-0 z-50 border-b border-[var(--line)] bg-white/82 px-5 py-4 shadow-sm backdrop-blur-xl md:px-10">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6">
          <a href="/" className="focus-ring flex items-center gap-3">
            <div className="gear-mark" aria-hidden="true" />
            <div className="leading-none">
              <p className="text-3xl font-black uppercase tracking-[0.24em] text-[var(--mecg-blue)]">
                MECG
              </p>
              <p className="mt-1 text-[0.62rem] font-black uppercase tracking-[0.48em] text-[var(--mecg-blue-light)]">
                Consulting
              </p>
            </div>
          </a>

          <nav className="hidden items-center gap-6 text-sm font-black uppercase tracking-[0.13em] text-[var(--mecg-blue-dark)] lg:flex">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="focus-ring transition hover:text-[var(--mecg-orange)]"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <a
            href="/apply"
            className="focus-ring bg-[var(--mecg-orange)] px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-white shadow-[0_10px_24px_rgba(245,130,58,0.32)] transition hover:-translate-y-0.5 hover:bg-[var(--mecg-orange-dark)]"
          >
            Apply
          </a>
        </div>
      </header>

      {children}

      <footer className="relative overflow-hidden bg-[var(--mecg-blue-deep)] px-5 py-14 text-white md:px-10">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[var(--mecg-orange)] opacity-20 blur-3xl" />
        <div className="absolute -bottom-32 left-0 h-80 w-80 rounded-full bg-[var(--mecg-blue)] opacity-40 blur-3xl" />

        <div className="relative mx-auto grid max-w-7xl gap-10 md:grid-cols-[1.2fr_0.7fr_0.7fr_1fr]">
          <div>
            <div className="flex items-center gap-3">
              <div className="gear-mark" aria-hidden="true" />
              <div>
                <p className="text-3xl font-black uppercase tracking-[0.24em] text-[var(--mecg-blue)]">
                  MECG
                </p>
                <p className="mt-1 text-[0.62rem] font-black uppercase tracking-[0.48em] text-[var(--mecg-blue-light)]">
                  Consulting
                </p>
              </div>
            </div>
            <p className="mt-6 max-w-sm text-lg leading-relaxed text-white/72">
              Michigan Engineering Consulting Group at the University of Michigan.
            </p>
          </div>

          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--mecg-orange)]">
              Navigation
            </p>
            <div className="mt-5 grid gap-3 text-white/72">
              {navLinks.slice(0, 4).map((link) => (
                <a key={link.href} href={link.href} className="hover:text-white">
                  {link.label}
                </a>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--mecg-orange)]">
              Resources
            </p>
            <div className="mt-5 grid gap-3 text-white/72">
              <a href="/recruitment" className="hover:text-white">Join Us</a>
              <a href="/contact" className="hover:text-white">Contact</a>
              <a href="/services" className="hover:text-white">Client Services</a>
              <a href="/apply" className="hover:text-white">Apply</a>
            </div>
          </div>

          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--mecg-orange)]">
              Contact
            </p>
            <a className="mt-5 block text-white/80 hover:text-white" href={`mailto:${contact.email}`}>
              {contact.email}
            </a>
            <p className="mt-4 leading-relaxed text-white/60">
              College of Engineering<br />
              University of Michigan<br />
              1221 Beal Ave<br />
              Ann Arbor, MI 48109
            </p>
          </div>
        </div>

        <div className="relative mx-auto mt-12 max-w-7xl border-t border-white/10 pt-6 text-xs uppercase tracking-[0.18em] text-white/45">
          © 2026 Michigan Engineering Consulting Group. All rights reserved.
        </div>
      </footer>
    </>
  );
}
