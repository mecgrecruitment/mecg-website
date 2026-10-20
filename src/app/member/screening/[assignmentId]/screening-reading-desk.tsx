"use client";

import { createContext, useCallback, useContext, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";

type ReviewView = "read" | "score";
const ReviewViewContext = createContext<{ view: ReviewView; revealScore: () => void } | null>(null);
export function useScreeningScoreView() { return useContext(ReviewViewContext); }

export default function ScreeningReadingDesk({ reader, scorer }: { reader: ReactNode; scorer: ReactNode }) {
  const [view, setView] = useState<ReviewView>("read");
  const id = useId();
  const reviewRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const readingPosition = useRef(0);
  const revealScore = useCallback(() => {
    readingPosition.current = window.scrollY;
    setView("score");
  }, []);
  const context = useMemo(() => ({ view, revealScore }), [view, revealScore]);
  useLayoutEffect(() => {
    if (view === "score" && window.matchMedia("(max-width: 1023px)").matches) {
      reviewRef.current?.scrollIntoView({ block: "start", behavior: "instant" });
    }
  }, [view]);
  function returnToReading() {
    setView("read");
    toggleRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: readingPosition.current, behavior: "instant" });
  }
  return (
    <ReviewViewContext.Provider value={context}>
      <div className="reading-mobile-toolbar">
        <span>Application &amp; private review</span>
        <button ref={toggleRef} type="button" aria-expanded={view === "score"} aria-controls={`${id}-review`} onClick={() => {
          if (view === "score") returnToReading();
          else { revealScore(); requestAnimationFrame(() => reviewRef.current?.focus()); }
        }}>{view === "score" ? "Return to reading" : "Your review"}</button>
      </div>
      <div className="application-reading-layout">
        <div className="min-w-0">{reader}</div>
        <aside ref={reviewRef} id={`${id}-review`} tabIndex={-1} aria-label="Your private review" className={`application-review-rail ${view === "score" ? "review-is-open" : ""}`}>
          {scorer}
          <button type="button" className="button-secondary mt-4 lg:hidden" onClick={returnToReading}>Return to reading</button>
        </aside>
      </div>
    </ReviewViewContext.Provider>
  );
}
