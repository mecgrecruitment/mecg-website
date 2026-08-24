import type { ReactNode } from "react";
import SectionLabel from "@/components/section-label";

export default function PageIntro({
  number,
  label,
  title,
  copy,
  children,
  titleId,
}: {
  number: string;
  label: string;
  title: string;
  copy: string;
  children?: ReactNode;
  titleId?: string;
}) {
  return (
    <section className="bg-mecg-navy text-white">
      <div className="mx-auto max-w-6xl px-6 py-14 sm:py-18">
        <SectionLabel number={number} className="text-mecg-orange">
          {label}
        </SectionLabel>
        <h1 id={titleId} className="mt-5 max-w-4xl text-balance text-4xl font-semibold tracking-tight sm:text-6xl">
          {title}
        </h1>
        <p className="mt-5 max-w-2xl text-pretty text-lg leading-8 text-white/60">
          {copy}
        </p>
        {children ? <div className="mt-8">{children}</div> : null}
      </div>
    </section>
  );
}
