import Image from "next/image";
import Link from "next/link";

export default function PortalShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <main className="grid min-h-dvh bg-mecg-navy text-white lg:grid-cols-[0.85fr_1.15fr]">
      <aside className="relative hidden overflow-hidden border-r border-white/10 p-10 lg:flex lg:flex-col lg:justify-between">
        <div className="project-blueprint absolute inset-0 opacity-60" aria-hidden="true" />
        <Link
          href="/home"
          aria-label="MECG home"
          className="relative w-fit rounded focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-mecg-orange"
        >
          <Image
            src="/logos/mecg-white.svg"
            alt="MECG"
            width={150}
            height={40}
            priority
            className="h-10 w-auto"
            style={{ width: "auto" }}
          />
        </Link>
        <div className="relative max-w-lg">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-mecg-orange">MECG workspace</p>
          <p className="mt-6 text-balance text-5xl font-semibold leading-[0.98] tracking-[-0.055em]">
            One account for every part of the process.
          </p>
          <p className="mt-6 text-pretty text-lg leading-8 text-white/60">
            Apply, check your status, complete assigned evaluations, and manage the current rush cycle.
          </p>
        </div>
        <p className="relative font-mono text-xs uppercase tracking-[0.15em] text-white/35">
          Michigan Engineering Consulting Group
        </p>
      </aside>

      <section className="flex min-h-dvh items-center bg-white px-6 py-8 text-mecg-navy sm:px-10 lg:px-16">
        <div className="mx-auto w-full max-w-xl">
          <div className="mb-10 flex items-center justify-between lg:hidden">
            <Link href="/home" className="rounded-xl bg-mecg-navy px-3 py-2" aria-label="MECG home">
              <Image src="/logos/mecg-white.svg" alt="MECG" width={107} height={32} priority className="h-8 w-auto" style={{ width: "auto" }} />
            </Link>
            <Link href="/home" className="text-sm text-mecg-navy/55 hover:text-mecg-navy">
              Back to site
            </Link>
          </div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-mecg-orange-ink">{eyebrow}</p>
          <h1 className="mt-4 text-balance text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">{title}</h1>
          <p className="mt-5 max-w-lg text-pretty leading-7 text-mecg-navy/60">{description}</p>
          <div className="mt-8">{children}</div>
        </div>
      </section>
    </main>
  );
}
