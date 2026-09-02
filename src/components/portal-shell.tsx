import Image from "next/image";
import Link from "next/link";

export default function PortalShell({
  eyebrow,
  title,
  description,
  children,
  centered = false,
  compact = false,
  workspace = false,
  headerAction,
  heroExtra,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
  centered?: boolean;
  compact?: boolean;
  workspace?: boolean;
  headerAction?: React.ReactNode;
  heroExtra?: React.ReactNode;
}) {
  if (workspace) {
    return (
      <main className="min-h-dvh bg-mecg-paper-workspace text-mecg-navy">
        <header className="border-b border-mecg-navy/8 bg-white px-6 py-3 sm:px-10">
          <div className="mx-auto flex min-h-14 max-w-7xl items-center justify-between gap-5">
            <Link
              href="/home"
              className="flex min-h-11 items-center rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-mecg-orange"
              aria-label="MECG home"
            >
              <Image src="/logos/mecg-color.svg" alt="MECG" width={150} height={45} priority className="h-10 w-auto" style={{ width: "auto" }} />
            </Link>
            <div className="flex min-h-11 items-center gap-5 text-sm">
              <Link href="/home" className="hidden text-mecg-navy/60 transition-colors hover:text-mecg-navy sm:inline-flex">
                Back to site
              </Link>
              {headerAction}
            </div>
          </div>
        </header>

        <section className="relative overflow-hidden bg-mecg-navy px-6 py-8 text-white sm:px-10 sm:py-10">
          <div className="project-blueprint absolute inset-0 opacity-45" aria-hidden="true" />
          <div className="relative mx-auto max-w-7xl">
            <p className="text-[13px] font-semibold text-mecg-orange">{eyebrow}</p>
            <h1 className="mt-3 max-w-4xl text-balance text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">{title}</h1>
            <p className="mt-4 max-w-2xl text-pretty leading-7 text-white/65">{description}</p>
            {heroExtra}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-8 sm:px-10 sm:py-10">
          {children}
        </section>
      </main>
    );
  }

  if (centered) {
    return (
      <main className="min-h-dvh bg-mecg-paper-workspace text-mecg-navy">
        <header className={`border-b border-mecg-navy/8 bg-white ${compact ? "px-5 py-2.5 sm:px-8" : "px-6 py-3 sm:px-10"}`}>
          <div className={`mx-auto flex max-w-7xl items-center justify-between gap-4 ${compact ? "min-h-12" : "min-h-14"}`}>
            <Link href="/home" className="flex min-h-11 items-center rounded-sm" aria-label="MECG home">
              <Image src="/logos/mecg-color.svg" alt="MECG" width={150} height={45} priority className={`${compact ? "h-9" : "h-10"} w-auto`} style={{ width: "auto" }} />
            </Link>
            <Link href="/home" className="flex min-h-11 items-center text-sm text-mecg-navy/60 transition-colors duration-150 hover:text-mecg-navy">
              Back to site
            </Link>
          </div>
        </header>

        <section className={`flex justify-center ${compact ? "items-start px-5 py-10 sm:px-8 sm:py-14 lg:py-16" : "min-h-[calc(100dvh-5rem)] items-center px-6 py-10 sm:px-10"}`}>
          <div className={`w-full ${compact ? "max-w-md text-left" : "max-w-xl text-center"}`}>
            <p className="text-[13px] font-semibold text-mecg-orange-ink">{eyebrow}</p>
            <h1 className={`${compact ? "mt-2.5 text-4xl sm:text-[2.5rem]" : "mt-3 text-4xl sm:text-5xl"} text-balance font-semibold tracking-[-0.04em]`}>{title}</h1>
            <p className={`${compact ? "mt-3 max-w-md leading-6" : "mx-auto mt-4 max-w-lg leading-7"} text-pretty text-mecg-navy/60`}>{description}</p>
            <div className={compact ? "mt-7 border-t border-mecg-navy/10 pt-7 text-left" : "surface-card mt-7 bg-white p-7 text-left sm:p-9"}>
              {children}
            </div>
          </div>
        </section>
      </main>
    );
  }

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
          <p className="text-[13px] font-semibold text-mecg-orange">MECG workspace</p>
          <p className="mt-6 text-balance text-5xl font-semibold leading-[0.98] tracking-[-0.055em]">
            One account for every part of the process.
          </p>
          <p className="mt-6 text-pretty text-lg leading-8 text-white/60">
            Apply, check your status, complete assigned evaluations, and manage the current rush cycle.
          </p>
        </div>
        <p className="relative text-[13px] text-white/55">
          Michigan Engineering Consulting Group
        </p>
      </aside>

      <section className="flex min-h-dvh items-center bg-mecg-paper-workspace px-6 py-8 text-mecg-navy sm:px-10 lg:px-16">
        <div className="mx-auto w-full max-w-xl">
          <div className="mb-10 flex items-center justify-between lg:hidden">
            <Link href="/home" className="flex min-h-11 items-center rounded-sm" aria-label="MECG home">
              <Image src="/logos/mecg-color.svg" alt="MECG" width={134} height={40} priority className="h-9 w-auto" style={{ width: "auto" }} />
            </Link>
            <Link href="/home" className="text-sm text-mecg-navy/60 hover:text-mecg-navy">
              Back to site
            </Link>
          </div>
          <p className="text-[13px] font-semibold text-mecg-orange-ink">{eyebrow}</p>
          <h1 className="mt-4 text-balance text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">{title}</h1>
          <p className="mt-5 max-w-lg text-pretty leading-7 text-mecg-navy/60">{description}</p>
          <div className="surface-card mt-8 bg-white p-6 sm:p-8">{children}</div>
        </div>
      </section>
    </main>
  );
}
