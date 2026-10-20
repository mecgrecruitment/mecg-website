
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
    <header className="workspace-page-header">
      <a href="#workspace-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-white focus:px-4 focus:py-2">Skip to workspace content</a>
      <div>
        <p className="workspace-page-context">{eyebrow}</p>
        <h1>{title}</h1>
        {description && <p className="workspace-page-description">{description}</p>}
      </div>
      {action && <div className="workspace-page-actions">{action}</div>}
    </header>
  );
}
