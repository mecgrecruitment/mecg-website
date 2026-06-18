import Image from "next/image";
import carouselData from "@/lib/home-carousel.json";

type CarouselImage = {
  src: string;
  alt: string;
};

const images = (carouselData.images || []) as CarouselImage[];
const loopImages = [...images, ...images];

function rotationClass(index: number) {
  const options = [
    "-rotate-[2deg]",
    "rotate-[1.5deg]",
    "-rotate-[1deg]",
    "rotate-[2deg]",
    "rotate-0",
  ];

  return options[index % options.length];
}

function sizeClass(index: number) {
  const options = [
    "h-48 w-72 md:h-56 md:w-88",
    "h-44 w-64 md:h-52 md:w-80",
    "h-52 w-72 md:h-60 md:w-96",
    "h-44 w-72 md:h-52 md:w-84",
  ];

  return options[index % options.length];
}

export function HomePhotoStrip() {
  if (images.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-7xl overflow-hidden rounded-[1.6rem] border border-white/10 bg-[#122033]/75 px-0 py-7 shadow-[0_22px_70px_rgba(4,12,24,0.24)]">
      <div className="mx-auto mb-5 max-w-3xl px-6 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--orange-soft)]">
          Life at MECG
        </p>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-white/55">
          A look at the people, projects, and moments that make up our community.
        </p>
      </div>

      <div className="relative overflow-hidden py-4">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-[#122033] to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-[#122033] to-transparent" />

        <div className="flex w-max animate-mecg-photo-strip items-center gap-5 px-8">
          {loopImages.map((image, index) => (
            <figure
              key={`${image.src}-${index}`}
              className={`${sizeClass(index)} ${rotationClass(index)} group relative shrink-0 overflow-hidden rounded-[1.25rem] border border-white/12 bg-white/[0.06] p-2 shadow-[0_18px_45px_rgba(0,0,0,0.22)] transition duration-300 hover:z-20 hover:rotate-0 hover:scale-[1.025]`}
            >
              <div className="relative h-full w-full overflow-hidden rounded-[0.95rem]">
                <Image
                  src={image.src}
                  alt={image.alt}
                  fill
                  sizes="(min-width: 768px) 384px, 288px"
                  className="object-cover transition duration-500 group-hover:scale-[1.04]"
                />
              </div>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
