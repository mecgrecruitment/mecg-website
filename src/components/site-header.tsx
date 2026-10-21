"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { useAuth, useClerk } from "@clerk/nextjs";
import SignOutAction from "@/components/sign-out-action";

const NAV_LINKS = [
  { href: "/work", label: "Client Services" },
  { href: "/team", label: "Our Team" },
  { href: "/contact", label: "Contact Us" },
];

function SignOutControl({ className, onNavigate }: { className: string; onNavigate?: () => void }) {
  const clerk = useClerk();
  return <SignOutAction className={className} signOut={() => clerk.signOut({ redirectUrl: "/login" })} onComplete={onNavigate} />;
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

// Signed-in visitors already have a workspace; /login resolves which one
// (admin, member, applicant) server-side and redirects, so send them there.
function PrimaryAction({ className, onNavigate }: { className: string; onNavigate?: () => void }) {
  const clerkConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim());
  return clerkConfigured ? <ClerkPrimaryAction className={className} onNavigate={onNavigate} /> : <Link href="/join" onClick={onNavigate} className={className}>Join MECG</Link>;
}

function ClerkPrimaryAction({ className, onNavigate }: { className: string; onNavigate?: () => void }) {
  const { isSignedIn } = useAuth();
  return isSignedIn
    // Orange stays reserved for the page's own call to action; a member's way back in is secondary.
    ? <Link href="/login" onClick={onNavigate} className={className.replace("button-primary", "button-secondary")}>My workspace</Link>
    : <Link href="/join" onClick={onNavigate} className={className}>Join MECG</Link>;
}

export default function SiteHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const menuButton = useRef<HTMLButtonElement>(null);

  return (
    <header
      className="sticky top-0 z-50 border-b border-public-rule bg-public-ground/95 px-6 text-public-ink backdrop-blur-sm sm:px-10"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          setOpen(false);
          menuButton.current?.focus();
        }
      }}
    >
      <div className="mx-auto flex min-h-18 max-w-6xl items-center justify-between">
        <Link href="/home" className="flex min-h-11 items-center rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-mecg-blue" aria-label="MECG home">
          <Image src="/logos/mecg-color.svg" alt="MECG" width={168} height={44} preload className="h-8 w-auto sm:h-9" style={{ width: "auto" }} />
        </Link>
        <nav aria-label="Main navigation" className="hidden items-center gap-5 text-sm font-medium lg:flex">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              aria-current={(pathname === href || pathname.startsWith(`${href}/`)) ? "page" : undefined}
              className={`inline-flex min-h-11 items-center border-b transition-[border-color,color,transform] duration-150 active:scale-96 ${(pathname === href || pathname.startsWith(`${href}/`)) ? "border-mecg-orange text-public-ink" : "border-transparent text-muted hover:border-public-edge hover:text-mecg-blue"}`}
            >
              {label}
            </Link>
          ))}
          <AuthControl className="inline-flex min-h-11 items-center border-b border-transparent text-muted transition-[border-color,color,transform] duration-150 hover:border-public-edge hover:text-mecg-blue active:scale-96" />
          <PrimaryAction className="button-primary" />
        </nav>
        <button
          ref={menuButton}
          type="button"
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen((value) => !value)}
          className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-public-edge px-3 text-sm transition-[background-color,transform] duration-150 hover:bg-white active:scale-96 lg:hidden"
        >
          {open ? "Close" : "Menu"}
        </button>
      </div>
      {open && (
        <nav id="mobile-menu" aria-label="Mobile navigation" className="max-h-[calc(100dvh-4.5rem)] overflow-y-auto border-t border-public-rule py-5 lg:hidden">
          <div className="mx-auto flex max-w-6xl flex-col">
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                aria-current={(pathname === href || pathname.startsWith(`${href}/`)) ? "page" : undefined}
                onClick={() => setOpen(false)}
                className={`border-b border-public-rule py-4 text-lg transition-[color,transform] duration-150 active:translate-x-0.5 ${(pathname === href || pathname.startsWith(`${href}/`)) ? "font-semibold text-mecg-blue" : "text-public-ink"}`}
              >
                {label}
              </Link>
            ))}
            <AuthControl className="border-b border-public-rule py-4 text-left text-lg text-public-ink" onNavigate={() => setOpen(false)} />
            <PrimaryAction className="button-primary mt-5 text-center" onNavigate={() => setOpen(false)} />
          </div>
        </nav>
      )}
    </header>
  );
}
