"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const NAV_LINKS = [
  { href: "/team", label: "Our Team" },
  { href: "/work", label: "Client Services" },
  { href: "/join", label: "Join Our Team" },
  { href: "/contact", label: "Contact Us" },
];

export default function SiteHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-mecg-navy/95 text-white shadow-[0_8px_30px_rgba(7,13,31,0.16)] backdrop-blur">
      <div className="mx-auto flex min-h-18 max-w-[90rem] items-center justify-between px-6 sm:px-10 xl:px-24">
        <Link href="/home" className="flex min-h-11 items-center rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-mecg-orange" aria-label="MECG home">
          <Image src="/logos/mecg-white.svg" alt="MECG" width={168} height={44} priority className="h-8 w-auto sm:h-9" style={{ width: "auto" }} />
        </Link>
        <nav aria-label="Main navigation" className="hidden items-center gap-6 text-sm font-medium md:flex">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              aria-current={pathname === href ? "page" : undefined}
              className={`inline-flex min-h-10 items-center border-b transition-colors ${pathname === href ? "border-mecg-orange text-white" : "border-transparent text-white/60 hover:text-white"}`}
            >
              {label}
            </Link>
          ))}
          <Link href="/login" className="inline-flex min-h-10 items-center border-b border-transparent text-white/60 transition-colors hover:text-white">Member log in</Link>
          <Link href="/apply" className="button-primary">Apply now</Link>
        </nav>
        <button
          type="button"
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen((value) => !value)}
          className="flex min-h-11 min-w-11 items-center justify-center border border-white/20 text-sm md:hidden"
        >
          {open ? "Close" : "Menu"}
        </button>
      </div>
      {open && (
        <nav id="mobile-menu" aria-label="Mobile navigation" className="border-t border-white/10 px-6 py-5 sm:px-10 md:hidden">
          <div className="mx-auto flex max-w-6xl flex-col">
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                aria-current={pathname === href ? "page" : undefined}
                onClick={() => setOpen(false)}
                className={`border-b border-white/10 py-4 text-lg ${pathname === href ? "text-mecg-orange" : "text-white"}`}
              >
                {label}
              </Link>
            ))}
            <Link href="/login" onClick={() => setOpen(false)} className="border-b border-white/10 py-4 text-lg text-white">Member log in</Link>
            <Link href="/apply" onClick={() => setOpen(false)} className="button-primary mt-5 text-center">Apply now</Link>
          </div>
        </nav>
      )}
    </header>
  );
}
