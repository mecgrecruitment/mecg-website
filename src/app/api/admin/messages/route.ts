import { NextRequest, NextResponse } from "next/server";
import { readJsonBody } from "@/lib/api-route";
import { currentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";
import { createClient } from "@/lib/supabase/server";
import { escapeHtml, sendEmail, wrapEmail } from "@/lib/email";
import { isPipelineStatus, type PipelineStatus } from "@/lib/workflow";

const MAX_RECIPIENTS = 300;

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsedBody = await readJsonBody(req, 32 * 1024);
  if (parsedBody.error === "too_large") return NextResponse.json({ error: "Payload is too large" }, { status: 413 });
  if (parsedBody.error || !parsedBody.data || typeof parsedBody.data !== "object" || Array.isArray(parsedBody.data)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const body = parsedBody.data as Record<string, unknown>;
  const cycleId = typeof body.cycleId === "string" ? body.cycleId : "";
  if (!cycleId || !hasPermission(user.memberships, cycleId, "RECRUITMENT_OPERATIONS")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const statuses = Array.isArray(body.statuses) ? body.statuses.filter((value): value is PipelineStatus => typeof value === "string" && isPipelineStatus(value)) : [];
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const message = typeof body.body === "string" ? body.body.trim() : "";
  if (!statuses.length) return NextResponse.json({ error: "Pick at least one pipeline status" }, { status: 400 });
  if (!subject || subject.length > 200) return NextResponse.json({ error: "A subject of up to 200 characters is required" }, { status: 400 });
  if (!message || message.length > 5000) return NextResponse.json({ error: "A message of up to 5000 characters is required" }, { status: 400 });

  const supabase = await createClient();
  const { data: recipients, error } = await supabase
    .from("applications")
    .select("id,status,pnms!inner(name,contact)")
    .eq("cycle_id", cycleId)
    .in("status", statuses)
    .limit(MAX_RECIPIENTS + 1);
  if (error) {
    console.error("bulk recipient lookup failed", error);
    return NextResponse.json({ error: "Could not load recipients" }, { status: 500 });
  }
  if ((recipients ?? []).length > MAX_RECIPIENTS) {
    return NextResponse.json({ error: `More than ${MAX_RECIPIENTS} recipients matched. Narrow the selection.` }, { status: 400 });
  }

  let sent = 0;
  let failed = 0;
  // Sequential on purpose. This runs at most a few hundred times per cycle, and
  // a burst of parallel sends is the fastest way to get a shared sending domain
  // rate limited by the provider.
  for (const recipient of recipients ?? []) {
    const html = wrapEmail(
      `<p>Hi ${escapeHtml(recipient.pnms.name)},</p>${message
        .split(/\n{2,}/)
        .map((paragraph) => `<p>${escapeHtml(paragraph).replaceAll("\n", "<br />")}</p>`)
        .join("")}`,
      { label: "Open your applicant portal", href: "https://mecgmichigan.com/applicant" },
    );
    const delivered = await sendEmail({ to: recipient.pnms.contact, subject, html });
    if (delivered) sent += 1;
    else failed += 1;
    // Logged either way, so a partial send is reconstructable afterwards.
    const { error: logError } = await supabase.rpc("log_message", {
      target_application_id: recipient.id,
      message_kind: "BULK",
      message_recipient: recipient.pnms.contact,
      message_subject: subject,
      was_delivered: delivered,
    });
    if (logError) console.error("bulk message log failed", logError);
  }

  return NextResponse.json({ sent, failed });
}
