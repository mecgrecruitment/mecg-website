"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { secondaryDestinationLabel, type WorkspaceNavLink } from "@/lib/workspace-navigation";

export default function WorkspaceMoreMenu({
  current,
  myTools,
  adminTools,
}: {
  current: string;
  myTools: readonly WorkspaceNavLink[];
  adminTools: readonly WorkspaceNavLink[];
}) {
  const [openPath, setOpenPath] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const open = openPath === pathname;
  const currentPath = current.split(/[?#]/, 1)[0];
  const currentSecondary = secondaryDestinationLabel(current, [...myTools, ...adminTools]);

  useEffect(() => {
    if (!open) return;

    const dismissOutside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpenPath(null);
    };
    const dismissWithEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenPath(null);
        root.current?.querySelector<HTMLButtonElement>("button")?.focus();
      }
    };

    document.addEventListener("pointerdown", dismissOutside);
    document.addEventListener("keydown", dismissWithEscape);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside);
      document.removeEventListener("keydown", dismissWithEscape);
    };
  }, [open]);

  const linkList = (links: readonly WorkspaceNavLink[]) => (
    <div className="grid gap-0.5">
      {links.map(([href, label]) => {
        const selected = currentPath === href;
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setOpenPath(null)}
            aria-current={selected ? "page" : undefined}
            className={`flex min-h-11 items-center justify-between rounded-xl px-3 text-sm font-semibold transition-colors duration-150 ${
              selected
                ? "bg-mecg-navy text-white"
                : "text-mecg-navy/65 hover:bg-mecg-blue/[0.08] hover:text-mecg-navy"
            }`}
          >
            {label}
            {selected && <span className="size-1.5 rounded-full bg-mecg-orange" aria-hidden="true" />}
          </Link>
        );
      })}
    </div>
  );

  return (
    <div ref={root} className="relative shrink-0">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="workspace-more-destinations"
        onClick={() => setOpenPath(open ? null : pathname)}
        className={`flex min-h-11 items-center gap-2 rounded-xl px-3.5 text-sm font-semibold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 ${
          currentSecondary
            ? "bg-mecg-navy text-white focus-visible:outline-mecg-orange"
            : "text-mecg-navy/60 hover:bg-mecg-blue/[0.08] hover:text-mecg-navy focus-visible:outline-mecg-navy"
        }`}
      >
        {currentSecondary ?? "More"}
        <svg
          aria-hidden="true"
          width="16"
          height="16"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        >
          <path d="M5 8l5 5 5-5" />
        </svg>
      </button>
      {open && (
        <nav
          id="workspace-more-destinations"
          aria-label="More workspace destinations"
          className="absolute right-0 top-[calc(100%+0.5rem)] max-h-[min(70vh,36rem)] w-[min(20rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl bg-white p-2 shadow-[0_18px_55px_rgba(7,13,31,0.18),inset_0_0_0_1px_rgba(7,13,31,0.1)]"
        >
          <p className="px-3 pb-1 pt-2 text-xs font-semibold text-mecg-navy/60">My workspace</p>
          {linkList(myTools)}
          {adminTools.length > 0 && (
            <>
              <div className="mx-3 my-2 border-t border-mecg-navy/[0.08]" />
              <p className="px-3 pb-1 pt-1 text-xs font-semibold text-mecg-navy/60">Admin tools</p>
              {linkList(adminTools)}
            </>
          )}
        </nav>
      )}
    </div>
  );
}
