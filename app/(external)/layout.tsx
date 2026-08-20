import React from "react";
import { GearLogo } from "@/components/brand/GearLogo";
import { contact, navLinks } from "@/lib/site-content";
import MotionProvider from "./components/MotionProvider";
import SiteHeader from "./components/SiteHeader";

export default function ExternalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <MotionProvider />
      <SiteHeader />

      <div id="main-content" tabIndex={-1}>
        {children}
      </div>

      <footer className="relative isolate overflow-hidden border-t border-white/10">
        {/* CTA band */}
        <div className="px-5 pb-10 pt-16 md:px-8 md:pt-24">
          <div className="container grid items-end gap-10 lg:grid-cols-[1.25fr_0.75fr]">
            <div>
              <p className="text-sm font-semibold text-[var(--orange-soft)]">Next step</p>
              <h2 className="mt-4 font-display text-4xl font-semibold tracking-[-0.04em] text-white md:text-6xl">
                Have a problem worth solving?
              </h2>
            </div>
            <div className="flex flex-wrap gap-3 lg:justify-end">
              <a
                href="/contact"
                data-magnetic
                className="focus-ring rounded-full bg-[var(--orange)] px-7 py-4 font-mono text-xs font-bold uppercase tracking-[0.16em] text-[var(--navy-950)] transition-colors hover:bg-white"
              >
                Work with us
              </a>
              <a
                href="/prospective-members"
                data-magnetic
                className="focus-ring rounded-full border border-white/16 px-7 py-4 font-mono text-xs font-bold uppercase tracking-[0.16em] text-white/75 transition-colors hover:border-white/40 hover:text-white"
              >
                Join the team
              </a>
            </div>
          </div>
        </div>

        {/* Link grid — columns top-aligned to the orange logo icon. */}
        <div className="relative px-5 py-12 md:px-8">
          <div className="container grid items-start gap-12 border-t border-white/10 pt-10 md:grid-cols-[1.5fr_0.8fr_1fr]">
            {/* Brand + description + inline socials */}
            <div>
              <div className="flex items-center gap-3">
                <GearLogo className="h-8 w-8 shrink-0 text-[var(--orange)]" />
                <p className="font-display text-2xl font-semibold tracking-[0.12em] text-white">
                  MECG
                </p>
              </div>
              <p className="mt-6 max-w-sm text-sm leading-relaxed text-white/46">
                Michigan Engineering Consulting Group. Pro-bono, student-led
                consulting at the University of Michigan.
              </p>
              {/* Inline social list — no pills, mono, with a diagonal arrow. */}
              <div className="mt-7 flex flex-wrap items-center gap-x-7 gap-y-3 font-mono text-xs font-bold uppercase tracking-[0.22em]">
                <a
                  href={contact.instagram}
                  target="_blank"
                  rel="noreferrer"
                  className="focus-ring group -my-3.5 inline-flex items-center gap-1.5 py-3.5 text-white/55 transition-colors hover:text-white"
                >
                  Instagram
                  <span
                    aria-hidden="true"
                    className="text-[var(--orange)] transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                  >
                    ↗
                  </span>
                </a>
                <a
                  href={contact.linkedin}
                  target="_blank"
                  rel="noreferrer"
                  className="focus-ring group -my-3.5 inline-flex items-center gap-1.5 py-3.5 text-white/55 transition-colors hover:text-white"
                >
                  LinkedIn
                  <span
                    aria-hidden="true"
                    className="text-[var(--orange)] transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                  >
                    ↗
                  </span>
                </a>
              </div>
            </div>

            {/* Navigation — all-caps mono, high tracking, single tidy column. */}
            <nav
              aria-label="Footer"
              className="flex flex-col gap-3 text-sm font-medium text-white/55"
            >
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="focus-ring -my-3.5 w-fit whitespace-nowrap py-3.5 transition-colors hover:text-white"
                >
                  {link.label}
                </a>
              ))}
              <a
                href="/apply"
                className="focus-ring -my-3.5 w-fit whitespace-nowrap py-3.5 text-[var(--orange)] transition-colors hover:text-white"
              >
                Apply
              </a>
            </nav>

            {/* Contact — prominent email + secondary address metadata. */}
            <div>
              <a
                href={`mailto:${contact.email}`}
                className="focus-ring group -my-3 inline-block w-fit py-3"
              >
                <span className="relative inline-block text-base font-semibold tracking-tight text-white/90 transition-colors group-hover:text-white md:text-lg">
                  {contact.email}
                  <span
                    aria-hidden="true"
                    className="absolute -bottom-0.5 left-0 h-px w-0 bg-[var(--orange)] transition-all duration-300 ease-out group-hover:w-full"
                  />
                </span>
              </a>
              <p className="mt-7 text-sm leading-relaxed text-white/60 opacity-60">
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

        <div className="px-5 pb-8 md:px-8">
          <p className="container border-t border-white/10 pt-6 text-sm text-white/35">© 2026 Michigan Engineering Consulting Group</p>
        </div>
      </footer>
    </div>
  );
}
