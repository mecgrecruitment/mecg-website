import LogoutButton from "./logout-button";

// The same header block was hand-rolled on every workspace page, each with a
// slightly different arrangement and its own ad-hoc "back to the other app"
// button. One component instead, so the nav below it is the only way to move.
export default function WorkspaceHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-6">
      <a href="#workspace-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:font-semibold focus:text-mecg-navy focus:shadow-lg">
        Skip to workspace content
      </a>
      <div>
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-mecg-orange-ink">{eyebrow}</p>
        <h1 className="mt-2.5 text-3xl font-semibold tracking-[-0.03em] sm:text-[34px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-3xl text-[15px] text-mecg-navy/65">{description}</p>}
      </div>
      <div className="flex items-center gap-5">
        {action}
        <LogoutButton />
      </div>
    </header>
  );
}
