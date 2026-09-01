import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { escapeHtml, sendEmail, wrapEmail } from "@/lib/email";

// Sends the nudges rush.pending_reminders identifies. Postgres cannot call the
// email provider, so the database decides who is owed a reminder and this sends
// it, which keeps every outbound email on one code path.
//
// Guarded by CRON_SECRET rather than a session, and fails closed when the
// secret is unset, matching prune-resumes. Vercel Cron issues a GET; that is
// safe here only because the route ignores cookies entirely and admits nothing
// without the shared secret, so it is not CSRF-reachable.
export const dynamic = "force-dynamic";

type Reminder = {
  kind: string;
  subjectId: string;
  recipientId: string;
  email: string;
  name: string;
  detail: string;
  dueAt: string;
};

function parseReminders(value: unknown): Reminder[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const row = entry as Record<string, unknown>;
    const text = (field: unknown) => (typeof field === "string" ? field : "");
    if (!text(row.email) || !text(row.subjectId) || !text(row.recipientId)) return [];
    return [{
      kind: text(row.kind) || "EVALUATION_DUE",
      subjectId: text(row.subjectId),
      recipientId: text(row.recipientId),
      email: text(row.email),
      name: text(row.name) || "there",
      detail: text(row.detail),
      dueAt: text(row.dueAt),
    }];
  });
}

async function run(request: NextRequest) {
  const expected = process.env.CRON_SECRET?.trim();
  if (!expected) {
    console.error("reminders: CRON_SECRET is unset, refusing to run");
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }
  const presented = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (presented !== expected) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("pending_reminders");
  if (error) {
    console.error("pending_reminders failed", error);
    return NextResponse.json({ error: "Could not load reminders" }, { status: 500 });
  }

  let sent = 0;
  let failed = 0;
  for (const reminder of parseReminders(data)) {
    const due = reminder.dueAt
      ? new Date(reminder.dueAt).toLocaleString("en-US", { dateStyle: "full", timeStyle: "short", timeZone: "America/Detroit" })
      : "soon";
    const delivered = await sendEmail({
      to: reminder.email,
      subject: `Evaluations for ${reminder.detail} close ${due}`,
      html: wrapEmail(
        `<p>Hi ${escapeHtml(reminder.name)},</p><p>You still have evaluations open for ${escapeHtml(reminder.detail)}. The round closes ${escapeHtml(due)}.</p>`,
        { label: "Open your evaluations", href: "https://mecgmichigan.com/member" },
      ),
    });
    if (delivered) sent += 1;
    else failed += 1;
    // Marked either way. A provider outage must not turn into the same nudge
    // every hour until it recovers.
    const { error: markError } = await supabase.rpc("mark_reminder_sent", {
      reminder_kind: reminder.kind,
      subject_id: reminder.subjectId,
      recipient_id: reminder.recipientId,
    });
    if (markError) console.error("mark_reminder_sent failed", markError);
  }

  return NextResponse.json({ sent, failed });
}

export async function GET(request: NextRequest) {
  return run(request);
}

export async function POST(request: NextRequest) {
  return run(request);
}
