import Image from "next/image";
import type { Metadata } from "next";
import communityPhotos from "@/lib/community-photos.json";
import { contact } from "@/lib/site-content";
import { PageHero } from "../components/PageHero";

const title = "Socials";
const description =
  "Stay connected with MECG on Instagram, LinkedIn, and email for recruitment updates, community photos, member highlights, and project news.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/socials" },
  openGraph: { title, description },
};

const socials = [
  {
    title: "Instagram",
    body: "Recruitment reminders, event photos, member highlights, and a look at the community.",
    href: contact.instagram,
  },
  {
    title: "LinkedIn",
    body: "Project updates, professional news, and ways to stay connected with MECG.",
    href: contact.linkedin,
  },
  {
    title: "Email",
    body: "Questions about recruitment, client work, partnerships, or anything else.",
    href: `mailto:${contact.email}`,
  },
];

type Photo = {
  src: string;
  alt: string;
};

const photos = ((communityPhotos.images || []) as Photo[]).slice(0, 18);
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
    >
      <article className="h-full rounded-[1.5rem] border border-white/10 bg-[#122033]/72 p-7 shadow-[0_22px_70px_rgba(4,12,24,0.24)] transition duration-300 hover:-translate-y-1 hover:border-[var(--orange)]/45">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--orange-soft)]">
          0{index + 1} — MECG
        </p>
        <h2 className="font-display mt-8 text-5xl font-black uppercase leading-[0.86] tracking-[-0.08em] text-white">
          {title}
        </h2>
        <p className="mt-6 text-base leading-7 text-white/58">{body}</p>
        <p className="mt-10 text-xs font-black uppercase tracking-[0.18em] text-white/45">
          Open ↗
        </p>
      </article>
    </a>
  );
}

function SocialPhotoRibbon() {
  if (photos.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#122033]/72 py-8 shadow-[0_22px_70px_rgba(4,12,24,0.24)]">
      <div className="px-6">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--orange-soft)]">
          In the wild
        </p>
        <h2 className="font-display mt-4 max-w-5xl text-6xl font-black uppercase leading-[0.86] tracking-[-0.08em] text-white md:text-8xl">
          Little moments,
          <br />
          <span className="text-transparent [-webkit-text-stroke:1px_rgba(255,255,255,0.35)]">
            Big community.
          </span>
        </h2>
      </div>

      <div className="relative mt-10 overflow-hidden py-3">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-[#122033] to-transparent" />
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
    <main className="grid gap-16 pb-16">
      <PageHero
        eyebrow="Sheet 06 — Socials"
        title={<>Stay<br />{" "}<span className="text-ghost">connected.</span></>}
        description="Follow along for recruitment updates, community photos, member highlights, and project news."
        tone="orange"
      />

      <section className="mx-auto w-full max-w-7xl px-6 md:px-16">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--orange-soft)]">
          Fig. 01 Social Channels
        </p>
        <h2 className="font-display mt-5 max-w-5xl text-6xl font-black uppercase leading-[0.86] tracking-[-0.08em] text-white md:text-8xl">
          Open a channel.
        </h2>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {socials.map((social, index) => (
            <SocialCard key={social.title} {...social} index={index} />
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-6 md:px-16">
        <SocialPhotoRibbon />
      </section>
    </main>
  );
}
