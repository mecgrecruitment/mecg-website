import type { Metadata } from "next";
import { currentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import CheckinForm from "./checkin-form";
import PortalShell from "@/components/portal-shell";
import { formatEasternDateTime } from "@/lib/date-time";

export const metadata: Metadata = { title: "Check in", robots: { index: false, follow: false } };

export default async function CheckinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const [{ data, error }, identity] = await Promise.all([
    supabase.rpc("event_for_token", { raw_token: token }),
    currentUser()
      .then((user) => ({ user, unavailable: false }))
      .catch((identityError) => {
        console.error("check-in identity lookup failed", identityError);
        return { user: null, unavailable: true };
      }),
  ]);
  const { user, unavailable: identityUnavailable } = identity;
  if (error) {
    console.error("event_for_token failed", error);
    return (
      <PortalShell eyebrow="Event check-in" title="Check-in is temporarily unavailable." description="This is not a problem with your link." centered>
        <p className="text-[15px] leading-6 text-public-muted">Try again in a moment, or ask an MECG Board Member to check you in manually.</p>
      </PortalShell>
    );
  }
  const event = data?.[0];
  if (!event) {
    return (
      <PortalShell eyebrow="Event check-in" title="This link is not valid." description="Ask an MECG Board Member for the current event check-in link." centered>
        <p className="text-[15px] leading-6 text-public-muted">The event may have ended or its check-in link may have been replaced.</p>
      </PortalShell>
    );
  }
  return (
    <PortalShell eyebrow="Event check-in" title={event.name} description={formatEasternDateTime(event.starts_at)} centered>
      {event.is_open ? (
        <>
          {user && <p className="mb-4 text-sm text-mecg-navy/65">Checking in as <span className="font-semibold text-mecg-navy">{user.email}</span>.</p>}
          <CheckinForm token={token} eventName={event.name} signedIn={Boolean(user)} identityUnavailable={identityUnavailable} />
        </>
      ) : (
        <p className="text-[15px] leading-6 text-public-muted">Check-in is not open for this event right now.</p>
      )}
    </PortalShell>
  );
}
