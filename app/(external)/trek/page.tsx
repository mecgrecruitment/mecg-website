import type { Metadata } from "next";
import { contact } from "@/lib/site-content";
import { PageHero } from "../components/PageHero";

const title = "Trek";
const description =
  "MECG professional trek: office visits and alumni conversations. City, dates, and hosts publish when confirmed. Follow Instagram for updates.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/trek" },
  openGraph: { title, description },
};

export default function TrekPage() {
  return (
    <main>
      <PageHero
        eyebrow="Sheet 08 — Coming soon"
        title={
          <>
            Trek.
            <br /> <span className="text-ghost">Dates when confirmed.</span>
          </>
        }
        description="Professional travel weekend: firm visits and alumni conversations. No invented itinerary here."
        tone="mixed"
      >
        <a
          href={contact.instagram}
          target="_blank"
          rel="noreferrer"
          className="button-primary focus-ring"
        >
          Instagram updates
        </a>
      </PageHero>

      <section className="section pt-0">
        <div className="container max-w-3xl">
          <p className="annotation annotation-accent">Status</p>
          <h2 className="font-display mt-5 text-4xl font-bold uppercase tracking-[-0.06em] text-white md:text-5xl">
            Watch Instagram for the confirmed itinerary.
          </h2>
          <p className="mt-5 max-w-2xl leading-7 text-white/56">
            Partnership questions for a future trek go through Contact.
          </p>
        </div>
      </section>
    </main>
  );
}
