import { after } from "next/server";
import { escapeHtml, sendEmailDetailed, wrapEmail } from "@/lib/email";
import { deliverNotification } from "@/lib/notifications";

export function scheduleApplicationReceiptDelivery(input: {
  applicationId: string;
  applicantName: string;
  recipient: string;
  durableOutbox: boolean;
}) {
  after(async () => {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const supabase = createAdminClient();
    if (input.durableOutbox) {
      const { data, error } = await supabase
        .from("notification_outbox")
        .select("id")
        .eq("application_id", input.applicationId)
        .eq("template_key", "APPLICATION_RECEIVED")
        .maybeSingle();
      if (error || !data?.id) {
        console.error("application receipt outbox lookup failed", error ?? new Error("receipt was not queued"));
        return;
      }
      try {
        await deliverNotification(supabase, data.id);
      } catch (error) {
        // The durable worker owns retries; the applicant response has already
        // been returned and must not depend on the mail provider.
        console.error("application receipt immediate delivery failed", error);
      }
      return;
    }

    // Compatibility path for an application deployment that reaches an older
    // database before submit_application_reliable exists.
    const subject = "We received your MECG application";
    const delivery = await sendEmailDetailed({
      to: input.recipient,
      subject,
      html: wrapEmail(
        `<p>Hi ${escapeHtml(input.applicantName)},</p><p>We've received your MECG application. Our board will review it and follow up with next steps.</p>`,
        { label: "View your application", href: "https://mecgmichigan.com/applicant" },
      ),
      idempotencyKey: `application-received:${input.applicationId}`,
    });
    const { error } = await supabase.rpc("log_message", {
      target_application_id: input.applicationId,
      message_kind: "APPLICATION_RECEIVED",
      message_recipient: input.recipient,
      message_subject: subject,
      was_delivered: delivery.delivered,
    });
    if (error) console.error("application receipt message log failed", error);
  });
}
