import Link from "next/link";

export function WorkspaceLoading({ label = "Loading workspace" }: { label?: string }) {
  return (
    <main className="mx-auto min-h-dvh max-w-7xl px-6 py-10 sm:px-10" aria-busy="true" aria-label={label}>
      <div className="h-3 w-32 animate-pulse rounded-full bg-mecg-orange/30 motion-reduce:animate-none" />
      <div className="mt-4 h-10 max-w-md animate-pulse rounded-xl bg-mecg-navy/10 motion-reduce:animate-none" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-32 animate-pulse rounded-2xl bg-mecg-navy/[0.06] motion-reduce:animate-none" />
        ))}
      </div>
      <p className="sr-only" role="status">{label}…</p>
    </main>
  );
}

export function WorkspaceError({
  title = "This workspace could not be loaded.",
  description = "The problem may be temporary. Try loading the page again.",
  retry,
  backHref = "/home",
  backLabel = "Back to site",
}: {
  title?: string;
  description?: string;
  retry: () => void;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#f5f4ef] px-6 py-12 text-mecg-navy">
      <section className="w-full max-w-xl rounded-[28px] bg-white p-7 shadow-[0_24px_80px_rgba(7,13,31,0.09),inset_0_0_0_1px_rgba(7,13,31,0.05)] sm:p-9">
        <p className="eyebrow text-mecg-orange-ink">Workspace interrupted</p>
        <h1 className="mt-3 text-balance text-3xl font-semibold tracking-[-0.035em]">{title}</h1>
        <p className="mt-3 text-pretty leading-7 text-mecg-navy/60">{description}</p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <button type="button" onClick={retry} className="button-primary">Try again</button>
          <Link href={backHref} className="button-secondary">{backLabel}</Link>
        </div>
      </section>
    </main>
  );
}
