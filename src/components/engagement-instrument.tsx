"use client";

import { useId, useState } from "react";
import { ENGAGEMENT_STEPS } from "@/lib/site-content";
import { STATION_SHIFT } from "@/lib/engagement-instrument-model";

type EngagementStep = (typeof ENGAGEMENT_STEPS)[number];

/** The art is generated offline with Anatomy; only the carriage transform is live. */
export default function EngagementInstrument() {
  const [selected, setSelected] = useState<EngagementStep>(ENGAGEMENT_STEPS[0]);
  const id = useId();
  const [expanded, setExpanded] = useState(false);
  const station = ENGAGEMENT_STEPS.indexOf(selected);

  return (
    <figure className="m-0 overflow-hidden border border-line bg-white text-mecg-navy" aria-label="Explore the four steps of a MECG engagement">
      <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-3 font-mono text-xs uppercase tracking-[0.12em]">
        <span className="text-mecg-orange-ink">Fig. 01</span>
        <span className="text-muted">The engagement bench</span>
      </div>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={`${id}-bench ${id}-readout`}
        onClick={() => setExpanded(!expanded)}
        className="flex min-h-14 w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-semibold lg:hidden"
      >
        <span>{expanded ? "Close the engagement bench" : "Explore the four steps"}</span>
        <span aria-hidden="true" className="text-lg font-normal">{expanded ? "−" : "+"}</span>
      </button>
      <div id={`${id}-bench`} className={expanded ? "block" : "hidden lg:block"}>
        <svg
          viewBox="50 40 510 300"
          className="block h-auto w-full bg-paper lg:max-h-56"
          role="img"
          aria-label={`A precision drafting bench with a question sheet and a movable inspection head. The head is at station ${selected[0]}: ${selected[1]}.`}
        >
          <image href="/images/engagement-instrument/bench.svg" width="600" height="370" />
          <g
            className="transition-transform duration-500 ease-[cubic-bezier(.22,.61,.36,1)] motion-reduce:transition-none"
            style={{ transform: `translate(${station * STATION_SHIFT.x}px, ${station * STATION_SHIFT.y}px)` }}
          >
            <image href="/images/engagement-instrument/head.svg" width="600" height="370" />
          </g>
        </svg>
        <div className="flex items-center justify-between gap-3 border-y border-line px-5 py-2.5 font-mono text-xs uppercase tracking-[0.1em] text-muted">
          <span>Select a station below</span>
          <span className="shrink-0 whitespace-nowrap tabular-nums">{selected[0]} / 04</span>
        </div>
        <div className="grid grid-cols-1 gap-px bg-mecg-navy/10 min-[380px]:grid-cols-2" role="group" aria-label="Engagement stations">
          {ENGAGEMENT_STEPS.map((step) => (
            <button
              type="button"
              key={step[0]}
              aria-pressed={selected === step}
              aria-controls={`${id}-readout`}
              onClick={() => setSelected(step)}
              className={`flex min-h-14 min-w-0 items-center gap-3 px-4 py-3 text-left text-xs leading-snug transition-colors duration-150 focus-visible:relative focus-visible:z-10 focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-mecg-navy ${selected === step ? "bg-white text-mecg-navy" : "bg-paper text-muted hover:bg-white/70"}`}
            >
              <span className={`font-mono text-xs tabular-nums ${selected === step ? "text-mecg-orange-ink" : "text-muted"}`}>{step[0]}</span>
              <span className={`min-w-0 break-words ${selected === step ? "font-semibold" : ""}`}>{step[1]}</span>
            </button>
          ))}
        </div>
      </div>
      <figcaption id={`${id}-readout`} className={`${expanded ? "grid" : "hidden lg:grid"} border-t border-line px-5 py-4`} aria-live="polite" aria-atomic="true">
        {ENGAGEMENT_STEPS.map((step) => (
          <div key={step[0]} aria-hidden={selected !== step} className={`col-start-1 row-start-1 ${selected !== step ? "invisible" : ""}`}>
            <p className="m-0 text-sm leading-relaxed text-muted">{step[2]}</p>
            <p className="mb-0 mt-3 text-xs leading-relaxed text-muted"><span className="font-semibold text-mecg-navy">What you leave with</span><br />{step[3]}</p>
          </div>
        ))}
      </figcaption>
    </figure>
  );
}
