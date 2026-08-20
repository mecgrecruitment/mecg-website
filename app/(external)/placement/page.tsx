import type { Metadata } from "next";
import { PageHero } from "../components/PageHero";

const title = "Placement";
const description =
  "Consent-backed MECG placement highlights are not published yet. For recruitment timing, use Prospective Members.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/placement" },
  openGraph: { title, description },
};

export default function PlacementPage() {
  return (
    <main>
      <PageHero
        eyebrow="Sheet 09 — Coming soon"
        title={
          <>
            Placement.
            <br /> <span className="text-ghost">Publishing soon.</span>
          </>
        }
        description="Internships and full-time paths will appear here only with member consent. No unverified employers or invented stats."
        tone="mixed"
      >
        <a
          href="/prospective-members"
          data-magnetic
          className="button-primary focus-ring"
        >
          Prospective members
        </a>
      </PageHero>

      <section className="section pt-0">
        <div className="container max-w-3xl">
          <p className="annotation annotation-accent">Status</p>
          <h2 className="display mt-5 text-4xl uppercase text-white md:text-5xl">
            Placeholder only.
          </h2>
          <p className="mt-6 text-lg leading-8 text-white/58">
            Until this page ships, see Prospective Members for recruitment
            timing and the permissioned alumni employer collage.
          </p>
        </div>
      </section>
    </main>
  );
}
