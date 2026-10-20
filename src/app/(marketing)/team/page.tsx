import type { Metadata } from "next";
import { MARKETING_METADATA } from "@/lib/seo";
import Image from "next/image";
import Link from "next/link";
import SectionHeading from "@/components/section-heading";
import { BOARD, STATS } from "@/lib/site-content";

export const metadata: Metadata = MARKETING_METADATA.team;

const MEMBERS = STATS.find((stat) => stat.label === "Members")?.value;

export default function TeamPage() {
  return (
    <main id="main-content" className="bg-white text-public-ink">
      <section className="bg-mecg-blue px-6 pb-[124px] pt-6 text-white sm:px-10 sm:pb-16" aria-labelledby="team-title">
        <div className="mx-auto max-w-6xl [container-type:inline-size]">
          <p className="flex items-center justify-between gap-4 border-b border-white/20 pb-3 text-[13px] text-white/85"><span>Executive Board, 2026</span><span className="flex items-center gap-4"><span className="hidden sm:inline">{MEMBERS} members · every major</span><Link href="/join" className="button-primary">Join MECG <span aria-hidden="true">→</span></Link></span></p>
          <h1 id="team-title" className="mt-10 sm:mt-14"><span className="poster-word text-mecg-orange" style={{ fontSize: "27cqi" }}>Our Team</span></h1>
        </div>
      </section>

      <section className="px-6 pb-16 sm:px-10 sm:pb-20" aria-label="Executive Board">
        <div className="mx-auto -mt-28 grid max-w-6xl grid-cols-2 gap-x-4 gap-y-8 sm:-mt-36 sm:grid-cols-3 lg:grid-cols-5">
          {BOARD.map(({ name, role, src, objectPosition, linkedin }, index) => (
            <article key={name}>
              <a href={linkedin} target="_blank" rel="noreferrer" aria-label={`${name}, ${role}, on LinkedIn, opens in a new tab`} className="group block rounded-2xl">
                <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-mecg-blue/[0.08] shadow-[0_20px_40px_-24px_rgb(18_33_62/0.6)]">
                  <Image src={src} alt="" fill loading={index < 5 ? "eager" : "lazy"} className="object-cover object-top transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transition-none" style={{ objectPosition }} sizes="(min-width:1152px) 202px, (min-width:1024px) calc((100vw - 144px) / 5), (min-width:640px) calc((100vw - 112px) / 3), calc((100vw - 64px) / 2)" />
                </div>
                <h2 className="mt-4 text-lg font-semibold tracking-[-0.02em]">{name}</h2>
                <p className="mt-1 text-[15px] text-public-muted">{role}</p>
                <p className="mt-2 text-[13px] font-semibold text-mecg-blue">LinkedIn <span aria-hidden="true">↗</span></p>
              </a>
            </article>
          ))}
        </div>
        <div className="mx-auto mt-14 grid max-w-6xl gap-6 border-t border-public-rule pt-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <p className="max-w-2xl text-[17px] leading-7 text-public-muted">{BOARD.length} students run MECG’s board. Behind them are {MEMBERS} members from every major, working on client teams each semester.</p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link href="/join" className="button-primary">Join MECG <span aria-hidden="true">→</span></Link>
            <Link href="/contact#message" className="inline-flex min-h-11 items-center gap-2 text-[15px] font-semibold text-mecg-blue underline-offset-4 hover:underline">Discuss a project <span aria-hidden="true">→</span></Link>
          </div>
        </div>
      </section>

      <section className="bg-public-ground px-6 py-16 sm:px-10 sm:py-20" aria-labelledby="chapter-title">
        <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
          <figure>
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl">
              <Image src="/mecg/formal-group-2026.jpeg" alt="MECG members together at a formal chapter event" fill sizes="(min-width:1024px) 600px, 100vw" className="object-cover" />
            </div>
            <figcaption className="mt-3 text-[13px] text-public-muted">At a chapter formal, 2026.</figcaption>
          </figure>
          <div>
            <SectionHeading id="chapter-title">The rest of the chapter.</SectionHeading>
            <p className="mt-5 text-[17px] leading-7 text-public-muted">Members build consulting skills through education sessions, mentorship and client work. There’s also a chapter to be part of, from professional trips to time together around Ann Arbor.</p>
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
              <Link href="/join" className="button-primary">See how to join <span aria-hidden="true">→</span></Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
