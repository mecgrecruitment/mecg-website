// Inline styles only: this wraps content sent through actual email clients,
// which strip <style> blocks and external stylesheets.
export function wrapEmail(bodyHtml: string, cta?: { label: string; href: string }): string {
  const button = cta
    ? `<tr><td style="padding-top:8px"><a href="${cta.href}" style="display:inline-block;background:#fe904d;color:#070d1f;font-weight:600;text-decoration:none;padding:12px 24px;border-radius:2px;font-family:Arial,Helvetica,sans-serif;">${cta.label}</a></td></tr>`
    : "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ec;padding:32px 0;font-family:Arial,Helvetica,sans-serif;">
  <tr><td align="center">
    <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:4px;overflow:hidden;">
      <tr><td style="background:#070d1f;padding:20px 32px;">
        <span style="color:#ffffff;font-size:14px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">MECG</span>
      </td></tr>
      <tr><td style="padding:32px;color:#070d1f;font-size:15px;line-height:1.6;">
        ${bodyHtml}
        <table role="presentation" cellpadding="0" cellspacing="0">${button}</table>
      </td></tr>
      <tr><td style="padding:16px 32px;background:#f4f1ec;color:#070d1fa0;font-size:12px;">
        Michigan Engineering Consulting Group
      </td></tr>
    </table>
  </td></tr>
</table>`;
}

// Best-effort transactional email via Resend's HTTP API. Never throws — a
// missing config or a Resend outage must not fail the caller's request.
export function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] ?? character);
}

export type EmailDeliveryResult = {
  delivered: boolean;
  providerMessageId: string | null;
  errorCategory: string | null;
  retryable: boolean;
};

type EmailParams = { to: string; subject: string; html: string; replyTo?: string; idempotencyKey?: string };

function failedDelivery(errorCategory: string, retryable: boolean): EmailDeliveryResult {
  return { delivered: false, providerMessageId: null, errorCategory, retryable };
}

export async function sendEmailDetailed(params: EmailParams): Promise<EmailDeliveryResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  // Replies default to a shared address rather than falling into whatever the
  // sending domain does with them. An applicant answering a decision email
  // should reach the board, not a person who has since graduated.
  const replyTo = params.replyTo ?? process.env.RECRUITMENT_REPLY_TO?.trim() ?? process.env.CONTACT_TO_EMAIL?.trim();
  if (!apiKey || !from) {
    console.error("RESEND_API_KEY/RESEND_FROM_EMAIL not configured, skipping email");
    return failedDelivery("NOT_CONFIGURED", false);
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...(params.idempotencyKey ? { "Idempotency-Key": params.idempotencyKey } : {}),
      },
      body: JSON.stringify({
        from,
        to: [params.to],
        subject: params.subject,
        html: params.html,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      // Do not log provider response bodies: they can echo recipient or message
      // content. Status is sufficient for alerting and retry classification.
      console.error("sendEmail failed", { status: res.status });
      const retryable = res.status === 408 || res.status === 409 || res.status === 429 || res.status >= 500;
      return failedDelivery(`HTTP_${res.status}`, retryable);
    }
    const response = await res.json().catch(() => null) as { id?: unknown } | null;
    return {
      delivered: true,
      providerMessageId: typeof response?.id === "string" ? response.id.slice(0, 200) : null,
      errorCategory: null,
      retryable: false,
    };
  } catch (error) {
    const category = error instanceof DOMException && error.name === "TimeoutError" ? "TIMEOUT" : "NETWORK";
    console.error("sendEmail failed", { category });
    return failedDelivery(category, true);
  }
}

export async function sendEmail(params: EmailParams): Promise<boolean> {
  return (await sendEmailDetailed(params)).delivered;
}
