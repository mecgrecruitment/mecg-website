import { NextRequest, NextResponse } from "next/server";
import { hasValidCronAuthorization } from "@/lib/cron-auth";
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

function parseReminders(value: unknown): Reminder[] | null {
  if (!Array.isArray(value)) return null;
  const reminders: Reminder[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
    const row = entry as Record<string, unknown>;
    const text = (field: unknown) => (typeof field === "string" ? field : "");
    const dueAt = text(row.dueAt);
    if (row.kind !== "EVALUATION_DUE" || !text(row.email) || !text(row.subjectId) || !text(row.recipientId)
        || !dueAt || Number.isNaN(new Date(dueAt).getTime())) return null;
    reminders.push({
      kind: row.kind,
      subjectId: text(row.subjectId),
      recipientId: text(row.recipientId),
      email: text(row.email),
      name: text(row.name) || "there",
      detail: text(row.detail),
      dueAt,
    });
  }
  return reminders;
}

async function run(request: NextRequest) {
  const expected = process.env.CRON_SECRET?.trim();
  if (!expected) {
    console.error("reminders: CRON_SECRET is unset, refusing to run");
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }
  if (!hasValidCronAuthorization(request.headers, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("pending_reminders");
  if (error) {
    console.error("pending_reminders failed", error);
    return NextResponse.json({ error: "Could not load reminders" }, { status: 500 });
  }

  const reminders = parseReminders(data);
  if (!reminders) {
    console.error("pending_reminders returned an invalid payload");
    return NextResponse.json({ error: "Could not load reminders" }, { status: 500 });
  }

  let sent = 0;
  let failed = 0;
  let recordingFailed = 0;
  for (const reminder of reminders) {
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
    if (!delivered) {
      failed += 1;
      continue;
    }
    const { error: markError } = await supabase.rpc("mark_reminder_sent", {
      reminder_kind: reminder.kind,
      subject_id: reminder.subjectId,
      recipient_id: reminder.recipientId,
    });
    if (markError) {
      recordingFailed += 1;
      console.error("mark_reminder_sent failed", markError);
    } else {
      sent += 1;
    }
  }

  return NextResponse.json(
    { sent, failed, recordingFailed },
    { status: failed > 0 || recordingFailed > 0 ? 503 : 200 },
  );
}

export async function GET(request: NextRequest) {
  return run(request);
}

export async function POST(request: NextRequest) {
  return run(request);
}
