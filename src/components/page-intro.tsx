import SectionLabel from "@/components/section-label";

export default function PageIntro({ number, label, title, copy }: { number: string; label: string; title: string; copy: string }) {
  return (
    <section className="relative overflow-hidden border-b border-mecg-navy/10 px-6 py-14 sm:py-18">
      <div className="hero-grid absolute inset-0 opacity-35" aria-hidden="true" />
      <div className="relative mx-auto max-w-6xl">
        <SectionLabel number={number}>{label}</SectionLabel>
        <h1 className="mt-5 max-w-4xl text-balance text-5xl font-semibold leading-[0.98] tracking-[-0.055em] sm:text-7xl">{title}</h1>
        <p className="mt-5 max-w-2xl text-pretty text-lg leading-8 text-mecg-navy/60 sm:text-xl">{copy}</p>
      </div>
    </section>
  );
}
