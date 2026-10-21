"use client";

import Image from "next/image";
import { useRef, useState } from "react";

type CarouselImage = {
  src: string;
  alt: string;
  objectPosition?: string;
};

export default function PhotoCarousel({ images, label }: { images: readonly CarouselImage[]; label: string }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  function syncIndex() {
    const track = trackRef.current;
    if (!track) return;
    const slides = Array.from(track.children) as HTMLElement[];
    const nearest = slides.reduce((best, slide, slideIndex) => (
      Math.abs(slide.offsetLeft - track.scrollLeft) < Math.abs(slides[best].offsetLeft - track.scrollLeft) ? slideIndex : best
    ), 0);
    setIndex(nearest);
  }

  function move(direction: -1 | 1) {
    const track = trackRef.current;
    if (!track) return;
    const next = Math.min(Math.max(index + direction, 0), images.length - 1);
    const slide = track.children.item(next) as HTMLElement | null;
    slide?.scrollIntoView({ block: "nearest", inline: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    setIndex(next);
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-end gap-2">
        <p aria-live="polite" className="sr-only">{`Photo ${index + 1} of ${images.length}`}</p>
        <button type="button" disabled={index === 0} onClick={() => move(-1)} aria-label={`Previous ${label} photo`} className="grid size-11 place-items-center rounded-full border border-line text-xl text-mecg-navy hover:bg-mecg-blue/10 disabled:cursor-not-allowed disabled:opacity-35">←</button>
        <button type="button" disabled={index === images.length - 1} onClick={() => move(1)} aria-label={`Next ${label} photo`} className="grid size-11 place-items-center rounded-full border border-line text-xl text-mecg-navy hover:bg-mecg-blue/10 disabled:cursor-not-allowed disabled:opacity-35">→</button>
      </div>
      <div ref={trackRef} onScroll={syncIndex} className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4" aria-label={label} role="region">
        {images.map((photo, photoIndex) => (
          <div key={photo.src} className="image-outline relative aspect-[4/3] w-[82vw] max-w-xl shrink-0 snap-start overflow-hidden rounded-xl bg-mecg-blue/10 sm:w-[64vw] lg:w-[38rem]">
            <Image
              src={photo.src}
              alt={photo.alt}
              fill
              loading={photoIndex === 0 ? "eager" : "lazy"}
              sizes="(min-width: 1024px) 38rem, (min-width: 640px) 64vw, 82vw"
              className="object-cover"
              style={{ objectPosition: photo.objectPosition ?? "center" }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
