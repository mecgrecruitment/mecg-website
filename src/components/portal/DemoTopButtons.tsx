"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function DemoTopButtons() {
  const pathname = usePathname();

  if (
    pathname.startsWith("/apply") ||
    pathname.startsWith("/internal") ||
    pathname.startsWith("/member-login") ||
    pathname.startsWith("/auth")
  ) {
    return null;
  }

  return (
    <>
      <style jsx global>{`
        body:has(.demo-top-buttons) a[href="/apply"]:not(.demo-top-apply) {
          display: none !important;
        }
      `}</style>

      <div className="demo-top-buttons fixed right-4 top-4 z-[90] flex items-center gap-3 md:right-8 md:top-8">
        <Link
          href="/apply"
          className="demo-top-apply inline-flex h-11 items-center justify-center rounded-full bg-[var(--orange)] px-6 text-xs font-extrabold uppercase tracking-[0.16em] text-white shadow-xl shadow-black/25 transition hover:bg-[var(--orange-soft)]"
        >
          Apply
        </Link>

        <Link
          href="/member-login"
          className="inline-flex h-11 items-center justify-center rounded-full border border-white/15 bg-[var(--navy-900)]/90 px-6 text-xs font-extrabold uppercase tracking-[0.16em] text-white shadow-xl shadow-black/25 backdrop-blur transition hover:border-[var(--orange)] hover:bg-[var(--orange)]"
        >
          Member Login
        </Link>
      </div>
    </>
  );
}
