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

      <div className="demo-top-buttons fixed right-4 top-5 z-[90] flex items-center gap-2 md:right-8 md:top-6">
        <Link
          href="/apply"
          className="demo-top-apply inline-flex h-9 items-center justify-center rounded-full bg-[var(--orange)] px-5 text-[0.68rem] font-extrabold uppercase tracking-[0.14em] text-white shadow-xl shadow-black/20 transition hover:bg-[var(--orange-soft)]"
        >
          Apply
        </Link>

        <Link
          href="/member-login"
          className="inline-flex h-9 items-center justify-center rounded-full border border-white/15 bg-[var(--navy-900)]/95 px-5 text-[0.68rem] font-extrabold uppercase tracking-[0.14em] text-white shadow-xl shadow-black/20 backdrop-blur transition hover:border-[var(--orange)] hover:bg-[var(--orange)]"
        >
          Member Login
        </Link>
      </div>
    </>
  );
}
