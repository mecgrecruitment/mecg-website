import Image from "next/image";

type Photo = { src: string; alt: string };

// Looping marquee of candid photos. Track is the photo list duplicated once so
// a -50% translateX loops seamlessly (animate-mecg-photo-strip, globals.css);
// reduced-motion is handled globally there, not per-component.
export function PhotoStrip({ photos }: { photos: Photo[] }) {
  if (photos.length === 0) return null;
  const loop = [...photos, ...photos];

  return (
    <section className="mx-auto w-full max-w-7xl overflow-hidden rounded-[1.6rem] border border-white/10 bg-[#122033]/75 py-7 shadow-[0_22px_70px_rgba(4,12,24,0.24)]">
      <div className="relative overflow-hidden py-4">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-[#122033] to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-[#122033] to-transparent" />

        <div className="flex w-max animate-mecg-photo-strip items-center gap-5 px-8 hover:[animation-play-state:paused]">
          {loop.map((photo, index) => (
            <figure
              key={`${photo.src}-${index}`}
              className="relative h-48 w-72 shrink-0 overflow-hidden rounded-[1.25rem] border border-white/12 bg-white/[0.06] p-2 shadow-[0_18px_45px_rgba(0,0,0,0.22)] transition duration-300 hover:z-20 hover:scale-[1.025] md:h-56 md:w-88"
            >
              <div className="relative h-full w-full overflow-hidden rounded-[0.95rem]">
                <Image
                  src={photo.src}
                  alt={photo.alt}
                  fill
                  sizes="(min-width: 768px) 352px, 288px"
                  className="object-cover"
                />
              </div>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
