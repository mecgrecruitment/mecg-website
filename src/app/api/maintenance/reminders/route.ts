import { NextRequest, NextResponse } from "next/server";
import { hasValidCronAuthorization } from "@/lib/cron-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { escapeHtml, sendEmail, wrapEmail } from "@/lib/email";
import { operationalLog } from "@/lib/operational-log";

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
  let skipped = 0;
  for (const reminder of reminders) {
    const args = {
      reminder_kind: reminder.kind,
      subject_id: reminder.subjectId,
      recipient_id: reminder.recipientId,
    };
    // Claim before sending. Two overlapping cron runs read the same pending
    // list, and only the run that inserts the bookkeeping row may deliver.
    const { data: claimed, error: claimError } = await supabase.rpc("claim_reminder", args);
    if (claimError) {
      recordingFailed += 1;
      console.error("claim_reminder failed", claimError);
      continue;
    }
    if (!claimed) {
      skipped += 1;
      continue;
    }
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
      // Hand the claim back so the next run retries. Losing the reminder takes
      // this release failing too, which is the trade for never duplicating.
      const { error: releaseError } = await supabase.rpc("release_reminder", args);
      if (releaseError) {
        recordingFailed += 1;
        console.error("release_reminder failed", releaseError);
      }
      continue;
    }
    sent += 1;
  }

  if (failed > 0 || recordingFailed > 0) {
    operationalLog("error", {
      event: "cron.reminders_degraded",
      code: failed >= recordingFailed ? "SEND_FAILED" : "RECORD_FAILED",
      detail: { sent, failed, recordingFailed },
    });
  }
  return NextResponse.json(
    { sent, failed, recordingFailed, skipped },
    { status: failed > 0 || recordingFailed > 0 ? 503 : 200 },
  );
}

export async function GET(request: NextRequest) {
  return run(request);
}

export async function POST(request: NextRequest) {
  return run(request);
}
