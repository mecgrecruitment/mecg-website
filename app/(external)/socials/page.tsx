import React from "react";
import { socials } from "@/lib/site-content";

export const metadata = {
  title: "Socials — MECG",
  description: "Follow MECG and explore the community.",
};

export default function SocialsPage() {
  return (
    <main>
      <section className="grid-bg relative overflow-hidden px-5 pb-16 pt-36 md:px-8 md:pb-24 md:pt-44">
        <div className="orb right-[-10rem] top-[-12rem] h-[30rem] w-[30rem] bg-[var(--blue)]" />
        <div className="container relative">
          <p className="annotation annotation-accent" data-reveal>
            Sheet 06 — Community
          </p>
          <h1 className="display-xl mt-6 w-6xl text-white" data-split>
            Follow the <span className="text-ghost">community.</span>
          </h1>
          <p className="mt-8 max-w-3xl text-xl leading-relaxed text-white/62" data-reveal>
            Keep up with recruitment updates, community events, member highlights, and MECG news.
          </p>
          <div className="dim-rule mt-12" data-reveal />
        </div>
      </section>

      <section className="section">
        <div className="container">
          <p className="annotation annotation-accent" data-reveal>
            Fig. 06.1 — Social Channels
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-3" data-reveal-group>
            {socials.map((social) => (
              <a
                key={social.title}
                href={social.href}
                target={social.href.startsWith("http") ? "_blank" : undefined}
                rel={social.href.startsWith("http") ? "noreferrer" : undefined}
                className="panel card-hover rounded-[35rem] p-7"
                data-reveal
              >
                <p className="annotation annotation-accent">MECG</p>
                <h2 className="font-display mt-8 text-4xl font-bold uppercase leading-none tracking-[-0.04em] text-white">
                  {social.title}
                </h2>
                <p className="mt-5 leading-relaxed text-white/56">{social.body}</p>
                <p className="annotation mt-8">Open ↗</p>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 pb-24 md:px-8">
        <div className="container">
          <div className="sheet rounded-[2rem] p-8 md:p-12" data-reveal="wipe">
            <p className="annotation !text-[var(--orange-dark)]">Photo wall</p>
            <h2 className="font-display mt-4 text-3xl font-bold uppercase tracking-[-0.05em] text-[var(--navy-950)] md:text-5xl">
              Add social and event photos here later.
            </h2>

            <div className="mt-10 grid gap-4d:grid-cols-3">
              {["Social Photo 01", "Social Photo 02", "Social Photo 03"].map((label) => (
                <div
                  key={label}
                  className="grid aspect-[4/3] place-items-center rounded-[1rem] border border-dashed border-[var(--paper-rule)] font-mono text-xs font-bold uppercase tracking-[0.16em] text-[var(--on-paper-muted)]"
                >
                  {label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
