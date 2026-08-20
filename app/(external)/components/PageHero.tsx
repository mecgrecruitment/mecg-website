import type { ReactNode } from "react";

type PageHeroProps = {
  eyebrow?: string;
  title: ReactNode;
  description: string;
  children?: ReactNode;
  tone?: "blue" | "orange" | "mixed";
  compact?: boolean;
};

export function PageHero({
  eyebrow,
  title,
  description,
  children,
  tone = "mixed",
  compact = false,
}: PageHeroProps) {
  return (
    <section
      className={`page-hero relative isolate overflow-hidden border-b border-white/10 px-5 md:px-8 ${
        compact ? "pb-14 pt-32 md:pb-20 md:pt-40" : "flex min-h-[58svh] items-end pb-16 pt-36 md:pb-24 md:pt-44"
      }`}
    >
      <div className={`page-hero-glow page-hero-glow--${tone}`} aria-hidden="true" />
      <div className="container relative z-10">
        {eyebrow ? <p className="text-sm font-semibold text-[var(--orange-soft)]" data-reveal>{eyebrow}</p> : null}
        <h1 className="font-display max-w-5xl text-5xl font-semibold tracking-[-0.045em] text-white md:text-7xl" data-split>
          {title}
        </h1>
        <div className="mt-7 grid max-w-5xl gap-8 md:grid-cols-[1fr_auto] md:items-end">
          <p className="max-w-3xl text-lg leading-relaxed text-white/62 md:text-xl" data-reveal>
            {description}
          </p>
          {children ? <div data-reveal>{children}</div> : null}
        </div>
      </div>
    </section>
  );
}
