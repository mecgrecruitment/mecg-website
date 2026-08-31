import { NextRequest, NextResponse } from "next/server";
import { readJsonBody } from "@/lib/api-route";
import { escapeHtml, sendEmail, wrapEmail } from "@/lib/email";
import { checkRateLimit } from "@/lib/rate-limit";

const MAX_BODY_BYTES = 16 * 1024;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

  const invalid = name.length < 1 || name.length > 100
    || email.length > 254 || !EMAIL_PATTERN.test(email)
    || subject.length < 1 || subject.length > 150 || /[\r\n]/.test(subject)
    || message.length < 10 || message.length > 5000;
  if (invalid) return NextResponse.json({ error: "Check the form fields and try again" }, { status: 400 });

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!(await checkRateLimit(`contact:${ip}`))) {
    return NextResponse.json({ error: "Too many messages. Try again later." }, { status: 429 });
  }

  const delivered = await sendEmail({
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

  if (!delivered) return NextResponse.json({ error: "Your message could not be sent. Email mecg-board@umich.edu instead." }, { status: 502 });
  return NextResponse.json({ ok: true });
}
