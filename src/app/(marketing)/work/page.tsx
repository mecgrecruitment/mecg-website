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
import { CLIENT_FAQS, ENGAGEMENT_STEPS, PAST_PROJECTS, SERVICES, STATS } from "@/lib/site-content";

export const revalidate = 60;

export const metadata: Metadata = MARKETING_METADATA.work;

const BREADCRUMB_JSON_LD = marketingBreadcrumbs([
  { name: "Home", path: "/home" },
  { name: "Client Services", path: "/work" },
]);

const ORGANIZATIONS = STATS.find((stat) => stat.label === "Organizations")!;

// Each figure restates a CLIENT_FAQS answer, except the organization count, which home's STATS owns.
const FIGURES = [
  ["$0", "consulting fee"],
  ["1", "academic semester"],
  ["6–8", "Michigan students"],
  [ORGANIZATIONS.value, "organizations since 2023"],
  ["1 week", "to hear back"],
] as const;

function questionHref(service: (typeof SERVICES)[number]) {
  return `/contact?subject=${encodeURIComponent(`${service.title} project inquiry`)}&question=${encodeURIComponent(service.question)}#message`;
}

export default async function WorkPage() {
  const publicProjects = await listPublicProjectCards();

  return (
    <main id="main-content" className="bg-white text-mecg-navy">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(BREADCRUMB_JSON_LD) }} />
      <PageIntro
        label="Client services"
        title="Bring us a decision. We’ll spend a semester on it."
        copy="A team of six to eight University of Michigan students researches your question, checks its thinking with your people and hands over a recommendation you can act on."
      >
        <Link href="/contact#message" className="button-primary">Discuss a project <span aria-hidden="true">→</span></Link>
        <Link href="#capabilities" className="inline-flex min-h-11 items-center gap-2 text-[15px] font-semibold text-mecg-blue">See example questions <span aria-hidden="true">↓</span></Link>
      </PageIntro>

      <section aria-label="MECG at a glance" className="bg-linear-to-b from-public-ground from-30% to-white to-30% px-6 sm:px-10">
        <figure className="relative mx-auto max-w-6xl">
          <div className="relative aspect-[4/3] overflow-hidden rounded-xl sm:aspect-[2/1]">
            <Image src="/mecg/chapter-presentation-2026.jpeg" alt="MECG members presenting together at a formal chapter event" fill preload sizes="(min-width:1152px) 1152px, 100vw" className="object-cover object-[50%_35%]" />
          </div>
          <figcaption className="mt-3 text-[13px] text-muted sm:absolute sm:right-4 sm:top-4 sm:mt-0 sm:rounded-md sm:bg-white/90 sm:px-2.5 sm:py-1">Members at a chapter presentation, 2026</figcaption>
          <dl className="public-lit relative mt-4 grid grid-cols-2 gap-x-6 gap-y-6 rounded-xl p-6 shadow-lift sm:mx-8 sm:-mt-16 sm:grid-cols-3 sm:p-8 lg:grid-cols-5">
            {FIGURES.map(([figure, label]) => (
              <div key={label} className="flex flex-col-reverse justify-end last:col-span-2 sm:last:col-span-1">
                <dt className="mt-2 text-[13px] text-white">{label}</dt>
                <dd className="display-face whitespace-nowrap text-[40px] leading-none sm:text-[clamp(36px,4.4vw,56px)]">{figure}</dd>
              </div>
            ))}
          </dl>
        </figure>
      </section>

      <MarketingSection aria-labelledby="clients-title" className="pt-24! sm:pt-32!">
        <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr] lg:items-end lg:gap-16">
          <h2 id="clients-title" className="display-face text-balance text-[clamp(40px,6vw,76px)] leading-[1.02]">From General Motors to a Midland medical spa.</h2>
          <p className="max-w-sm text-[17px] leading-7 text-muted">An automaker, a distillery, a school, a nonprofit, a law practice and more have brought us their questions.</p>
        </div>
        {publicProjects.length > 0 ? (
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {publicProjects.map((project) => <ProjectCard key={project.slug} project={project} />)}
          </div>
        ) : null}
        <div className="mt-10">
          <ClientProjectGrid projects={PAST_PROJECTS} />
        </div>
      </MarketingSection>

      <MarketingSection id="capabilities" tone="paper" className="scroll-mt-24" aria-labelledby="capabilities-title">
        <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr] lg:items-end lg:gap-16">
          <SectionHeading id="capabilities-title">Questions clients bring us</SectionHeading>
          <p className="max-w-sm text-[15px] leading-6 text-muted">Examples, not past client work. Pick the closest and we’ll start the conversation there.</p>
        </div>
        <ol className="mt-10 border-t border-public-rule">
          {SERVICES.map((service) => (
            <li key={service.title} className="border-b border-public-rule">
              <Link href={questionHref(service)} className="group grid gap-2 py-7 md:grid-cols-[0.55fr_1.45fr] md:gap-10">
                <span>
                  <span className="block text-[15px] font-semibold text-mecg-blue">{service.title}</span>
                  <span className="mt-2 block max-w-xs text-[15px] leading-6 text-muted">{service.body}</span>
                </span>
                <span className="display-face flex items-start justify-between gap-6 text-balance text-[28px] leading-[1.05] sm:text-[44px]">
                  {service.question}
                  <span aria-hidden="true" className="mt-1 shrink-0 text-mecg-blue transition-transform duration-150 group-hover:translate-x-1.5">→</span>
                </span>
              </Link>
            </li>
          ))}
          <li className="border-b border-public-rule">
            <Link href="/contact#message" className="group grid gap-2 py-7 md:grid-cols-[0.55fr_1.45fr] md:gap-10">
              <span className="text-[15px] font-semibold text-mecg-blue">Something else</span>
              <span className="display-face flex items-start justify-between gap-6 text-balance text-[28px] leading-[1.05] text-mecg-blue sm:text-[44px]">
                Tell us your question anyway
                <span aria-hidden="true" className="mt-1 shrink-0 transition-transform duration-150 group-hover:translate-x-1.5">→</span>
              </span>
            </Link>
          </li>
        </ol>
      </MarketingSection>

      <MarketingSection aria-labelledby="engagement-title">
        <SectionHeading id="engagement-title">How an engagement works</SectionHeading>
        <ol className="mt-10 grid border-t border-mecg-navy sm:grid-cols-2 lg:grid-cols-4">
          {ENGAGEMENT_STEPS.map(([number, title, body, result]) => (
            <li key={title} className="flex flex-col border-b border-public-rule py-6 sm:row-span-4 sm:grid sm:grid-rows-subgrid sm:pr-8 lg:border-b-0">
              <span className="display-face text-[40px] leading-none text-mecg-blue">{number}</span>
              <h3 className="mt-4 text-xl font-semibold">{title}</h3>
              <p className="mt-3 leading-7 text-muted">{body}</p>
              <p className="pt-5 text-[15px] leading-6"><span className="text-muted">You get: </span><span className="font-semibold">{result}</span></p>
            </li>
          ))}
        </ol>
      </MarketingSection>

      <MarketingSection aria-labelledby="client-questions" innerClassName="grid gap-8 lg:grid-cols-[0.78fr_1.22fr]">
        <SectionHeading id="client-questions">A few practical questions.</SectionHeading>
        <div className="divide-y divide-line border-y border-line">
          {CLIENT_FAQS.map(([question, answer]) => (
            <details key={question} className="group py-4">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-6 font-semibold"><span>{question}</span><span aria-hidden="true" className="text-xl text-mecg-blue group-open:rotate-45">+</span></summary>
              <p className="pb-2 pt-3 leading-7 text-muted">{answer}</p>
            </details>
          ))}
        </div>
      </MarketingSection>

      <section aria-labelledby="closing-title" className="px-6 pb-20 sm:px-10 sm:pb-28">
        <div className="public-lit mx-auto grid max-w-6xl gap-8 rounded-xl p-8 shadow-lift sm:p-12 lg:grid-cols-[1.4fr_0.6fr] lg:items-end">
          <div>
            <h2 id="closing-title" className="display-face text-balance text-[clamp(36px,5vw,64px)] leading-[1.02]">Have a decision coming up next semester?</h2>
            <p className="mt-4 max-w-xl text-[17px] leading-7 text-white">Tell us what you’re deciding and by when. The board replies within one week.</p>
          </div>
          <Link href="/contact#message" className="button-primary justify-self-start lg:justify-self-end">Discuss a project <span aria-hidden="true">→</span></Link>
        </div>
      </section>
    </main>
  );
}
