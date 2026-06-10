"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { GearLogo } from "../../../components/brand/GearLogo";
import { navLinks } from "../../../lib/site-content";

export default function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Route changes close the menu and restore scroll.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.documentElement.style.overflow = open ? "hidden" : "";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 px-5 transition-all duration-500 md:px-8 ${
          scrolled
            ? "border-b border-white/10 bg-[rgba(5,9,20,0.85)] py-3 backdrop-blur-xl"
            : "border-b border-transparent bg-transparent py-5"
        }`}
      >
        <div className="container flex items-center justify-between">
          <a href="/" className="focus-ring flex items-center gap-3">
            <GearLogo className="h-8 w-8 text-[var(--orange)]" />
            <div>
              <p className="font-display text-lg font-bold uppercase tracking-[0.24em] text-white">
                MECG
              </p>
              <p className="annotation text-[0.55rem] tracking-[0.34em]">
                EST. 2023 — ANN ARBOR
              </p>
            </div>
          </a>

          <nav
            aria-label="Primary"
            className="hidden items-center gap-7 font-mono text-[0.68rem] font-bold uppercase tracking-[0.2em] lg:flex"
          >
            {navLinks.map((link, i) => {
              const active = pathname === link.href;
              return (
                <a
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={`focus-ring group relative py-2 transition-colors ${
                    active ? "text-white" : "text-white/55 hover:text-white"
                  }`}
                >
                  <span className="mr-1.5 text-[0.55rem] text-[var(--orange)]/70">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {link.label}
                  <span
                    className={`absolute -bottom-0.5 left-0 h-px bg-[var(--orange)] transition-all duration-300 ${
                      active ? "w-full" : "w-0 group-hover:w-full"
                    }`}
                  />
                </a>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">
            <a
              href="/apply"
              data-magnetic
              className="focus-ring hidden rounded-full bg-[var(--orange)] px-5 py-2.5 font-mono text-[0.68rem] font-bold uppercase tracking-[0.18em] text-white transition-colors hover:bg-white hover:text-[var(--navy-950)] sm:inline-block"
            >
              Apply
            </a>
            <button
              type="button"
              aria-expanded={open}
              aria-controls="site-menu"
              onClick={() => setOpen((v) => !v)}
              className="focus-ring grid h-10 w-10 place-items-center rounded-full border border-white/15 lg:hidden"
            >
              <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
              <span className="relative block h-3 w-5" aria-hidden="true">
                <span
                  className={`absolute left-0 top-0 h-0.5 w-full bg-white transition-transform duration-300 ${
                    open ? "translate-y-[5px] rotate-45" : ""
                  }`}
                />
                <span
                  className={`absolute bottom-0 left-0 h-0.5 w-full bg-white transition-transform duration-300 ${
                    open ? "-translate-y-[5px] -rotate-45" : ""
                  }`}
                />
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Full-screen drafting-sheet menu (mobile / tablet). */}
      <div
        id="site-menu"
        className={`fixed inset-0 z-40 flex flex-col justify-end bg-[var(--navy-950)]/97 px-6 pb-12 pt-28 backdrop-blur-2xl transition-opacity duration-400 lg:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <div className="grid-bg absolute inset-0 opacity-60" aria-hidden="true" />
        <nav aria-label="Mobile" className="relative grid gap-1">
          {navLinks.map((link, i) => (
            <a
              key={link.href}
              href={link.href}
              className="focus-ring group flex items-baseline gap-4 border-t border-white/10 py-4"
              style={{
                transition: `opacity 0.5s ${i * 60 + 100}ms, transform 0.5s ${i * 60 + 100}ms`,
                opacity: open ? 1 : 0,
                transform: open ? "none" : "translateY(18px)",
              }}
            >
              <span className="annotation annotation-accent">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="font-display text-4xl font-bold uppercase tracking-[-0.04em] text-white group-hover:text-[var(--orange)]">
                {link.label}
              </span>
            </a>
          ))}
          <a
            href="/apply"
            className="focus-ring mt-6 inline-block self-start rounded-full bg-[var(--orange)] px-7 py-4 font-mono text-xs font-bold uppercase tracking-[0.18em] text-white"
            style={{
              transition: "opacity 0.5s 500ms, transform 0.5s 500ms",
              opacity: open ? 1 : 0,
              transform: open ? "none" : "translateY(18px)",
            }}
          >
            Apply to MECG
          </a>
        </nav>
      </div>
    </>
  );
}
