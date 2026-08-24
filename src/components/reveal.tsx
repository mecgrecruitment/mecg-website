"use client";

import { useEffect, useRef } from "react";

export default function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    // Hide synchronously before observing so in-viewport content does not
    // render visible and then re-animate from opacity 0. `.pre-reveal` only
    // applies under prefers-reduced-motion: no-preference, and this runs
    // client-side only, so no-JS and reduced-motion users always see everything.
    node.classList.add("pre-reveal");
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          node.classList.remove("pre-reveal");
          node.classList.add("fade-up");
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={delay ? { animationDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
