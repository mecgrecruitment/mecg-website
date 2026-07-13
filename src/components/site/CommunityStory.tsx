"use client";

import Image from "next/image";
import { useState } from "react";

type StoryFrame = {
  src: string;
  alt: string;
  label: string;
  title: string;
  description: string;
  position?: string;
};

export function CommunityStory({ frames }: { frames: StoryFrame[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeFrame = frames[activeIndex];

  if (!activeFrame) return null;

  const selectRelativeFrame = (offset: number) => {
    setActiveIndex((current) => (current + offset + frames.length) % frames.length);
  };

  return (
    <section
      className="community-story"
      aria-labelledby="community-story-title"
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") selectRelativeFrame(-1);
        if (event.key === "ArrowRight") selectRelativeFrame(1);
      }}
    >
      <div className="community-story-copy">
        <p className="annotation annotation-accent">Fig. 04 — Inside MECG</p>
        <h2
          id="community-story-title"
          className="display mt-6 max-w-3xl text-balance text-4xl uppercase text-white md:text-5xl lg:text-[3.4rem]"
        >
          The work matters. The people make it last.
        </h2>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/58">
          MECG is a consulting organization and a campus community—built through
          project teams, shared experiences, mentorship, and time together.
        </p>

        <div className="community-story-status" aria-live="polite" aria-atomic="true">
          <p className="annotation text-white/38">{activeFrame.label}</p>
          <p className="font-display mt-3 text-3xl font-bold uppercase tracking-[-0.05em] text-white md:text-4xl">
            {activeFrame.title}
          </p>
          <p className="mt-3 max-w-lg leading-7 text-white/55">{activeFrame.description}</p>
        </div>

        <div className="community-story-controls">
          <button
            type="button"
            className="community-story-arrow focus-ring"
            onClick={() => selectRelativeFrame(-1)}
            aria-label="Show previous community moment"
          >
            <span aria-hidden="true">←</span>
          </button>
          <p className="font-mono text-sm font-bold text-white/48">
            {String(activeIndex + 1).padStart(2, "0")} / {String(frames.length).padStart(2, "0")}
          </p>
          <button
            type="button"
            className="community-story-arrow focus-ring"
            onClick={() => selectRelativeFrame(1)}
            aria-label="Show next community moment"
          >
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>

      <div className="community-story-visual">
        <div className="community-story-image-wrap">
          <Image
            key={activeFrame.src}
            src={activeFrame.src}
            alt={activeFrame.alt}
            fill
            sizes="(min-width: 1024px) 56vw, 100vw"
            className="community-story-image"
            style={{ objectPosition: activeFrame.position ?? "center" }}
          />
          <div className="community-story-image-wash" aria-hidden="true" />
          <p className="community-story-figure" aria-hidden="true">
            MECG / {String(activeIndex + 1).padStart(2, "0")}
          </p>
        </div>

        <div className="community-story-thumbs" aria-label="Choose a community moment">
          {frames.map((frame, index) => (
            <button
              type="button"
              key={frame.src}
              className="community-story-thumb focus-ring"
              data-active={index === activeIndex}
              onClick={() => setActiveIndex(index)}
              aria-label={`Show ${frame.title}`}
              aria-pressed={index === activeIndex}
            >
              <Image
                src={frame.src}
                alt=""
                fill
                sizes="(min-width: 768px) 128px, 22vw"
                className="object-cover"
                style={{ objectPosition: frame.position ?? "center" }}
              />
              <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
