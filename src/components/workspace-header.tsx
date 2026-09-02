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
    <header className="workspace-hero relative flex flex-wrap items-end justify-between overflow-hidden rounded-[28px] bg-mecg-navy text-white">
      <a href="#workspace-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:font-semibold focus:text-mecg-navy focus:shadow-lg">
        Skip to workspace content
      </a>
      <div className="workspace-hero-orbit" aria-hidden="true" />
      <div className="relative max-w-3xl">
        <div className="flex items-center gap-3">
          <span className="h-2 w-2 rounded-full bg-mecg-orange shadow-[0_0_0_5px_rgba(254,144,77,0.12)]" aria-hidden="true" />
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-mecg-orange">{eyebrow}</p>
        </div>
        <h1 className="mt-4 text-balance text-[2rem] font-semibold leading-[1.02] tracking-[-0.045em] sm:text-[2.65rem]">{title}</h1>
        {description && <p className="mt-3 max-w-2xl text-pretty text-[14px] leading-6 text-white/62 sm:text-[15px]">{description}</p>}
      </div>
      <div className="relative flex min-h-11 items-center gap-3 rounded-full bg-white/[0.07] p-1.5 pl-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)] backdrop-blur-sm">
        {action}
        <LogoutButton />
      </div>
    </header>
  );
}
