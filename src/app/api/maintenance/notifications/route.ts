import { NextRequest, NextResponse } from "next/server";
import { hasValidCronAuthorization } from "@/lib/cron-auth";
import { deliverNotification } from "@/lib/notifications";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

async function run(request: NextRequest) {
  const expected = process.env.CRON_SECRET?.trim();
  if (!expected) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  if (!hasValidCronAuthorization(request.headers, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("notification_outbox")
    .select("id")
    .in("status", ["PENDING", "PROCESSING"])
    .lte("next_attempt_at", new Date().toISOString())
    .order("next_attempt_at")
    .limit(25);
  if (error) {
    console.error("notification retry queue lookup failed", error);
    return NextResponse.json({ error: "Could not load notification queue" }, { status: 500 });
  }

  let delivered = 0;
  let deferred = 0;
  let failed = 0;
  let skipped = 0;
  for (const item of data ?? []) {
    try {
      const result = await deliverNotification(supabase, item.id);
      if (result.delivered) delivered += 1;
      else if (result.status === "FAILED") failed += 1;
      else if (result.status === "PENDING") deferred += 1;
      else skipped += 1;
    } catch (deliveryError) {
      failed += 1;
      console.error("notification retry worker failed", {
        notificationId: item.id,
        category: deliveryError instanceof Error ? deliveryError.message : "unknown",
      });
    }
  }
  return NextResponse.json(
    { processed: (data ?? []).length, delivered, deferred, failed, skipped },
    { status: deferred > 0 || failed > 0 ? 503 : 200 },
  );
}

export async function GET(request: NextRequest) { return run(request); }
export async function POST(request: NextRequest) { return run(request); }
