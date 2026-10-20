import { NextRequest, NextResponse } from "next/server";
import { contactErrors } from "@/lib/contact-validation";
import { readJsonBody } from "@/lib/api-route";
import { escapeHtml, sendEmailDetailed, wrapEmail } from "@/lib/email";
import { checkRateLimitStatus, clientIp } from "@/lib/rate-limit";

const MAX_BODY_BYTES = 16 * 1024;


function textField(body: Record<string, unknown>, name: string) {
  return typeof body[name] === "string" ? body[name].trim() : "";
}

export async function POST(request: NextRequest) {
  const parsed = await readJsonBody(request, MAX_BODY_BYTES);
  if (parsed.error === "too_large") return NextResponse.json({ error: "Message is too large" }, { status: 413 });
  if (parsed.error || !parsed.data || typeof parsed.data !== "object" || Array.isArray(parsed.data)) {
    return NextResponse.json({ error: "Invalid message" }, { status: 400 });
  }

  const body = parsed.data as Record<string, unknown>;
  if (textField(body, "website")) return NextResponse.json({ ok: true });

  const name = textField(body, "name");
  const email = textField(body, "email");
  const subject = textField(body, "subject");
  const message = textField(body, "message");

  const fields = contactErrors({ name, email, subject, message });
  if (Object.keys(fields).length) return NextResponse.json({ error: "Check the highlighted fields and try again.", fields }, { status: 400 });

  const requestId = textField(body, "requestId");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
    return NextResponse.json({ error: "Reload this page before sending your message. Keep a copy of your answers." }, { status: 400 });
  }

  const ip = clientIp(request);
  const rateLimit = await checkRateLimitStatus(`contact:${ip}`);
  if (rateLimit === "unavailable") return NextResponse.json({ error: "Message delivery is temporarily unavailable. Your answers are still here; try later or email mecg-board@umich.edu." }, { status: 503 });
  if (rateLimit === "limited") {
    return NextResponse.json({ error: "Too many messages. Try again later." }, { status: 429 });
  }

  const delivery = await sendEmailDetailed({
    idempotencyKey: `contact/${requestId}`,
    to: process.env.CONTACT_TO_EMAIL?.trim() || "mecg-board@umich.edu",
    replyTo: email,
    subject: `MECG website: ${subject}`,
    html: wrapEmail([
      `<p><strong>From:</strong> ${escapeHtml(name)} &lt;${escapeHtml(email)}&gt;</p>`,
      `<p><strong>Subject:</strong> ${escapeHtml(subject)}</p>`,
      `<p><strong>Message:</strong></p>`,
      `<p>${escapeHtml(message).replaceAll("\n", "<br>")}</p>`,
    ].join("")),
  });

  if (!delivery.delivered || !delivery.providerMessageId?.trim()) return NextResponse.json({ error: "Delivery could not be confirmed. Your message is still here. Retry without editing to reuse this request, or email mecg-board@umich.edu for help." }, { status: 502 });
  return NextResponse.json({ ok: true });
}
