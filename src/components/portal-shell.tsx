import Image from "next/image";
import Link from "@/components/workspace-link";

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
      <main className="applicant-shell">
        <header className="applicant-topbar">
          <Link href="/home" className="workspace-wordmark" aria-label="MECG home">MECG<span aria-hidden="true">.</span></Link>
          <nav aria-label="Applicant navigation"><a href="#current-application">My application</a><a href="#applicant-schedule">Schedule</a><Link href="/home">Public site</Link>{headerAction}</nav>
        </header>
        <div className="applicant-page-heading">
          <p>{eyebrow}</p><h1>{title}</h1><p>{description}</p>{heroExtra}
        </div>
        <div className="applicant-page-content">{children}</div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-public-ground text-public-ink">
      <header className={`border-b border-public-rule bg-public-ground/95 ${compact ? "px-5 py-2.5 sm:px-8" : "px-6 py-3 sm:px-10"}`}>
        <div className={`mx-auto flex max-w-6xl items-center justify-between gap-4 ${compact ? "min-h-12" : "min-h-14"}`}>
          <Link href="/home" className="flex min-h-11 items-center rounded-sm" aria-label="MECG home">
            <Image src="/logos/mecg-color.svg" alt="MECG" width={150} height={45} priority className={`${compact ? "h-9" : "h-10"} w-auto`} style={{ width: "auto" }} />
          </Link>
          <Link href="/home" className="flex min-h-11 items-center text-[15px] text-muted transition-colors duration-150 hover:text-mecg-blue">
            Back to site
          </Link>
        </div>
      </header>

      <section className={`flex justify-center ${centered && !compact ? "min-h-[calc(100dvh-5rem)] items-center px-6 py-12 sm:px-10" : "items-start px-5 py-10 sm:px-8 sm:py-14 lg:py-16"}`}>
        <div className={`w-full ${compact ? "max-w-md text-left" : "max-w-xl text-center"}`}>
          <p className="text-[13px] font-semibold text-mecg-blue">{eyebrow}</p>
          <h1 className={`${compact ? "mt-2.5 text-4xl sm:text-[2.5rem]" : "mt-3 text-[40px] sm:text-[52px]"} text-balance font-semibold leading-[1.05] tracking-[-0.04em]`}>{title}</h1>
          <p className={`${compact ? "mt-3 max-w-md leading-6" : "mx-auto mt-4 max-w-lg leading-7"} text-pretty text-[17px] text-muted`}>{description}</p>
          <div className={compact ? "mt-7 border-t border-public-rule pt-7 text-left" : "mt-8 rounded-xl border border-public-rule bg-white p-6 text-left shadow-lift sm:p-8"}>
            {children}
          </div>
        </div>
      </section>
    </main>
  );
}
