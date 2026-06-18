import Image from "next/image";
import communityPhotos from "@/lib/community-photos.json";

const socials = [
  {
    title: "Instagram",
    body: "Recruitment reminders, event photos, member highlights, and a look at the community.",
    href: "https://www.instagram.com/mecg.umich/",
  },
  {
    title: "LinkedIn",
    body: "Project updates, professional news, and ways to stay connected with MECG.",
    href: "https://www.linkedin.com/company/michigan-engineering-consulting-group/",
  },
  {
    title: "Email",
    body: "Questions about recruitment, client work, partnerships, or anything else.",
    href: "mailto:mecg-board@umich.edu",
  },
];

type Photo = {
  src: string;
  alt: string;
};

const photos = ((communityPhotos.images || []) as Photo[]).slice(0, 12);
const loopingPhotos = [...photos, ...photos];

function SocialCard({
  title,
  body,
  href,
  index,
}: {
  title: string;
  body: string;
  href: string;
  index: number;
}) {
  return (
    <a
      href={href}
      target={href.startsWith("mailto:") ? undefined : "_blank"}
      rel={href.startsWith("mailto:") ? undefined : "noreferrer"}
      className="group rounded-[1.25rem] border border-white/10 bg-[#122033]/75 p-6 shadow-[0_18px_55px_rgba(4,12,24,0.24)] transition duration-300 hover:-translate-y-1 hover:border-[var(--orange)]/45 hover:bg-[#172941]/80 md:p-7"
    >
      <div className="mb-8 flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--orange-soft)]">
          MECG
        </p>
        <span className="grid h-9 w-9 place-items-center rounded-full border border-white/10 text-xs font-black text-white/45 group-hover:border-[var(--orange)]/50 group-hover:text-[var(--orange-soft)]">
          {String(index + 1).padStart(2, "0")}
        </span>
      </div>

      <h2 className="text-3xl font-semibold uppercase tracking-[-0.055em] text-white md:text-4xl">
        {title}
      </h2>

      <p className="mt-5 min-h-[4.5rem] text-sm leading-7 text-white/58 md:text-base">
        {body}
      </p>

      <p className="mt-8 text-xs font-bold uppercase tracking-[0.18em] text-white/42 transition group-hover:text-white">
        Open ↗
      </p>
    </a>
  );
}

function SocialPhotoRibbon() {
  if (photos.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#122033]/65 py-7 shadow-[0_22px_70px_rgba(4,12,24,0.24)]">
      <div className="mx-auto mb-5 max-w-3xl px-6 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--orange-soft)]">
          In the wild
        </p>
        <h2 className="mt-3 text-balance text-4xl font-semibold leading-[1.03] tracking-[-0.055em] text-white md:text-5xl">
          Little moments, big community.
        </h2>
      </div>

      <div className="relative overflow-hidden py-3">
        <div className="pointer-events-none absolute inset-y-0 ft-0 z-10 w-24 bg-gradient-to-r from-[#122033] to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-[#122033] to-transparent" />

        <div className="flex w-max animate-mecg-photo-strip items-center gap-4 px-8">
          {loopingPhotos.map((photo, index) => (
            <figure
              key={`${photo.src}-${index}`}
              className={`relative shrink-0 overflow-hidden rounded-[1.15rem] border border-white/10 bg-white/[0.04] p-2 shadow-[0_16px_40px_rgba(0,0,0,0.22)] ${
                index % 3 === 0
                  ? "h-64 w-48"
                  : index % 3 === 1
                    ? "h-48 w-72"
                    : "h-56 w-56"
              }`}
            >
              <div className="relative h-full w-full overflow-hidden rounded-[0.85rem]">
                <Image
                  src={photo.src}
                  alt={photo.alt}
                  fill
                  sizes="320px"
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

export default function SocialsPage() {
  return (
    <div className="mx-auto grid w-full max-w-7xl gap-12 px-4 pb-12 pt-10 md:pt-16">
      <section className="mx-auto max-w-4xl text-center">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--orange-soft)]">
          Socials
        </p>
        <h1 className="mx-auto mt-5 max-w-3xl text-balance text-5xl font-semibold leading-[1.02] tracking-[-0.055em] text-white md:text-7xl">
          Stay connected with MECG.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-balance text-base leading-7 text-white/58">
          Follow along for recruitment updates, community photos, member highlights, and project news.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {socials.map((social, index) => (
          <SocialCard key={social.title} {...social} index={index} />
        ))}
      </section>

      <SocialPhotoRibbon />
    </div>
  );
}
