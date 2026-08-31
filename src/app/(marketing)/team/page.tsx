import type { Metadata } from "next";
import Image from "next/image";
import MarketingSection from "@/components/marketing-section";
import PageIntro from "@/components/page-intro";
import SectionHeading from "@/components/section-heading";
import { BOARD } from "@/lib/site-content";

export const metadata: Metadata = {
  title: "Our Team",
  description: "Meet the Michigan Engineering Consulting Group executive board.",
  alternates: { canonical: "/team" },
};

export default function TeamPage() {
  return (
    <main className="bg-white text-mecg-navy">
      <PageIntro title="Our Team" />

      <MarketingSection>
          <SectionHeading>Executive Board</SectionHeading>
          <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-5">
            {BOARD.map(({ name, role, src, imageClass, imagePosition, imageOrigin, linkedin }, index) => (
              <article key={name}>
                <a href={linkedin} target="_blank" rel="noreferrer" aria-label={`${name} on LinkedIn, opens in a new tab`} className="group block">
                  <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-mecg-blue/[0.08]">
                    <Image src={src} alt="" fill loading={index < 5 ? "eager" : "lazy"} style={{ objectPosition: imagePosition, transformOrigin: imageOrigin ?? imagePosition }} className={`object-cover transition duration-300 group-hover:brightness-[1.03] ${imageClass}`} sizes="(min-width:1024px) 25vw, (min-width:640px) 33vw, 50vw" />
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
