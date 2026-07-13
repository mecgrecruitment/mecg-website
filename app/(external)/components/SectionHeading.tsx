import type { ReactNode } from "react";

export function SectionHeading({
  eyebrow,
  title,
  description,
  inverted = false,
}: {
  eyebrow: string;
  title: ReactNode;
  description?: string;
  inverted?: boolean;
}) {
  return (
    <div className="section-heading">
      <p
        className={`annotation ${inverted ? "!text-[var(--orange-dark)]" : "annotation-accent"}`}
        data-reveal
      >
        {eyebrow}
      </p>
      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.4fr)] lg:items-end">
        <h2
          className={`display text-5xl uppercase md:text-7xl ${
            inverted ? "text-[var(--navy-950)]" : "text-white"
          }`}
          data-split
        >
          {title}
        </h2>
        {description ? (
          <p
            className={`max-w-xl text-base leading-relaxed lg:justify-self-end ${
              inverted ? "text-[var(--on-paper-muted)]" : "text-white/58"
            }`}
            data-reveal
          >
            {description}
          </p>
        ) : null}
      </div>
    </div>
  );
}

