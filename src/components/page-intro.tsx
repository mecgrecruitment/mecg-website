import type { ReactNode } from "react";
import SectionLabel from "@/components/section-label";

export default function PageIntro({
  label,
  title,
  copy,
  children,
  titleId,
}: {
  number?: string;
  label?: string;
  title: string;
  copy?: string;
  children?: ReactNode;
  titleId?: string;
}) {
  return (
    <section className="bg-mecg-navy text-white">
      <div className="mx-auto max-w-6xl px-6 py-10 sm:px-10 sm:py-14">
        {label ? (
          <SectionLabel number="" className="text-mecg-orange">
            {label}
          </SectionLabel>
        ) : null}
        <h1 id={titleId} className={`${label ? "mt-4" : ""} max-w-4xl text-balance text-3xl font-semibold leading-[1.02] tracking-[-0.045em] sm:text-5xl`}>
          {title}
        </h1>
        {copy ? <p className="mt-4 max-w-2xl text-pretty text-base leading-7 text-white/70">{copy}</p> : null}
        {children ? <div className="mt-6">{children}</div> : null}
      </div>
    </section>
  );
}
