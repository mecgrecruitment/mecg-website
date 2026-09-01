import Link from "next/link";
import type { PublicProjectCard } from "@/lib/projects/public-types";

export default function ProjectCard({ project }: { readonly project: PublicProjectCard }) {
  return (
    <Link href={`/work/${project.slug}`} className="group flex h-full flex-col rounded-2xl bg-white p-5 shadow-[0_16px_40px_rgba(7,13,31,0.07)] transition-shadow duration-150 hover:shadow-[0_16px_40px_rgba(7,13,31,0.14)] sm:p-6">
      <div className="flex items-center justify-between gap-4 font-mono text-[0.65rem] uppercase tracking-[0.14em] text-mecg-navy/60">
        <span>{project.industry}</span>
        <span>{project.semester}</span>
      </div>
      <p className="mt-6 text-sm font-medium text-mecg-orange-ink">{project.clientLabel}</p>
      <h3 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">{project.title}</h3>
      <p className="mt-4 flex-1 leading-7 text-mecg-navy/60">{project.decision}</p>
      <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-mecg-blue">
        Read the case <span className="transition-transform duration-150 group-hover:translate-x-1" aria-hidden="true">→</span>
      </span>
    </Link>
  );
}
