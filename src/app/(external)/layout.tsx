import { GearLogo } from "../../components/brand/GearLogo";
import { contact, navLinks } from "../../lib/site-content";

export default function ExternalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[rgba(5,9,20,0.82)] px-5 py-4 backdrop-blur-xl md:px-8">
        <div className="container flex items-center justify-between">
          <a href="/" className="focus-ring flex items-center gap-3">
            <GearLogo className="h-8 w-8 text-[var(--orange)]" />
            <div>
              <p className="font-display text-xl font-bold uppercase tracking-[0.24em] text-white">
                MECG
              </p>
              <p className="text-[0.58rem] font-bold uppercase tracking-[0.34em] text-white/40">
                Consulting
              </p>
            </div>
          </a>

          <nav className="hidden items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1 text-[0.7rem] font-bold uppercase tracking-[0.14em] text-white/56 lg:flex">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="focus-ring rounded-full px-4 py-2 transition hover:bg-white/10 hover:text-white"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <a
            href="/apply"
            className="focus-ring rounded-full bg-white px-4 py-2.5 text-[0.7rem] font-extrabold uppercase tracking-[0.15em] text-[var(--navy-950)] transition hover:bg-[var(--orange)] hover:text-white"
          >
            Apply
          </a>
        </div>
      </header>

      {children}

      <footer className="border-t border-white/10 px-5 py-12 md:px-8">
        <div className="container grid gap-10 md:grid-cols-[1.2fr_0.8fr_1fr]">
          <div>
            <div className="flex items-center gap-3">
              <GearLogo className="h-8 w-8 text-[var(--orange)]" />
              <p className="font-display text-2xl font-bold uppercase tracking-[0.24em] text-white">
                MECG
              </p>
            </div>
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-white/46">
              Michigan Engineering Consulting Group at the University of Michigan.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm text-white/48">
            {navLinks.map((link) => (
              <a key={link.href} href={link.href} className="hover:text-white">
                {link.label}
              </a>
            ))}
          </div>

          <div className="text-sm leading-relaxed text-white/48">
            <a href={`mailto:${contact.email}`} className="hover:text-white">
              {contact.email}
            </a>
            <p className="mt-4">
              College of Engineering<br />
              University of Michigan<br />
              1221 Beal Ave<br />
              Ann Arbor, MI 48109
            </p>
          </div>
        </div>

        <div className="container mt-10 border-t border-white/10 pt-5 text-xs uppercase tracking-[0.18em] text-white/28">
          © 2026 Michigan Engineering Consulting Group
        </div>
      </footer>
    </>
  );
}
