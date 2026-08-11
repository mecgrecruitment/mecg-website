export function PortalLoading({ label = "Loading workspace" }: { label?: string }) {
  return (
    <div className="grid gap-7" role="status" aria-live="polite" aria-label={label}>
      <span className="sr-only">{label}</span>
      <section className="panel-strong animate-pulse rounded-[2rem] p-7 md:p-10">
        <div className="h-3 w-24 rounded-full bg-[var(--orange)]/45" />
        <div className="mt-7 h-12 w-full max-w-2xl rounded-xl bg-white/10 md:h-16" />
        <div className="mt-5 h-4 w-full max-w-xl rounded-full bg-white/[0.07]" />
      </section>

      <section className="grid gap-5 md:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="panel animate-pulse rounded-[1.5rem] p-6">
            <div className="h-3 w-20 rounded-full bg-white/10" />
            <div className="mt-6 h-9 w-32 rounded-lg bg-white/10" />
            <div className="mt-4 h-3 w-full rounded-full bg-white/[0.06]" />
          </div>
        ))}
      </section>
    </div>
  );
}
