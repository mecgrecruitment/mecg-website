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

      <footer className="relative isolate overflow-hidden border-t border-white/10">
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

        {/* Link grid — columns top-aligned to the orange logo icon. */}
        <div className="relative px-5 py-12 md:px-8">
          <div className="container grid items-start gap-12 border-t border-white/10 pt-10 md:grid-cols-[1.5fr_0.8fr_1fr]">
            {/* Brand + description + inline socials */}
            <div>
              <div className="flex items-center gap-3">
                <GearLogo className="h-8 w-8 shrink-0 text-[var(--orange)]" />
                <p className="font-display text-2xl font-bold uppercase leading-none tracking-[0.24em] text-white">
                  MECG
                </p>
              </div>
              <p className="mt-6 max-w-sm text-sm leading-relaxed text-white/46">
                Michigan Engineering Consulting Group — pro-bono, student-led
                consulting at the University of Michigan.
              </p>
              {/* Inline social list — no pills, mono, with a diagonal arrow. */}
              <div className="mt-7 flex flex-wrap items-center gap-x-7 gap-y-3 font-mono text-xs font-bold uppercase tracking-[0.22em]">
                <a
                  href={contact.instagram}
                  target="_blank"
                  rel="noreferrer"
                  className="focus-ring group inline-flex items-center gap-1.5 text-white/55 transition-colors hover:text-white"
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
                  className="focus-ring group inline-flex items-center gap-1.5 text-white/55 transition-colors hover:text-white"
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
              className="flex flex-col gap-3.5 font-mono text-xs font-bold uppercase leading-[1.1] tracking-[0.22em] text-white/55"
            >
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="focus-ring w-fit whitespace-nowrap transition-colors hover:text-white"
                >
                  {link.label}
                </a>
              ))}
              <a
                href="/apply"
                className="focus-ring w-fit whitespace-nowrap text-[var(--orange)] transition-colors hover:text-white"
              >
                Apply
              </a>
            </nav>

            {/* Contact — prominent email + secondary address metadata. */}
            <div>
              <a
                href={`mailto:${contact.email}`}
                className="focus-ring group inline-block w-fit"
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

        {/* Drawing title block — metadata row. */}
        <div className="relative z-10 px-5 md:px-8">
          <div className="container grid grid-cols-2 gap-px overflow-hidden rounded-[0.75rem] border border-white/12 bg-white/12 md:grid-cols-4">
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

        {/* Ghost wordmark — oversized editorial finale, cropped by the bottom
            edge so the letterforms bleed off the page. */}
        <div
          className="pointer-events-none relative select-none overflow-hidden pt-12 md:pt-16"
          aria-hidden="true"
        >
          <p className="wordmark-bleed text-ghost block translate-y-[14%] text-center leading-[0.72]">
            MECG
          </p>
        </div>
      </footer>
    </div>
  );
}
