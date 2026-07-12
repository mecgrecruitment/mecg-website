export type TimelineItem = {
  id: string;
  index: string;
  title: string;
  meta?: string;
  body: string;
};

export function Timeline({
  items,
  variant,
}: {
  items: TimelineItem[];
  variant: "scroll" | "static";
}) {
  if (variant === "static") {
    return (
      <div className="grid gap-10 md:grid-cols-4" data-reveal-group>
        {items.map((item) => (
          <article key={item.id} className="relative" data-reveal>
            <span className="timeline-node-dot timeline-node--active mb-5 inline-block" aria-hidden="true" />
            <p className="font-mono text-sm font-bold text-[var(--orange-dark)]">
              {item.index}
            </p>
            <h3 className="font-display mt-4 text-2xl font-bold uppercase tracking-[-0.04em] text-[var(--navy-950)]">
              {item.title}
            </h3>
            <p className="mt-4 leading-relaxed text-[var(--on-paper-muted)]">
              {item.body}
            </p>
          </article>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[2px_1fr] gap-7" data-timeline>
      <div className="relative" data-timeline-track>
        <div className="timeline-marker" data-timeline-marker aria-hidden="true" />
      </div>

      <ol className="grid gap-8" data-reveal-group>
        {items.map((item) => (
          <li key={item.id} data-timeline-node data-reveal>
            <details className="group">
              <summary className="flex cursor-pointer list-none flex-wrap items-baseline gap-3">
                <span className="timeline-node-dot" aria-hidden="true" />
                <span className="font-mono text-sm font-bold text-[var(--orange-dark)]">
                  {item.index}
                </span>
                <span className="font-display text-xl font-bold uppercase tracking-[-0.03em] text-[var(--navy-950)] md:text-2xl">
                  {item.title}
                </span>
              </summary>
              {item.meta ? (
                <p className="mt-2 pl-[1.6rem] text-sm font-bold uppercase tracking-[0.12em] text-[var(--on-paper-muted)]">
                  {item.meta}
                </p>
              ) : null}
              <p className="mt-3 pl-[1.6rem] leading-relaxed text-[var(--on-paper-muted)]">
                {item.body}
              </p>
            </details>
          </li>
        ))}
      </ol>
    </div>
  );
}
