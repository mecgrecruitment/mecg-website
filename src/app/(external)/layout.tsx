import { GearLogo } from "../../components/brand/GearLogo";
import { contact, navLinks } from "../../lib/site-content";
import MotionProvider from "./components/MotionProvider";
import SiteHeader from "./components/SiteHeader";

export default function ExternalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="grain">
      <MotionProvider />
      <SiteHeader />

      {/* Scroll HUD — the dial turns with page progress (MotionProvider). */}
      <div className="hud-gear" aria-hidden="true">
        <div data-hud-gear className="h-full w-full">
          <GearLogo className="h-full w-full text-white/25" />
        </div>
      </div>

      {children}

      <footer className="relative overflow-hidden border-t border-white/10">
        {/* CTA band */}
        <div className="px-5 pb-10 pt-16 md:px-8 md:pt-24">
          <div className="container grid items-end gap-10 lg:grid-cols-[1.25fr_0.75fr]">
            <div>
              <p className="annotation annotation-accent">Next step</p>
              <h2 className="display mt-5 text-5xl uppercase text-white md:text-7xl">
                Have a problem
                <br />
                worth solving?
              </h2>
            </div>
            <div className="flex flex-wrap gap-3 lg:justify-end">
              <a
                href="/contact"
                data-magnetic
                className="focus-ring rounded-full bg-[var(--orange)] px-7 py-4 font-mono text-xs font-bold uppercase tracking-[0.16em] text-white transition-colors hover:bg-white hover:text-[var(--navy-950)]"
              >
                Work with us
              </a>
              <a
                href="/apply"
                data-magnetic
                className="focus-ring rounded-full border border-white/16 px-7 py-4 font-mono text-xs font-bold uppercase tracking-[0.16em] text-white/75 transition-colors hover:border-white/40 hover:text-white"
              >
                Join the team
              </a>
            </div>
          </div>
        </div>

        {/* Link grid */}
        <div className="px-5 py-12 md:px-8">
          <div className="container grid gap-10 border-t border-white/10 pt-10 md:grid-cols-[1.2fr_0.8fr_1fr]">
            <div>
              <div className="flex items-center gap-3">
                <GearLogo className="h-8 w-8 text-[var(--orange)]" />
                <p className="font-display text-2xl font-bold uppercase tracking-[0.24em] text-white">
                  MECG
                </p>
              </div>
              <p className="mt-5 max-w-sm text-sm leading-relaxed text-white/46">
                Michigan Engineering Consulting Group — pro-bono, student-led
                consulting at the University of Michigan.
              </p>
              <div className="mt-6 flex gap-3">
                <a
                  href={contact.instagram}
                  target="_blank"
                  rel="noreferrer"
                  className="focus-ring annotation rounded-full border border-white/14 px-4 py-2.5 text-white/60 transition-colors hover:border-[var(--orange)]/60 hover:text-white"
                >
                  Instagram
                </a>
                <a
                  href={contact.linkedin}
                  target="_blank"
                  rel="noreferrer"
                  className="focus-ring annotation rounded-full border border-white/14 px-4 py-2.5 text-white/60 transition-colors hover:border-[var(--orange)]/60 hover:text-white"
                >
                  LinkedIn
                </a>
              </div>
            </div>

            <nav aria-label="Footer" className="grid grid-cols-2 content-start gap-3 text-sm text-white/48">
              {navLinks.map((link) => (
                <a key={link.href} href={link.href} className="focus-ring hover:text-white">
                  {link.label}
                </a>
              ))}
              <a href="/apply" className="focus-ring text-[var(--orange)] hover:text-white">
                Apply
              </a>
            </nav>

            <div className="text-sm leading-relaxed text-white/48">
              <a href={`mailto:${contact.email}`} className="focus-ring hover:text-white">
                {contact.email}
              </a>
              <p className="mt-4">
                College of Engineering
                <br />
                University of Michigan
                <br />
                1221 Beal Ave
                <br />
                Ann Arbor, MI 48109
              </p>
            </div>
          </div>
        </div>

        {/* Drawing title block */}
        <div className="px-5 md:px-8">
          <div className="container grid grid-cols-2 gap-px overflow-hidden rounded-t-[0.75rem] border border-b-0 border-white/12 bg-white/12 md:grid-cols-4">
            {[
              ["Project", "MECG — Digital Platform"],
              ["Sheet", "No. 001 — External"],
              ["Scale", "1 : 1 — Ann Arbor, MI"],
              ["Drawn by", "MECG Board — © 2026"],
            ].map(([label, value]) => (
              <div key={label} className="bg-[var(--navy-950)] px-4 py-3">
                <p className="annotation text-[0.55rem]">{label}</p>
                <p className="mt-1 font-mono text-[0.7rem] font-bold uppercase tracking-[0.1em] text-white/65">
                  {value}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Ghost wordmark */}
        <div className="pointer-events-none select-none overflow-hidden" aria-hidden="true">
          <p className="display-xl text-ghost -mb-[0.18em] text-center">MECG</p>
        </div>
      </footer>
    </div>
  );
}
