type PlaceholderPageProps = {
  title: string;
  path: string;
  zone: "external" | "internal" | "auth";
  params?: Record<string, string>;
};

export default function PlaceholderPage({
  title,
  path,
  zone,
  params,
}: PlaceholderPageProps) {
  const headingClass = zone === "external" ? "font-display" : "font-body";

  return (
    <main className="p-8">
      <p className="font-mono text-sm uppercase tracking-wide text-ink-muted">
        {zone} · placeholder
      </p>
      <h1 className={`${headingClass} mt-2 text-4xl font-bold`}>{title}</h1>
      <p className="font-mono mt-4 text-sm text-ink-muted">{path}</p>
      {params && Object.keys(params).length > 0 ? (
        <dl className="font-mono mt-6 space-y-2 text-sm">
          {Object.entries(params).map(([key, value]) => (
            <div key={key} className="flex gap-4">
              <dt className="text-ink-muted">{key}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </main>
  );
}
