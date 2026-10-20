import type { ReactNode } from "react";

export default function PageIntro({
  label,
  title,
  copy,
  children,
  titleId,
  overlap = false,
  tone = "paper",
  aside,
  poster = false,
  posterMedia,
}: {
  label?: string;
  title: string;
  copy?: string;
  children?: ReactNode;
  titleId?: string;
  /** Leaves room for the next section's card to cross the intro's lower edge. */
  overlap?: boolean;
  tone?: "paper" | "blue";
  /** A floating object that crosses into the next section; that section needs matching top padding. */
  aside?: ReactNode;
  /** Set the title as the page's one poster word, sized to fill the column. */
  poster?: boolean;
  /** An image dropped onto the end of the poster word: under it on phones, over its lower third on desktop. */
  posterMedia?: ReactNode;
}) {
  const blue = tone === "blue";
  return (
    <section className={`px-6 sm:px-10 ${blue ? "bg-mecg-blue text-white" : "bg-public-ground text-public-ink"}`}>
      <div className={`mx-auto max-w-6xl pt-12 sm:pt-16 ${overlap ? "pb-20 sm:pb-24" : "pb-10 sm:pb-14"} ${aside ? "grid gap-y-8 lg:grid-cols-[1.25fr_0.75fr] lg:gap-x-12" : ""}`}>
        <div>
        {label ? <p className={`text-[13px] font-semibold ${blue ? "text-white/80" : "text-mecg-blue"}`}>{label}</p> : null}
        {poster ? (
          <div className={`relative ${label ? "mt-4" : ""} [container-type:inline-size]`}>
            <h1 id={titleId}>
              <span className={`poster-word ${blue ? "text-mecg-orange" : "text-public-ink"}`} style={{ fontSize: `${Math.min(30, 235 / title.length)}cqi` }}>{title}</span>
            </h1>
            {posterMedia ? <div className="relative z-10 -mt-[3cqi] ml-auto w-[40cqi] lg:absolute lg:right-0 lg:top-[11cqi] lg:mt-0 lg:w-[23cqi]">{posterMedia}</div> : null}
          </div>
        ) : (
          <h1 id={titleId} className={`${label ? "mt-3" : ""} max-w-4xl text-balance text-[clamp(40px,6vw,76px)] font-semibold leading-[1.02] tracking-[-0.04em]`}>
            {title}
          </h1>
        )}
        {copy ? <p className={`mt-5 max-w-2xl text-pretty text-[17px] leading-7 ${blue ? "text-white/85" : "text-public-muted"}`}>{copy}</p> : null}
        {children ? <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">{children}</div> : null}
        </div>
        {aside ? <div className="relative z-10 -mb-20 self-end lg:-mb-32">{aside}</div> : null}
      </div>
    </section>
  );
}
