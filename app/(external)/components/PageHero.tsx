import type { ReactNode } from "react";

type PageHeroProps = {
  eyebrow: string;
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
      className={`page-hero grid-bg relative isolate overflow-hidden px-5 md:px-8 ${
        compact ? "pb-16 pt-36 md:pb-24 md:pt-44" : "flex min-h-[78svh] items-end pb-20 pt-40 md:pb-28 md:pt-48"
      }`}
    >
      <div className={`page-hero-glow page-hero-glow--${tone}`} aria-hidden="true" />
      <div className="container relative z-10">
        <p className="annotation annotation-accent" data-reveal>
          {eyebrow}
        </p>
        <h1 className="display-xl mt-6 max-w-7xl text-white" data-split>
          {title}
        </h1>
        <div className="mt-8 grid max-w-5xl gap-8 border-t border-white/12 pt-7 md:grid-cols-[1fr_auto] md:items-end">
          <p className="max-w-3xl text-lg leading-relaxed text-white/62 md:text-xl" data-reveal>
            {description}
          </p>
          {children ? <div data-reveal>{children}</div> : null}
        </div>
      </div>
    </section>
  );
}

