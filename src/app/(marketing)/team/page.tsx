import type { Metadata } from "next";
import Image from "next/image";
import MarketingSection from "@/components/marketing-section";
import PageIntro from "@/components/page-intro";
import SectionHeading from "@/components/section-heading";
import { BOARD } from "@/lib/site-content";

const TITLE = "Our Team";
const DESCRIPTION = "Meet the Michigan Engineering Consulting Group executive board.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/team" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/team" },
  twitter: { title: TITLE, description: DESCRIPTION },
};

export default function TeamPage() {
  return (
    <main id="main-content" className="bg-white text-mecg-navy">
      <PageIntro title="Our Team" />

      <MarketingSection>
          <SectionHeading>Executive Board</SectionHeading>
          <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-5">
            {BOARD.map(({ name, role, src, objectPosition, linkedin }, index) => (
              <article key={name}>
                <a href={linkedin} target="_blank" rel="noreferrer" aria-label={`${name} on LinkedIn, opens in a new tab`} className="group block">
                  <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-mecg-blue/[0.08]">
                    <Image src={src} alt="" fill priority={index === 0} loading={index === 0 ? "eager" : "lazy"} className="object-cover object-top transition-transform duration-300 group-hover:scale-[1.02]" style={{ objectPosition }} sizes="(min-width:1024px) 25vw, (min-width:640px) 33vw, 50vw" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold tracking-[-0.02em]">{name}</h3>
                  <p className="mt-1 text-sm text-mecg-navy/60">{role}</p>
                </a>
              </article>
            ))}
          </div>
      </MarketingSection>
    </main>
  );
}
