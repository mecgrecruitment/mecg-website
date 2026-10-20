"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

export default function PillNav({
  ariaLabel,
  current,
  links,
  matchPathOnly = false,
}: {
  ariaLabel: string;
  current: string;
  links: ReadonlyArray<readonly [href: string, label: string]>;
  matchPathOnly?: boolean;
}) {
  const selectedLink = useRef<HTMLAnchorElement>(null);
  const strip = useRef<HTMLElement>(null);
  const selectedValue = matchPathOnly ? current.split(/[?#]/, 1)[0] : current;

  useEffect(() => {
    const container = strip.current;
    const selected = selectedLink.current;
    if (!container || !selected) return;
    const containerBox = container.getBoundingClientRect();
    const selectedBox = selected.getBoundingClientRect();
    container.scrollLeft += selectedBox.left - containerBox.left - (container.clientWidth - selectedBox.width) / 2;
  }, [current]);

  return (
    <nav ref={strip} aria-label={ariaLabel} className="scroll-cue overflow-x-auto">
      <div className="flex min-w-max gap-1">
        {links.map(([href, label]) => {
          const linkValue = matchPathOnly ? href.split(/[?#]/, 1)[0] : href;
          const isSelected = selectedValue === linkValue;
          return (
            <Link
              key={href}
              ref={isSelected ? selectedLink : undefined}
              href={href}
              aria-current={isSelected ? "page" : undefined}
              className={`inline-flex min-h-11 items-center rounded-xl px-3.5 text-sm font-semibold transition-colors duration-150 ${
                isSelected
                  ? "bg-mecg-navy text-white"
                  : "text-mecg-navy/60 hover:bg-mecg-blue/[0.08] hover:text-mecg-navy"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
