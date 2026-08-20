import type { ReactNode } from "react";

export function SectionHeading({
  eyebrow,
  title,
  description,
  inverted = false,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: string;
  inverted?: boolean;
}) {
  return (
    <div className="section-heading">
      {eyebrow ? <p className={`text-sm font-semibold ${inverted ? "text-[var(--orange-dark)]" : "text-[var(--orange-soft)]"}`} data-reveal>{eyebrow}</p> : null}
      <div className={`${eyebrow ? "mt-4" : ""} grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.45fr)] lg:items-end`}>
        <h2
          className={`font-display text-4xl font-semibold tracking-[-0.04em] md:text-6xl ${
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
