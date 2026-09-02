import { escapeHtml, sendEmailDetailed, wrapEmail } from "@/lib/email";

type RpcResult = { data: unknown; error: { code?: string; message: string } | null };

export type NotificationClient = {
  rpc(name: string, args?: Record<string, unknown>): PromiseLike<RpcResult>;
};

type ClaimedNotificationBase = {
  id: string;
  recipient: string;
  templateVersion: number;
  attemptCount: number;
  idempotencyKey: string;
  applicantName: string;
};

type ClaimedNotification = ClaimedNotificationBase & ({
  templateKey: "DECISION_RELEASED";
  decisionOutcome: string;
} | {
  templateKey: "EVENT_CANCELLED";
  eventName: string;
  eventStartsAt: string;
  eventLocation: string | null;
} | {
  templateKey: "SPEED_DATING_INVITATION";
  roundName: string;
  roundOpensAt: string | null;
  roundClosesAt: string | null;
} | {
  templateKey: "EVALUATION_ASSIGNED";
  evaluatorName: string;
  roundName: string;
  roundOpensAt: string | null;
  roundClosesAt: string | null;
  assignmentId: string;
});

export type NotificationDelivery = {
  attempted: boolean;
  delivered: boolean;
  status: "SENT" | "PENDING" | "FAILED" | "NOT_DUE";
};

function parseClaimedNotification(value: unknown): ClaimedNotification | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (
    typeof row.id !== "string"
    || typeof row.recipient !== "string"
    || (row.templateKey !== "DECISION_RELEASED"
      && row.templateKey !== "EVENT_CANCELLED"
      && row.templateKey !== "SPEED_DATING_INVITATION"
      && row.templateKey !== "EVALUATION_ASSIGNED")
    || row.templateVersion !== 1
    || typeof row.attemptCount !== "number"
    || typeof row.idempotencyKey !== "string"
    || typeof row.applicantName !== "string"
  ) return null;
  if (row.templateKey === "DECISION_RELEASED" && typeof row.decisionOutcome === "string") return row as ClaimedNotification;
  if (row.templateKey === "EVENT_CANCELLED" && typeof row.eventName === "string" && typeof row.eventStartsAt === "string"
    && (typeof row.eventLocation === "string" || row.eventLocation === null)) return row as ClaimedNotification;
  const isNullableTimestamp = (field: unknown) => field === null
    || (typeof field === "string" && field.length > 0 && !Number.isNaN(Date.parse(field)));
  const hasRoundFields = typeof row.roundName === "string"
    && isNullableTimestamp(row.roundOpensAt)
    && isNullableTimestamp(row.roundClosesAt);
  if (row.templateKey === "SPEED_DATING_INVITATION" && hasRoundFields) return row as ClaimedNotification;
  if (row.templateKey === "EVALUATION_ASSIGNED" && hasRoundFields
    && typeof row.evaluatorName === "string" && typeof row.assignmentId === "string") return row as ClaimedNotification;
  return null;
}

function decisionEmail(outcome: string, rawName: string) {
  const name = escapeHtml(rawName);
  const cta = { label: "View your status", href: "https://mecgmichigan.com/applicant" };
  if (outcome === "OFFER") return {
    subject: "Your MECG rush decision: offer",
    html: wrapEmail(`<p>Hi ${name},</p><p>Congratulations! MECG is excited to offer you a spot in our chapter. A board member will follow up with next steps soon.</p>`, cta),
  };
  if (outcome === "REJECT") return {
    subject: "Your MECG rush decision",
    html: wrapEmail(`<p>Hi ${name},</p><p>Thank you for rushing MECG this cycle. After careful review, we're not able to extend an offer this semester. We appreciate the time you put in and hope you'll stay in touch.</p>`, cta),
  };
  if (outcome === "WAITLIST") return {
    subject: "Your MECG rush decision: waitlist",
    html: wrapEmail(`<p>Hi ${name},</p><p>Thank you for rushing MECG. You've been placed on our waitlist, we'll reach out if a spot opens up.</p>`, cta),
  };
  return {
    subject: "Your MECG rush decision",
    html: wrapEmail(`<p>Hi ${name},</p><p>Your MECG rush application status has been updated. Reach out to the board with any questions.</p>`, cta),
  };
}

function eventCancellationEmail(notification: Extract<ClaimedNotification, { templateKey: "EVENT_CANCELLED" }>) {
  const name = escapeHtml(notification.applicantName);
  const eventName = escapeHtml(notification.eventName);
  const location = notification.eventLocation ? ` at ${escapeHtml(notification.eventLocation)}` : "";
  const startsAt = new Date(notification.eventStartsAt).toLocaleString("en-US", { timeZone: "America/Detroit", dateStyle: "full", timeStyle: "short" });
  return {
    subject: `MECG event cancelled: ${notification.eventName}`,
    html: wrapEmail(`<p>Hi ${name},</p><p>${eventName}, scheduled for ${escapeHtml(startsAt)}${location}, has been cancelled. You do not need to update your RSVP.</p>`),
  };
}

function formatRoundTiming(opensAt: string | null, closesAt: string | null) {
  const format = (value: string) => new Date(value).toLocaleString("en-US", {
    timeZone: "America/Detroit",
    dateStyle: "full",
    timeStyle: "short",
  });
  if (opensAt && closesAt) return ` It opens ${escapeHtml(format(opensAt))} and closes ${escapeHtml(format(closesAt))}.`;
  if (opensAt) return ` It opens ${escapeHtml(format(opensAt))}.`;
  if (closesAt) return ` Please complete it by ${escapeHtml(format(closesAt))}.`;
  return "";
}

function speedDatingInvitationEmail(notification: Extract<ClaimedNotification, { templateKey: "SPEED_DATING_INVITATION" }>) {
  const name = escapeHtml(notification.applicantName);
  const roundName = escapeHtml(notification.roundName);
  const timing = formatRoundTiming(notification.roundOpensAt, notification.roundClosesAt);
  return {
    subject: "You're invited to MECG Speed Dating",
    html: wrapEmail(
      `<p>Hi ${name},</p><p>You've been selected to advance to ${roundName}.${timing} Open your applicant portal for scheduling and next steps.</p>`,
      { label: "View next steps", href: "https://mecgmichigan.com/applicant" },
    ),
  };
}

function evaluationAssignedEmail(notification: Extract<ClaimedNotification, { templateKey: "EVALUATION_ASSIGNED" }>) {
  const evaluatorName = escapeHtml(notification.evaluatorName);
  const applicantName = escapeHtml(notification.applicantName);
  const roundName = escapeHtml(notification.roundName);
  const timing = formatRoundTiming(notification.roundOpensAt, notification.roundClosesAt);
  return {
    subject: "New MECG Speed Dating evaluation",
    html: wrapEmail(
      `<p>Hi ${evaluatorName},</p><p>A ${roundName} evaluation for ${applicantName} was added to My Work.${timing}</p>`,
      { label: "Open My Work", href: "https://mecgmichigan.com/member" },
    ),
  };
}

function notificationEmail(notification: ClaimedNotification) {
  switch (notification.templateKey) {
    case "DECISION_RELEASED":
      return decisionEmail(notification.decisionOutcome, notification.applicantName);
    case "EVENT_CANCELLED":
      return eventCancellationEmail(notification);
    case "SPEED_DATING_INVITATION":
      return speedDatingInvitationEmail(notification);
    case "EVALUATION_ASSIGNED":
      return evaluationAssignedEmail(notification);
  }
}

export async function deliverNotification(client: NotificationClient, notificationId: string): Promise<NotificationDelivery> {
  const claimedResult = await client.rpc("claim_notification", { target_notification_id: notificationId });
  if (claimedResult.error) throw new Error(`claim_notification failed: ${claimedResult.error.code ?? "unknown"}`);
  if (claimedResult.data === null) return { attempted: false, delivered: false, status: "NOT_DUE" };
  const notification = parseClaimedNotification(claimedResult.data);
  if (!notification) {
    // An invalid boundary response is a server/schema mismatch. The ten-minute
    // claim lease makes it retryable without trusting malformed data.
    throw new Error("claim_notification returned an invalid payload");
  }

  const content = notificationEmail(notification);
  const result = await sendEmailDetailed({
    to: notification.recipient,
    subject: content.subject,
    html: content.html,
    idempotencyKey: notification.idempotencyKey,
  });
  const completed = await client.rpc("complete_notification", {
    target_notification_id: notification.id,
    was_delivered: result.delivered,
    provider_id: result.providerMessageId,
    error_category: result.errorCategory,
    should_retry: result.retryable,
  });
  if (completed.error) throw new Error(`complete_notification failed: ${completed.error.code ?? "unknown"}`);
  const status = completed.data;
  if (status !== "SENT" && status !== "PENDING" && status !== "FAILED") {
    throw new Error("complete_notification returned an invalid status");
  }
  return { attempted: true, delivered: result.delivered, status };
}
