import type { ReactNode } from "react";

const REVIEW_SECTIONS = [
  ["interviews", "Interview evidence"],
  ["decision", "Decision & approvals"],
  ["messages", "Messages"],
  ["history", "Activity history"],
] as const;
type PanelKey = "evidence" | (typeof REVIEW_SECTIONS)[number][0];

/** Keep the source application visible and forms mounted while consulting evidence. */
export default function DossierTabs({ panels }: { panels: Record<PanelKey, ReactNode> }) {
  return (
    <div>
      <nav className="reading-mobile-toolbar" aria-label="Reading shortcuts">
        <a href="#board-application">Application</a><a href="#board-review-tools">Review &amp; decision</a>
      </nav>
      <div className="application-reading-layout board-reading-layout">
      <div id="board-application" className="min-w-0 scroll-mt-20">{panels.evidence}</div>
      <aside id="board-review-tools" className="application-review-rail board-review-rail" aria-label="Application review tools">
        <h2 className="text-lg font-semibold">Review &amp; decision</h2>
        <p className="mt-1 text-sm text-mecg-navy/65">Consult the evidence while keeping the application in view.</p>
        {REVIEW_SECTIONS.map(([key, label]) => (
          <details key={key} className="reading-tool-section" open={key === "interviews" || key === "decision"}>
            <summary>{label}</summary>
            <div className="reading-tool-content">{panels[key]}</div>
          </details>
        ))}
        <a className="inline-flex min-h-11 items-center text-sm font-semibold text-mecg-blue lg:hidden" href="#board-application">Return to application</a>
      </aside>
      </div>
    </div>
  );
}
