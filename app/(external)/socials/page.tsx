import Image from "next/image";
import type { Metadata } from "next";
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

const photos = [
  {
    src: "/images/community/community-56.jpg",
    alt: "Five MECG members gathered outdoors near campus",
    className: "md:col-span-2 md:row-span-2",
  },
  {
    src: "/images/community/community-28.jpg",
    alt: "Four MECG members dressed for a formal gathering",
    className: "md:col-span-1",
  },
  {
    src: "/images/community/community-44.jpg",
    alt: "MECG members gathered outdoors in Michigan colors",
    className: "md:col-span-1",
  },
  {
    src: "/images/community/community-60.jpg",
    alt: "Three MECG members spending time together indoors",
    className: "md:col-span-1",
  },
  {
    src: "/images/community/community-52.jpg",
    alt: "Two MECG members wearing club hoodies outdoors at night",
    className: "md:col-span-1",
  },
];

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

function SocialPhotoGrid() {
  return (
    <section className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#122033]/72 p-4 shadow-[0_22px_70px_rgba(4,12,24,0.24)] md:p-8">
      <div className="px-2 pb-8 md:px-0">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--orange-soft)]">
          Fig. 02 — In the wild
        </p>
        <h2 className="font-display mt-4 max-w-5xl text-6xl font-black uppercase leading-[0.86] tracking-[-0.08em] text-white md:text-8xl">
          Little moments,
          <br />
          <span className="text-transparent [-webkit-text-stroke:1px_rgba(255,255,255,0.35)]">
            Big community.
          </span>
        </h2>
      </div>

      <div className="grid auto-rows-[15rem] gap-3 md:grid-cols-4 md:auto-rows-[13rem]">
        {photos.map((photo) => (
          <figure key={photo.src} className={`group relative overflow-hidden rounded-[1.15rem] border border-white/10 bg-white/[0.04] ${photo.className}`}>
            <Image
              src={photo.src}
              alt={photo.alt}
              fill
              sizes="(min-width: 768px) 50vw, 100vw"
              className="object-cover transition duration-700 group-hover:scale-[1.025]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[rgba(5,13,24,0.4)] via-transparent to-transparent" aria-hidden="true" />
          </figure>
        ))}
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
        <SocialPhotoGrid />
      </section>
    </main>
  );
}
