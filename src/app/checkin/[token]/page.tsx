import type { Metadata } from "next";
import { currentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import CheckinForm from "./checkin-form";
import PortalShell from "@/components/portal-shell";

export const metadata: Metadata = { title: "Check in" };

export default async function CheckinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [supabase, user] = await Promise.all([createClient(), currentUser()]);
  const { data, error } = await supabase.rpc("event_for_token", { raw_token: token });
  if (error) {
    console.error("event_for_token failed", error);
    return (
      <PortalShell eyebrow="Event check-in" title="Check-in is temporarily unavailable." description="This is not a problem with your link." centered>
        <p className="rounded-xl bg-mecg-navy/[0.035] p-5 text-sm text-mecg-navy/60">Try again in a moment, or ask an MECG Board Member to check you in manually.</p>
      </PortalShell>
    );
  }
  const event = data?.[0];
  if (!event) {
    return (
      <PortalShell eyebrow="Event check-in" title="This link is not valid." description="Ask an MECG Board Member for the current event check-in link." centered>
        <p className="rounded-xl bg-mecg-navy/[0.035] p-5 text-sm text-mecg-navy/60">The event may have ended or its check-in link may have been replaced.</p>
      </PortalShell>
    );
  }
  return (
    <PortalShell eyebrow="Event check-in" title={event.name} description={new Date(event.starts_at).toLocaleString()} centered>
      {event.is_open ? (
        <>
          {user && <p className="mb-4 text-sm text-mecg-navy/65">Checking in as <span className="font-semibold text-mecg-navy">{user.email}</span>.</p>}
          <CheckinForm token={token} />
        </>
      ) : (
        <p className="rounded-xl bg-mecg-navy/[0.035] p-5 text-sm text-mecg-navy/60">Check-in is not open for this event right now.</p>
      )}
    </PortalShell>
  );
}
