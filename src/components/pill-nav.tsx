"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, useState } from "react";

export default function PillNav({
  ariaLabel,
  current,
  links,
}: {
  ariaLabel: string;
  current: string;
  links: ReadonlyArray<readonly [href: string, label: string]>;
}) {
  const [pending, setPending] = useState<{ from: string; href: string } | null>(null);
  const selected = pending?.from === current ? pending.href : current;
  const linkRefs = useRef(new Map<string, HTMLAnchorElement>());
  const [indicator, setIndicator] = useState({ left: 0, width: 0, ready: false });

  useLayoutEffect(() => {
    const selectedLink = linkRefs.current.get(selected);
    if (!selectedLink) return;

    const updateIndicator = () => {
      setIndicator({
        left: selectedLink.offsetLeft,
        width: selectedLink.offsetWidth,
        ready: true,
      });
    };

    updateIndicator();
    selectedLink.scrollIntoView({ block: "nearest", inline: "center", behavior: "auto" });
    const observer = new ResizeObserver(updateIndicator);
    observer.observe(selectedLink);
    if (selectedLink.parentElement) observer.observe(selectedLink.parentElement);
    return () => observer.disconnect();
  }, [selected]);

  return (
    <nav aria-label={ariaLabel} className="scroll-cue overflow-x-auto">
      <div className="relative flex min-w-max gap-1">
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute inset-y-0 left-0 rounded-xl bg-mecg-navy shadow-[0_7px_18px_rgba(7,13,31,0.18)] transition-[transform,width,opacity] duration-[--t-detent] ease-[--ease-detent] ${indicator.ready ? "opacity-100" : "opacity-0"}`}
          style={{ transform: `translateX(${indicator.left}px)`, width: `${indicator.width}px` }}
        />
        {links.map(([href, label]) => {
          const isSelected = selected === href;
          return (
            <Link
              key={href}
              ref={(node) => {
                if (node) linkRefs.current.set(href, node);
                else linkRefs.current.delete(href);
              }}
              href={href}
              onNavigate={() => setPending({ from: current, href })}
              aria-current={current === href ? "page" : undefined}
              className={`relative inline-flex min-h-11 items-center rounded-xl px-3.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] transition-[color,scale,background-color] duration-[--t-detent] ease-[--ease-detent] active:scale-[0.96] ${
                isSelected
                  ? "text-white"
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
