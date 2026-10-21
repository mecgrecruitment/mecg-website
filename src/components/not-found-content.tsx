import Link from "next/link";
import PortalShell from "@/components/portal-shell";

export default function NotFoundContent() {
  return (
    <PortalShell
      eyebrow="404 / Route unavailable"
      title="This page does not exist."
      description="The link may be old, or the page may have moved. Choose a route below to continue."
      centered
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/home" className="button-primary">
          Return to public site
        </Link>
        <Link href="/login" className="button-secondary">
          Account access
        </Link>
      </div>
      <nav aria-label="Main pages" className="mt-6 border-t border-public-rule pt-5">
        <p className="text-[13px] text-muted">Or go straight to</p>
        <ul className="mt-2 grid grid-cols-2 gap-x-6">
          {[["Client services", "/work"], ["Our team", "/team"], ["Join MECG", "/join"], ["Contact us", "/contact"]].map(([label, href]) => (
            <li key={href}><Link href={href} className="flex min-h-11 items-center gap-2 text-[15px] font-semibold text-mecg-blue hover:underline">{label} <span aria-hidden="true">→</span></Link></li>
          ))}
        </ul>
      </nav>
    </PortalShell>
  );
}
