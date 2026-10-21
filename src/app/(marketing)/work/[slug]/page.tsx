import type { Metadata } from "next";
import { marketingMetadata, marketingBreadcrumbs } from "@/lib/seo";
import Link from "next/link";
import { notFound } from "next/navigation";
import MarketingSection from "@/components/marketing-section";
import PageIntro from "@/components/page-intro";
import SectionHeading from "@/components/section-heading";
import SectionLabel from "@/components/section-label";
import { getPublicProject } from "@/lib/projects/public-projects";
import { serializeJsonLd } from "@/lib/json-ld";

type ProjectPageProps = {
  readonly params: Promise<{ slug: string }>;
};

// Approved projects can be published or withdrawn after deployment.
// Resolve each request through the public release boundary instead of a build-time slug list.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: ProjectPageProps): Promise<Metadata> {
  const { slug } = await params;
  const project = await getPublicProject(slug);

  if (!project) notFound();

  return marketingMetadata({
    title: project.title,
    description: project.decision,
    path: `/work/${slug}`,
    image: null,
  });
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { slug } = await params;
  const project = await getPublicProject(slug);

  if (!project) notFound();

  const breadcrumbJsonLd = marketingBreadcrumbs([
    { name: "Home", path: "/home" },
    { name: "Client Services", path: "/work" },
    { name: project.title, path: `/work/${slug}` },
  ]);

  return (
    <main id="main-content" className="bg-white text-mecg-navy">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd) }} />
      <PageIntro
        label={`${project.industry} · ${project.semester}`}
        title={project.title}
        copy={`For ${project.clientLabel}`}
        aside={
          <div className="public-lit rounded-xl p-6 shadow-lift sm:p-7">
            <p className="text-[13px] text-white">The question we started from</p>
            <p className="display-face mt-2 text-balance text-[26px] leading-[1.05] sm:text-[36px]">{project.decision}</p>
          </div>
        }
      >
        <Link href="/contact#message" className="button-primary">Discuss a similar project <span aria-hidden="true">→</span></Link>
      </PageIntro>

      <MarketingSection aria-labelledby="context-title" className="pt-32! lg:pt-44!" innerClassName="grid gap-8 lg:grid-cols-[0.7fr_1.3fr]">
          <div>
            <SectionLabel>Context</SectionLabel>
            <SectionHeading id="context-title" className="mt-4">The decision came first.</SectionHeading>
          </div>
          <div>
            <p className="text-xl leading-8 text-muted">{project.context}</p>
            {project.constraints.length > 0 ? (
              <ul className="mt-7 divide-y divide-line border-y border-line">
                {project.constraints.map((constraint) => <li key={constraint} className="py-4 leading-7 text-muted">{constraint}</li>)}
              </ul>
            ) : null}
          </div>
      </MarketingSection>

      <MarketingSection tone="softBlue" aria-labelledby="work-title">
          <SectionLabel>How the team worked</SectionLabel>
          <SectionHeading id="work-title" className="mt-4 max-w-2xl">What the team did to answer it.</SectionHeading>
          <ol className="mt-8 grid gap-4 md:grid-cols-2">
            {project.methods.map((method, index) => (
              <li key={method} className="rounded-xl bg-white p-6 shadow-lift">
                <span className="text-[15px] font-semibold tabular-nums text-mecg-blue">0{index + 1}</span>
                <p className="mt-5 leading-7 text-muted">{method}</p>
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
            <ul className="divide-y divide-line border-y border-line">
              {project.deliverables.map((deliverable) => <li key={deliverable} className="flex gap-3 py-5 leading-7 text-muted"><span className="text-mecg-blue" aria-hidden="true">→</span><span>{deliverable}</span></li>)}
            </ul>
            {project.handoff ? <p className="mt-7 text-lg leading-8 text-muted">{project.handoff}</p> : null}
          </div>
      </MarketingSection>

      <MarketingSection tone="navy" aria-labelledby="member-work-title" innerClassName="grid gap-8 lg:grid-cols-[0.7fr_1.3fr]">
          <div>
            <SectionLabel dark>Member ownership</SectionLabel>
            <SectionHeading id="member-work-title" className="mt-4">The work students owned.</SectionHeading>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {project.memberWork.map((item) => <li key={item} className="rounded-xl bg-white/10 p-5 leading-7 text-white/70">{item}</li>)}
          </ul>
      </MarketingSection>

      <MarketingSection spacing="compact" innerClassName="flex flex-wrap items-center justify-between gap-5">
          <Link href="/work" className="font-semibold text-mecg-blue">← Back to client work</Link>
          <Link href="/contact#message" className="button-primary">Discuss a similar project <span aria-hidden="true">→</span></Link>
      </MarketingSection>
    </main>
  );
}
