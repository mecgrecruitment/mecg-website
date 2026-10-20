export type NotificationReceipt = {
  notificationId: string;
  status: "SENT" | "PENDING" | "PROCESSING" | "FAILED" | "NOT_DUE" | "UNCONFIRMED";
};

// Validate the network boundary and bind the acknowledgement to this row.
export function notificationReceipt(value: unknown, notificationId: string): NotificationReceipt | null {
  if (!value || typeof value !== "object" || !("notificationId" in value) || value.notificationId !== notificationId || !("status" in value)) return null;
  const status = value.status;
  if (status !== "SENT" && status !== "PENDING" && status !== "PROCESSING" && status !== "FAILED" && status !== "NOT_DUE" && status !== "UNCONFIRMED") return null;
  return { notificationId, status };
}

export function notificationStatusMessage(status: NotificationReceipt["status"]) {
  switch (status) {
    case "SENT": return "Sent to email provider. Inbox delivery is not confirmed.";
    case "PROCESSING": return "The email is being processed. No additional send was attempted by this status check.";
    case "PENDING": return "Queued or being processed. No additional send is needed now.";
    case "FAILED": return "The latest recorded send failed.";
    case "NOT_DUE": return "No new send attempted. Check the current status before retrying.";
    case "UNCONFIRMED": return "The retry result could not be confirmed. Check status before another attempt.";
  }
}
