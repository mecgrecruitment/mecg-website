import { contact, navLinks } from "@/lib/site-content";

export default function ExternalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <header className="sticky top-0 z-50 border-b border-line bg-white/85 px-6 py-4 backdrop-blur-xl md:px-12">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6">
          <a href="/" className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center bg-[var(--mecg-orange)] text-xl font-black text-white">
              ⚙
            </div>
            <div>
              <p className="text-2xl font-black uppercase tracking-[0.24em] text-[var(--mecg-blue)]">
                MECG
              </p>
              <p className="font-mono text-[0.6rem] font-bold uppercase tracking-[0.38em] text-[var(--mecg-blue-light)]">
                Consulting
              </p>
            </div>
          </a>

          <nav className="hidden items-center gap-5 font-mono text-xs font-bold uppercase tracking-[0.16em] text-[var(--mecg-blue-dark)] lg:flex">
            {navLinks.map((link) => (
              <a key={link.href} href={link.href} className="transition hover:text-orange">
                {link.label}
              </a>
            ))}
          </nav>

          <a
            href="/apply"
            className="focus-ring bg-[var(--mecg-blue)] px-4 py-3 font-mono text-xs font-bold uppercase tracking-[0.16em] text-white transition hover:bg-[var(--mecg-orange)]"
          >
            Apply
          </a>
        </div>
      </header>

      {children}

      <footer className="border-t border-line bg-white px-6 py-10 md:px-12">
        <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-[1fr_1fr_1fr]">
          <div>
            <p className="text-3xl font-black uppercase tracking-[0.22em] text-[var(--mecg-blue)]">
              MECG
            </p>
            <p className="mt-3 text-muted">Michigan Engineering Consulting Group</p>
            <p className="mt-1 text-muted">University of Michigan — Ann Arbor</p>
          </div>

          <div>
            <p className="font-mono text-xs font-bold uppercase tracking-[0.22em] text-orange">
              Navigation
            </p>
            <div className="mt-4 grid gap-2">
              {navLinks.map((link) => (
                <a key={link.href} href={link.href} className="text-muted hover:text-blue">
                  {link.label}
                </a>
              ))}
            </div>
          </div>

          <div>
            <p className="font-mono text-xs font-bold uppercase tracking-[0.22em] text-orange">
              Contact
            </p>
            <a className="mt-4 thereblock text-muted hover:text-blue" href={`mailto:${contact.email}`}>
              {contact.email}
            </a>
            <p className="mt-2 text-muted">1221 Beal Ave, Ann Arbor, MI 48109</p>
          </div>
        </div>

        <div className="mx-auto mt-10 max-w-7xl border-t border-line pt-6 font-mono text-xs uppercase tracking-[0.18em] text-muted">
          © 2026 Michigan Engineering Consulting Group. All rights reserved.
        </div>
      </footer>
    </>
  );
}