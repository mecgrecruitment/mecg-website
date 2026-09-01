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
  // ponytail: index tracks button-driven navigation only, not manual touch/drag
  // scrolling; good enough for the "N of M" announcement this fixes.
  const [index, setIndex] = useState(0);

  function move(direction: -1 | 1) {
    const track = trackRef.current;
    if (!track) return;
    track.scrollBy({ left: direction * Math.min(track.clientWidth * 0.82, 720), behavior: "smooth" });
    setIndex((current) => Math.min(Math.max(current + direction, 0), images.length - 1));
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-end gap-2">
        <p aria-live="polite" className="sr-only">{`Photo ${index + 1} of ${images.length}`}</p>
        <button type="button" onClick={() => move(-1)} aria-label={`Previous ${label} photo`} className="grid size-11 place-items-center rounded-full border border-mecg-navy/15 text-xl text-mecg-navy hover:bg-mecg-blue/[0.08]">←</button>
        <button type="button" onClick={() => move(1)} aria-label={`Next ${label} photo`} className="grid size-11 place-items-center rounded-full border border-mecg-navy/15 text-xl text-mecg-navy hover:bg-mecg-blue/[0.08]">→</button>
      </div>
      <div ref={trackRef} className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4" aria-label={label}>
        {images.map((photo) => (
          <div key={photo.src} className="relative aspect-[4/3] w-[82vw] max-w-xl shrink-0 snap-start overflow-hidden rounded-2xl bg-mecg-blue/[0.08] sm:w-[64vw] lg:w-[38rem]">
            <Image
              src={photo.src}
              alt={photo.alt}
              fill
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
