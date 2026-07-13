import Link from "next/link";
import type { ReactNode } from "react";

export function AuthShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="auth-shell portal-shell min-h-screen px-5 py-8 text-white md:px-8 md:py-12">
      <a href="#auth-content" className="skip-link">Skip to account form</a>
      <div className="mx-auto grid min-h-[calc(100vh-6rem)] max-w-[1200px] overflow-hidden rounded-[2rem] border border-white/10 bg-[rgba(8,18,37,0.72)] shadow-[0_35px_120px_rgba(0,0,0,0.35)] lg:grid-cols-[0.82fr_1.18fr]">
        <aside className="auth-shell-intro relative flex flex-col justify-between overflow-hidden border-b border-white/10 p-7 lg:border-b-0 lg:border-r lg:p-10">
          <div className="auth-shell-glow" aria-hidden="true" />
          <div className="relative">
            <Link href="/" className="focus-ring inline-flex rounded-sm font-display text-2xl font-bold uppercase tracking-[-0.05em]">
              MECG
            </Link>
            <p className="annotation annotation-accent mt-16">{eyebrow}</p>
            <h1 className="display mt-5 text-5xl uppercase md:text-6xl lg:text-7xl">{title}</h1>
            <p className="mt-6 max-w-md text-base leading-7 text-white/58">{description}</p>
          </div>

          <div className="relative mt-12 hidden border-t border-white/10 pt-6 lg:block">
            <p className="annotation text-white/35">One account, two paths</p>
            <div className="mt-4 grid gap-3 text-sm leading-6 text-white/48">
              <p>Applicants continue to application materials and event check-ins.</p>
              <p>Approved members are routed to the internal recruitment workspace.</p>
            </div>
          </div>
        </aside>

        <section id="auth-content" tabIndex={-1} className="grid content-center p-7 md:p-10 lg:p-14">
          <div className="mx-auto w-full max-w-xl">{children}</div>
        </section>
      </div>
    </main>
  );
}
