"use client";

import { useRef, useState } from "react";
import EngineeringScene from "@/components/engineering-scene";
import { PROJECTS } from "@/lib/site-content";

export default function ProjectCarousel() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  function goTo(index: number) {
    const next = Math.max(0, Math.min(PROJECTS.length - 1, index));
    const track = trackRef.current;
    track?.scrollTo({ left: next * track.clientWidth });
    setActive(next);
  }

  function updateActive() {
    const track = trackRef.current;
    if (!track) return;
    const index = Math.round(track.scrollLeft / track.clientWidth);
    setActive(Math.max(0, Math.min(PROJECTS.length - 1, index)));
  }

  return (
    <div>
      <div ref={trackRef} onScroll={updateActive} className="project-track flex snap-x snap-mandatory overflow-x-auto rounded-[2rem] bg-mecg-navy shadow-[0_24px_70px_rgba(7,13,31,0.15)]" aria-label="Case study concepts">
        {PROJECTS.map((project, projectIndex) => (
          <article key={project.number} className="grid min-w-full snap-start text-white lg:grid-cols-[1.15fr_0.85fr]">
            <div className={`relative min-h-72 overflow-hidden bg-gradient-to-br ${project.tone} p-7 sm:p-9 lg:min-h-[28rem]`}>
              <div className="project-grid absolute inset-0" aria-hidden="true" />
              {active === projectIndex ? (
                <EngineeringScene
                  variant="project"
                  projectIndex={projectIndex}
                  className="absolute inset-x-0 top-8 h-52 sm:h-72 lg:top-10 lg:h-80"
                />
              ) : null}
              <div className="relative flex h-full flex-col justify-between">
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-white/60">Case study / {project.number}</p>
                <div>
                  <p className="font-mono text-xs uppercase tracking-[0.18em] text-mecg-orange">{project.eyebrow}</p>
                  <h3 className="mt-4 max-w-xl text-balance text-3xl font-medium tracking-[-0.03em] sm:text-5xl">{project.title}</h3>
                </div>
              </div>
            </div>
            <div className="flex flex-col justify-between border-t border-white/10 p-7 sm:p-9 lg:border-l lg:border-t-0">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-white/45">Content direction</p>
                <div className="mt-6 divide-y divide-white/10 border-y border-white/10">
                  {project.details.map(([label, copy], index) => (
                    <div key={label} className="grid gap-2 py-4 sm:grid-cols-[2.25rem_7rem_1fr] sm:gap-4">
                      <span className="font-mono text-xs text-mecg-orange">0{index + 1}</span>
                      <span className="font-medium">{label}</span>
                      <span className="text-sm leading-6 text-white/55">{copy}</span>
                    </div>
                  ))}
                </div>
              </div>
              <p className="mt-7 text-sm leading-6 text-white/50">{project.summary}</p>
            </div>
          </article>
        ))}
      </div>
      <div className="mt-6 flex items-center justify-between gap-5">
        <div className="flex gap-2" aria-label={`Slide ${active + 1} of ${PROJECTS.length}`}>
          {PROJECTS.map((project, index) => (
            <button key={project.number} type="button" onClick={() => goTo(index)} aria-label={`Show slide ${index + 1}`} aria-current={active === index} className={`h-2.5 rounded-full transition-[width,background-color] ${active === index ? "w-9 bg-mecg-orange" : "w-2.5 bg-mecg-navy/20 hover:bg-mecg-navy/40"}`} />
          ))}
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => goTo(active - 1)} disabled={active === 0} aria-label="Previous case study" className="carousel-button">←</button>
          <button type="button" onClick={() => goTo(active + 1)} disabled={active === PROJECTS.length - 1} aria-label="Next case study" className="carousel-button">→</button>
        </div>
      </div>
    </div>
  );
}
