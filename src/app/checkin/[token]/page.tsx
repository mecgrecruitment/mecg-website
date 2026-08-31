import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import CheckinForm from "./checkin-form";
import PortalShell from "@/components/portal-shell";

export const metadata: Metadata = { title: "Check in" };

export default async function CheckinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("event_for_token", { raw_token: token });
  const event = data?.[0];
  if (!event) {
    return <PortalShell eyebrow="Event check-in" title="This link is not valid." description="Ask an MECG Board Member for the current event check-in link."><p className="rounded-xl bg-mecg-navy/[0.035] p-5 text-sm text-mecg-navy/60">The event may have ended or its check-in link may have been replaced.</p></PortalShell>;
  }
  return <PortalShell eyebrow="Event check-in" title={event.name} description={new Date(event.starts_at).toLocaleString()}>{event.is_open ? <CheckinForm token={token} /> : <p className="rounded-xl bg-mecg-navy/[0.035] p-5 text-sm text-mecg-navy/60">Check-in is not open for this event right now.</p>}</PortalShell>;
}
