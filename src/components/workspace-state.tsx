import Link from "@/components/workspace-link";

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
    <main className="flex min-h-dvh items-center justify-center bg-paper px-6 py-12 text-mecg-navy">
      <section className="surface-card w-full max-w-xl bg-white p-7 sm:p-9">
        <p className="eyebrow text-mecg-orange-ink">Workspace interrupted</p>
        <h1 className="mt-3 text-balance text-3xl font-semibold tracking-[-0.035em]">{title}</h1>
        <p className="mt-3 text-pretty leading-7 text-muted">{description}</p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <button type="button" onClick={retry} className="button-primary">Try again</button>
          <Link href={backHref} className="button-secondary">{backLabel}</Link>
        </div>
      </section>
    </main>
  );
}
