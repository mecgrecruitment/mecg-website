import Image from "next/image";
import photoData from "@/lib/community-photos.json";

type CommunityPhoto = {
  src: string;
  alt: string;
};

const photos = (photoData.images || []) as CommunityPhoto[];

function pickPhotos(start: number, count: number) {
  if (photos.length === 0) return [];

  return Array.from({ length: Math.min(count, photos.length) }, (_, index) => {
    return photos[(start + index) % photos.length];
  });
}

export function CommunityPhotoStrip({
  title = "Life at MECG",
  subtitle = "A look at the people, projects, and moments that make up our community.",
  start = 0,
}: {
  title?: string;
  subtitle?: string;
  start?: number;
}) {
  const selected = pickPhotos(start, 10);
  const loop = [...selected, ...selected];

  if (selected.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-7xl overflow-hidden rounded-[1.6rem] border border-white/10 bg-[#122033]/75 py-7 shadow-[0_22px_70px_rgba(4,12,24,0.24)]">
      <div className="mx-auto mb-5 max-w-3xl px-6 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--orange-soft)]">
          {title}
        </p>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-white/55">
          {subtitle}
        </p>
      </div>

      <div className="relative overflow-x-auto overflow-y-hidden py-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
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

export function CommunityPhotoGrid({
  title = "Community, on and off campus.",
  subtitle = "MECG is built through projects, coffee chats, socials, firm visits, and the little moments in between.",
  start = 0,
  label = "Community",
}: {
  title?: string;
  subtitle?: string;
  start?: number;
  label?: string;
}) {
  const selected = pickPhotos(start, 6);

  if (selected.length === 0) return null;

  return (
    <section className="mx-auto grid w-full max-w-7xl gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <div className="rounded-[1.6rem] border border-white/10 bg-[#122033]/70 p-7 shadow-[0_22px_70px_rgba(4,12,24,0.24)] md:p-10">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--orange-soft)]">
          {label}
        </p>
        <h2 className="mt-4 max-w-xl text-balance text-4xl font-semibold leading-[1.04] tracking-[-0.05em] text-white md:text-5xl">
          {title}
        </h2>
        <p className="mt-5 max-w-xl text-sm leading-7 text-white/58 md:text-base">
          {subtitle}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {selected.map((photo, index) => (
          <div
            key={photo.src}
            className={`relative overflow-hidden rounded-[1.25rem] border border-white/10 bg-white/[0.04] shadow-[0_18px_45px_rgba(0,0,0,0.2)] ${
              index === 0 || index === 3 ? "min-h-[18rem]" : "min-h-[13rem]"
            }`}
          >
            <Image
              src={photo.src}
              alt={photo.alt}
              fill
              sizes="(min-width: 1024px) 28vw, 50vw"
              className="object-cover"
            />
          </div>
        ))}
      </div>
    </section>
  );
}

export function JoinCommunityPhotos() {
  const selected = pickPhotos(2, 5);

  if (selected.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-7xl rounded-[1.6rem] border border-white/10 bg-[#122033]/70 p-5 shadow-[0_22px_70px_rgba(4,12,24,0.24)] md:p-7">
      <div className="grid gap-4 md:grid-cols-5">
        {selected.map((photo, index) => (
          <div
            key={photo.src}
            className={`relative overflow-hidden rounded-[1.2rem] border border-white/10 bg-white/[0.04] ${
              index === 0 ? "min-h-[22rem] md:col-span-2" : "min-h-[10.5rem]"
            } ${index === 1 || index === 4 ? "md:row-span-1" : ""}`}
          >
            <Image
              src={photo.src}
              alt={photo.alt}
              fill
              sizes="(min-width: 768px) 24vw, 100vw"
              className="object-cover"
            />
          </div>
        ))}
      </div>
    </section>
  );
}
