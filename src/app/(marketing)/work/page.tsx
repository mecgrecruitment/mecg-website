import type { Metadata } from "next";
import Link from "next/link";
import ClientProjectGrid from "@/components/client-project-grid";
import MarketingSection from "@/components/marketing-section";
import PageIntro from "@/components/page-intro";
import ProjectCard from "@/components/project-card";
import SectionHeading from "@/components/section-heading";
import { listPublicProjectCards } from "@/lib/projects/public-projects";
import { ENGAGEMENT_STEPS, PAST_PROJECTS, SEMESTER_FACTS, SERVICES } from "@/lib/site-content";

const TITLE = "Client Services";
const DESCRIPTION = "Partner with MECG on a semester-long, pro-bono consulting engagement.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/work" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/work" },
  twitter: { title: TITLE, description: DESCRIPTION },
};

const BREADCRUMB_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://mecgmichigan.com/home" },
    { "@type": "ListItem", position: 2, name: "Client Services", item: "https://mecgmichigan.com/work" },
  ],
};

export default function WorkPage() {
  const publicProjects = listPublicProjectCards();

  return (
    <main id="main-content" className="bg-white text-mecg-navy">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMB_JSON_LD) }} />
      <PageIntro
        title="Client Services"
        copy="MECG partners with organizations on semester-long, pro-bono consulting engagements. Each project begins with a focused question and ends with recommendations the client can use."
      >
        <Link href="/contact#message" className="button-primary">Work with MECG <span aria-hidden="true">→</span></Link>
      </PageIntro>

      <MarketingSection>
          <SectionHeading>Organizations we have worked with</SectionHeading>
          <ClientProjectGrid projects={PAST_PROJECTS} />
      </MarketingSection>

      <MarketingSection tone="paper">
          <SectionHeading>Our services</SectionHeading>
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {SERVICES.map((service) => (
              <article key={service.title} className="rounded-2xl bg-white p-5 shadow-[0_12px_34px_rgba(7,13,31,0.06)] sm:p-6">
                <h3 className="text-xl font-semibold">{service.title}</h3>
                <p className="mt-3 leading-7 text-mecg-navy/65">{service.body}</p>
              </article>
            ))}
          </div>
      </MarketingSection>

      {publicProjects.length > 0 ? (
        <MarketingSection aria-labelledby="case-studies-title">
            <SectionHeading id="case-studies-title">Selected work</SectionHeading>
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {publicProjects.map((project) => <ProjectCard key={project.slug} project={project} />)}
            </div>
        </MarketingSection>
      ) : null}

      <MarketingSection innerClassName="grid gap-8 lg:grid-cols-[0.78fr_1.22fr]">
            <div>
              <SectionHeading>How an engagement works</SectionHeading>
              <dl className="mt-7 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-mecg-navy/10">
                {SEMESTER_FACTS.map(([term, value]) => (
                  <div key={term} className="bg-mecg-blue/[0.06] p-5">
                    <dt className="text-sm text-mecg-navy/60">{term}</dt>
                    <dd className="mt-1 font-semibold">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <ol className="divide-y divide-mecg-navy/10 border-y border-mecg-navy/10">
              {ENGAGEMENT_STEPS.map(([, title, body]) => (
                <li key={title} className="py-5">
                  <h3 className="text-xl font-semibold">{title}</h3>
                  <p className="mt-3 max-w-2xl leading-7 text-mecg-navy/65">{body}</p>
                </li>
              ))}
            </ol>
      </MarketingSection>

      <MarketingSection tone="blue" spacing="compact" innerClassName="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div>
            <SectionHeading>Have a project in mind?</SectionHeading>
            <p className="mt-3 max-w-2xl leading-7 text-white/75">Tell us about the question, timing, and people who will use the work.</p>
          </div>
          <Link href="/contact#message" className="button-light shrink-0">Contact us <span aria-hidden="true">→</span></Link>
      </MarketingSection>
    </main>
  );
}
