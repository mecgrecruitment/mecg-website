import Link from "next/link";
import PortalShell from "@/components/portal-shell";

export default function NotFound() {
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
    </PortalShell>
  );
}
