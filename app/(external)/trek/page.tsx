import React from "react";
import type { Metadata } from "next";
import { contact } from "@/lib/site-content";

const title = "Trek";
const description =
  "Every year MECG travels to meet companies and alumni where they work. Stops, photos, and member takeaways from the trek are being assembled — follow along in the meantime.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/trek" },
  openGraph: { title, description },
};

export default function TrekPage() {
  return (
    <main>
      <section className="grid-bg relative flex min-h-svh flex-col justify-center overflow-hidden px-5 py-32 md:px-8">
        <div className="orb left-[-12rem] top-[-10rem] h-[30rem] w-[30rem] bg-[var(--blue)]" />
        <div className="orb bottom-[-12rem] right-[-10rem] h-[26rem] w-[26rem] bg-[var(--orange-dark)]" />

        <div className="container relative">
          <p className="annotation annotation-accent" data-reveal>
            Sheet 08 — Trek · In drafting
          </p>
          <h1 className="display-xl mt-6 text-white" data-split>
            The road trip
            <br />
            {" "}
            <span className="text-ghost">is being drawn.</span>
          </h1>
          <p className="mt-8 max-w-2xl text-xl leading-relaxed text-white/62" data-reveal>
            Each year MECG travels to meet companies and alumni where they
            work. The full story of the trek — stops, photos, and what members
            took home — is being assembled for this page.
          </p>

          <div className="mt-12 grid max-w-2xl gap-px overflow-hidden rounded-[1rem] border border-white/12 bg-white/12 sm:grid-cols-3" data-reveal>
            {[
              ["Status", "Route in review"],
              ["Sheet", "No. 008 — Trek"],
              ["Revision", "A — Winter 2026"],
            ].map(([label, value]) => (
              <div key={label} className="bg-[var(--navy-950)] px-4 py-3">
                <p className="annotation text-[0.55rem]">{label}</p>
                <p className="mt-1 font-mono text-[0.7rem] font-bold uppercase tracking-[0.1em] text-white/65">
                  {value}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-10 flex flex-wrap gap-3" data-reveal>
            <a
              href={contact.instagram}
              target="_blank"
              rel="noreferrer"
              data-magnetic
              className="focus-ring rounded-full bg-[var(--orange)] px-7 py-4 font-mono text-xs font-bold uppercase tracking-[0.16em] text-white transition-colors hover:bg-white hover:text-[var(--navy-950)]"
            >
              Follow along
            </a>
            <a
              href="/contact"
              data-magnetic
              className="focus-ring rounded-full border border-white/16 px-7 py-4 font-mono text-xs font-bold uppercase tracking-[0.16em] text-white/75 transition-colors hover:border-white/40 hover:text-white"
            >
              Ask about trek
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
