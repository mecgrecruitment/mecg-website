"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuth, useClerk } from "@clerk/nextjs";

const NAV_LINKS = [
  { href: "/team", label: "Our Team" },
  { href: "/work", label: "Client Services" },
  { href: "/join", label: "Join Our Team" },
  { href: "/contact", label: "Contact Us" },
];

function SignOutControl({ className, onNavigate }: { className: string; onNavigate?: () => void }) {
  const clerk = useClerk();
  const [busy, setBusy] = useState(false);

  async function logout() {
    if (busy) return;
    setBusy(true);
    onNavigate?.();
    try {
      await clerk.signOut({ redirectUrl: "/login" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" onClick={logout} disabled={busy} className={`${className} disabled:cursor-wait disabled:opacity-50 disabled:scale-100`}>
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}

// Core 3 removed <SignedIn>/<SignedOut>; its <Show> replacement renders nothing
// until Clerk loads, which would blank the log in link on every prerendered
// marketing page, so read the state directly and default to signed out.
function ClerkAuthControl({ className, onNavigate }: { className: string; onNavigate?: () => void }) {
  const { isSignedIn } = useAuth();
  if (!isSignedIn) return <Link href="/login" onClick={onNavigate} className={className}>Member log in</Link>;
  return <SignOutControl className={className} onNavigate={onNavigate} />;
}

// ClerkProvider is only mounted when the publishable key is set (see app/layout.tsx),
// and Clerk hooks throw without it, so fall back to the plain link.
function AuthControl({ className, onNavigate }: { className: string; onNavigate?: () => void }) {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim()) {
    return <Link href="/login" onClick={onNavigate} className={className}>Member log in</Link>;
  }
  return <ClerkAuthControl className={className} onNavigate={onNavigate} />;
}

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
              className={`inline-flex min-h-10 items-center border-b transition-[border-color,color,transform] duration-150 active:scale-96 ${pathname === href ? "border-mecg-orange text-white" : "border-transparent text-white/60 hover:border-white/35 hover:text-white"}`}
            >
              {label}
            </Link>
          ))}
          <AuthControl className="inline-flex min-h-10 items-center border-b border-transparent text-white/60 transition-[border-color,color,transform] duration-150 hover:border-white/35 hover:text-white active:scale-96" />
          <Link href="/join" className="button-primary">Join MECG</Link>
        </nav>
        <button
          type="button"
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen((value) => !value)}
          className="flex min-h-11 min-w-11 items-center justify-center border border-white/20 text-sm transition-[background-color,transform] duration-150 hover:bg-white/8 active:scale-96 md:hidden"
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
                className={`border-b border-white/10 py-4 text-lg transition-[color,transform] duration-150 active:translate-x-0.5 ${pathname === href ? "text-mecg-orange" : "text-white"}`}
              >
                {label}
              </Link>
            ))}
            <AuthControl className="border-b border-white/10 py-4 text-left text-lg text-white" onNavigate={() => setOpen(false)} />
            <Link href="/join" onClick={() => setOpen(false)} className="button-primary mt-5 text-center">Join MECG</Link>
          </div>
        </nav>
      )}
    </header>
  );
}
