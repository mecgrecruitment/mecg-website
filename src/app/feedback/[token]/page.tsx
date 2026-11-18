import type { Metadata } from "next";
import PortalShell from "@/components/portal-shell";
import { createPublicClient } from "@/lib/supabase/public";
import { isFeedbackToken, parseFeedbackForm, type FeedbackForm } from "@/lib/engagement/closeout";
import { formatEasternDateTime } from "@/lib/date-time";
import ClientFeedbackForm from "./feedback-form";

// The token is the only credential, so the page is never indexed and never
// sends it on in a Referer header.
export const metadata: Metadata = { title: "Project feedback", robots: { index: false, follow: false }, referrer: "no-referrer" };

async function loadForm(token: string): Promise<FeedbackForm | null | "unavailable"> {
  if (!isFeedbackToken(token)) return null;
  try {
    const { data, error } = await createPublicClient().rpc("client_feedback_form", { raw_token: token });
    if (error) throw error;
    return parseFeedbackForm(data);
  } catch (error) {
    console.error("client_feedback_form unavailable", error instanceof Error ? error.message : "unknown");
    return "unavailable";
  }
}

export default async function FeedbackPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const form = await loadForm(token);
  if (form === "unavailable") {
    return <PortalShell eyebrow="Project feedback" title="Feedback is temporarily unavailable." description="This is not a problem with your link." centered>
      <p className="text-base leading-6 text-muted">Try again in a little while. The link stays valid until it expires.</p>
    </PortalShell>;
  }
  if (!form) {
    return <PortalShell eyebrow="Project feedback" title="This link is no longer valid." description="It may have expired, been replaced, or already been used." centered>
      <p className="text-base leading-6 text-muted">If you already sent your feedback, thank you. It was received. Otherwise, ask your MECG project contact for a new link.</p>
    </PortalShell>;
  }
  return <PortalShell eyebrow="Project feedback" title={form.projectTitle} description={`${form.clientLabel ? `${form.clientLabel} · ` : ""}Thank you for working with MECG. This takes about two minutes.`}>
    <ClientFeedbackForm token={token} expiresLabel={formatEasternDateTime(form.expiresAt)} />
  </PortalShell>;
}
