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
    <header className="workspace-hero relative flex flex-wrap items-center justify-between overflow-hidden rounded-2xl bg-mecg-navy text-white">
      <a href="#workspace-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:font-semibold focus:text-mecg-navy focus:shadow-lg">
        Skip to workspace content
      </a>
      <div className="relative max-w-3xl">
        <div className="flex items-center gap-2.5">
          <span className="h-1.5 w-1.5 rounded-full bg-mecg-orange" aria-hidden="true" />
          <p className="text-xs font-medium text-mecg-orange">{eyebrow}</p>
        </div>
        <h1 className="mt-2.5 text-balance text-[1.75rem] font-semibold leading-tight tracking-[-0.035em] sm:text-4xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-pretty text-sm leading-6 text-white/65">{description}</p>}
      </div>
      <div className="workspace-hero-actions relative flex min-h-11 items-center gap-2">
        {action}
        <LogoutButton />
      </div>
    </header>
  );
}
