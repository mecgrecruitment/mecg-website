import type { Metadata } from "next";
import { MARKETING_METADATA, marketingBreadcrumbs } from "@/lib/seo";
import Image from "next/image";
import Link from "next/link";
import ClientProjectGrid from "@/components/client-project-grid";
import MarketingSection from "@/components/marketing-section";
import PageIntro from "@/components/page-intro";
import ProjectCard from "@/components/project-card";
import SectionHeading from "@/components/section-heading";
import { listPublicProjectCards } from "@/lib/projects/public-projects";
import { serializeJsonLd } from "@/lib/json-ld";
import { CLIENT_FAQS, ENGAGEMENT_STEPS, PAST_PROJECTS, SERVICES } from "@/lib/site-content";

export const revalidate = 60;

export const metadata: Metadata = MARKETING_METADATA.work;

const BREADCRUMB_JSON_LD = marketingBreadcrumbs([
  { name: "Home", path: "/home" },
  { name: "Client Services", path: "/work" },
]);

function CapabilityRow({ service }: { service: (typeof SERVICES)[number] }) {
  return (
    <li className="grid gap-2 border-b border-public-rule py-7 md:grid-cols-[0.55fr_1.45fr] md:gap-10">
      <div>
        <h3 className="text-[15px] font-semibold text-mecg-blue">{service.title}</h3>
        <p className="mt-2 max-w-xs text-[15px] leading-6 text-public-muted">{service.body}</p>
      </div>
      <p className="display-face mt-3 text-balance text-[28px] leading-[1.05] sm:text-[44px] md:mt-0"><span className="block text-[13px] font-normal tracking-normal text-public-muted">Example question</span>{service.question}</p>
    </li>
  );
}

export default async function WorkPage() {
  const publicProjects = await listPublicProjectCards();

  return (
    <main id="main-content" className="bg-white text-mecg-navy">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(BREADCRUMB_JSON_LD) }} />
      <PageIntro
        label="Client services"
        title="Pro bono projects for organizations with a decision to make."
        copy="A team of six to eight Michigan students spends one semester on a focused question, then hands over recommendations your organization can use."
        aside={
          <div className="public-lit rounded-2xl p-6 shadow-[0_28px_56px_-28px_rgb(18_33_62/0.6)] sm:p-7">
            <p className="text-[13px] text-white/80">Start with your question</p>
            <p className="display-face mt-2 text-balance text-[28px] leading-[1.02] sm:text-[40px]">What decision is your organization facing?</p>
            <Link href="/contact#message" className="button-light mt-6">Tell us about it <span aria-hidden="true">→</span></Link>
          </div>
        }
      >
        <Link href="/contact#message" className="button-primary">Discuss a project <span aria-hidden="true">→</span></Link>
        <Link href="#capabilities" className="inline-flex min-h-11 items-center gap-2 text-[15px] font-semibold text-mecg-blue">Where we can help <span aria-hidden="true">↓</span></Link>
      </PageIntro>

      <MarketingSection aria-labelledby="partners-title" className="pt-36! lg:pt-60!">
          <div className="relative [container-type:inline-size]">
            <h2 id="partners-title"><span className="poster-word text-public-ink" style={{ fontSize: "34cqi" }}>Clients</span></h2>
            <p data-wd-float className="public-lit absolute -top-[4cqi] right-[1cqi] flex size-[max(17cqi,72px)] flex-col justify-between rounded-2xl p-[max(2cqi,10px)] shadow-[0_28px_56px_-24px_rgb(18_33_62/0.6)]">
              <span className="display-face text-[max(8cqi,28px)] leading-none">30+</span>
              <span className="hidden text-[max(13px,1.3cqi)] leading-snug text-white/85 sm:block">organizations since our first cohort</span>
            </p>
          </div>
          <p className="mt-4 text-[17px] text-public-muted">30+ organizations we have worked with since 2023.</p>
          <ClientProjectGrid projects={PAST_PROJECTS} />
      </MarketingSection>

      <MarketingSection id="capabilities" className="scroll-mt-24" aria-labelledby="capabilities-title">
          <SectionHeading id="capabilities-title">Where we can help</SectionHeading>
          <p className="mt-4 max-w-2xl text-[17px] leading-7 text-public-muted">Each area starts from a question like these. They are examples, not past client work.</p>
          <ol className="mt-10 border-t border-public-rule">
            {SERVICES.slice(0, 2).map((service) => <CapabilityRow key={service.title} service={service} />)}
          </ol>
      </MarketingSection>

      <section className="px-6 sm:px-10" aria-label="An MECG presentation">
        <figure className="relative mx-auto max-w-6xl">
          <div className="relative aspect-[3/2] overflow-hidden rounded-2xl sm:aspect-[16/9]">
            <Image src="/mecg/chapter-presentation-2026.jpeg" alt="MECG members presenting together at a formal chapter event" fill sizes="(min-width:1152px) 1152px, 100vw" className="object-cover object-[50%_30%]" />
          </div>
          <figcaption className="relative mx-4 -mt-10 max-w-sm public-lit rounded-2xl p-5 shadow-[0_24px_48px_-24px_rgb(18_33_62/0.6)] sm:absolute sm:-bottom-10 sm:left-8 sm:mx-0 sm:mt-0 sm:p-6">
            <span className="block text-[13px] text-white/80">How every engagement ends</span>
            <span className="display-face mt-2 block text-[22px] leading-[1.1]">Every engagement ends with the team presenting its recommendation, its limits and the next steps.</span>
            <span className="mt-3 block text-[13px] text-white/80">Pictured: members at a chapter presentation.</span>
          </figcaption>
        </figure>
      </section>

      <MarketingSection aria-label="More areas" className="pt-24! sm:pt-28!">
          <ol className="border-t border-public-rule">
            {SERVICES.slice(2).map((service) => <CapabilityRow key={service.title} service={service} />)}
            <li className="grid gap-2 border-b border-public-rule py-7 md:grid-cols-[0.55fr_1.45fr] md:gap-10">
              <h3 className="text-[15px] font-semibold text-mecg-blue">Something else</h3>
              <Link href="/contact#message" className="display-face text-balance text-[28px] leading-[1.05] sm:text-[44px] text-mecg-blue underline-offset-8 hover:underline sm:text-[40px]">Tell us your question anyway <span aria-hidden="true">→</span></Link>
            </li>
          </ol>
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
              <p className="mt-5 max-w-sm text-[17px] leading-7 text-public-muted">Pro bono, one academic semester, a team of six to eight, and an NDA when you need one.</p>
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

      <MarketingSection aria-labelledby="client-questions" innerClassName="grid gap-8 lg:grid-cols-[0.78fr_1.22fr]">
        <div>
          <SectionHeading id="client-questions">A few practical questions.</SectionHeading>
          <p className="mt-5 max-w-sm text-[17px] leading-7 text-public-muted">Didn’t see your question? Tell us about it.</p>
          <Link href="/contact#message" className="button-primary mt-6">Discuss a project <span aria-hidden="true">→</span></Link>
        </div>
        <div className="divide-y divide-mecg-navy/15 border-y border-mecg-navy/15">
          {CLIENT_FAQS.map(([question, answer]) => (
            <details key={question} className="group py-4">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-6 font-semibold"><span>{question}</span><span aria-hidden="true" className="text-xl text-mecg-blue group-open:rotate-45">+</span></summary>
              <p className="pb-2 pt-3 leading-7 text-mecg-navy/70">{answer}</p>
            </details>
          ))}
        </div>
      </MarketingSection>

    </main>
  );
}
