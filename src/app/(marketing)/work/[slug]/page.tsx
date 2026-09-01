import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import MarketingSection from "@/components/marketing-section";
import PageIntro from "@/components/page-intro";
import SectionHeading from "@/components/section-heading";
import SectionLabel from "@/components/section-label";
import { getPublicProject, getPublicProjectSlugs } from "@/lib/projects/public-projects";

type ProjectPageProps = {
  readonly params: Promise<{ slug: string }>;
};

export const dynamicParams = false;

export function generateStaticParams() {
  return getPublicProjectSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: ProjectPageProps): Promise<Metadata> {
  const { slug } = await params;
  const project = getPublicProject(slug);

  // dynamicParams = false + generateStaticParams above means an unknown slug
  // 404s before this ever runs, but this branch stays defensive rather than
  // reading fields off an undefined project.
  if (!project) return {};

  return {
    title: project.title,
    description: project.decision,
    alternates: { canonical: `/work/${slug}` },
    openGraph: {
      title: project.title,
      description: project.decision,
      url: `/work/${slug}`,
      images: [`/work/${slug}/opengraph-image`],
    },
    twitter: {
      title: project.title,
      description: project.decision,
      images: [`/work/${slug}/opengraph-image`],
    },
  };
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { slug } = await params;
  const project = getPublicProject(slug);

  if (!project) notFound();

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://mecgmichigan.com/home" },
      { "@type": "ListItem", position: 2, name: "Client Services", item: "https://mecgmichigan.com/work" },
      { "@type": "ListItem", position: 3, name: project.title, item: `https://mecgmichigan.com/work/${slug}` },
    ],
  };

  return (
    <main id="main-content" className="bg-white text-mecg-navy">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <PageIntro
       
        label={`${project.industry} · ${project.semester}`}
        title={project.title}
        copy={project.decision}
      >
        <p className="font-mono text-xs uppercase tracking-[0.14em] text-white/55">{project.clientLabel}</p>
      </PageIntro>

      <MarketingSection aria-labelledby="context-title" innerClassName="grid gap-8 lg:grid-cols-[0.7fr_1.3fr]">
          <div>
            <SectionLabel>Context</SectionLabel>
            <SectionHeading id="context-title" className="mt-4">The decision came first.</SectionHeading>
          </div>
          <div>
            <p className="text-xl leading-8 text-mecg-navy/72">{project.context}</p>
            {project.constraints.length > 0 ? (
              <ul className="mt-7 divide-y divide-mecg-navy/10 border-y border-mecg-navy/10">
                {project.constraints.map((constraint) => <li key={constraint} className="py-4 leading-7 text-mecg-navy/60">{constraint}</li>)}
              </ul>
            ) : null}
          </div>
      </MarketingSection>

      <MarketingSection tone="softBlue" aria-labelledby="work-title">
          <SectionLabel>How the team worked</SectionLabel>
          <SectionHeading id="work-title" className="mt-4 max-w-2xl">What the team did to answer it.</SectionHeading>
          <ol className="mt-8 grid gap-4 md:grid-cols-2">
            {project.methods.map((method, index) => (
              <li key={method} className="rounded-2xl bg-white p-6 shadow-[0_12px_30px_rgba(7,13,31,0.06)]">
                <span className="font-mono text-xs text-mecg-orange-ink">0{index + 1}</span>
                <p className="mt-5 leading-7 text-mecg-navy/70">{method}</p>
              </li>
            ))}
          </ol>
      </MarketingSection>

      <MarketingSection aria-labelledby="deliverables-title" innerClassName="grid gap-8 lg:grid-cols-[0.7fr_1.3fr]">
          <div>
            <SectionLabel>The handoff</SectionLabel>
            <SectionHeading id="deliverables-title" className="mt-4">What MECG delivered.</SectionHeading>
          </div>
          <div>
            <ul className="divide-y divide-mecg-navy/10 border-y border-mecg-navy/10">
              {project.deliverables.map((deliverable) => <li key={deliverable} className="flex gap-3 py-5 leading-7 text-mecg-navy/65"><span className="text-mecg-orange-ink" aria-hidden="true">→</span><span>{deliverable}</span></li>)}
            </ul>
            {project.handoff ? <p className="mt-7 text-lg leading-8 text-mecg-navy/72">{project.handoff}</p> : null}
          </div>
      </MarketingSection>

      <MarketingSection tone="navy" aria-labelledby="member-work-title" innerClassName="grid gap-8 lg:grid-cols-[0.7fr_1.3fr]">
          <div>
            <SectionLabel className="text-mecg-orange">Member ownership</SectionLabel>
            <SectionHeading id="member-work-title" className="mt-4">The work students owned.</SectionHeading>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {project.memberWork.map((item) => <li key={item} className="rounded-2xl bg-white/[0.06] p-5 leading-7 text-white/68">{item}</li>)}
          </ul>
      </MarketingSection>

      <MarketingSection spacing="compact" innerClassName="flex flex-wrap items-center justify-between gap-5">
          <Link href="/work" className="font-semibold text-mecg-blue">← Back to client work</Link>
          <Link href="/join" className="button-primary">Explore recruitment <span aria-hidden="true">→</span></Link>
      </MarketingSection>
    </main>
  );
}
