import { NextRequest, NextResponse } from "next/server";
import { mapRpcError, readJsonBody } from "@/lib/api-route";
import { currentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";
import { deliverNotification } from "@/lib/notifications";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = await readJsonBody(request, 4 * 1024);
  if (parsed.error === "too_large") return NextResponse.json({ error: "Payload is too large" }, { status: 413 });
  if (parsed.error || !parsed.data || typeof parsed.data !== "object" || Array.isArray(parsed.data)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const notificationId = typeof (parsed.data as Record<string, unknown>).notificationId === "string"
    ? (parsed.data as Record<string, unknown>).notificationId as string
    : "";
  if (!notificationId) return NextResponse.json({ error: "Notification is required" }, { status: 400 });

  const supabase = await createClient();
  const { data: notification, error: lookupError } = await supabase
    .from("notification_outbox")
    .select("cycle_id")
    .eq("id", notificationId)
    .maybeSingle();
  if (lookupError) {
    console.error("notification lookup failed", lookupError);
    return NextResponse.json({ error: "Notification lookup is unavailable" }, { status: 503 });
  }
  if (!notification?.cycle_id || !hasPermission(user.memberships, notification.cycle_id, "MANAGE_CYCLE")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error: retryError } = await supabase.rpc("retry_notification", { target_notification_id: notificationId });
  if (retryError) {
    const mapped = mapRpcError(retryError);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
  try {
    const result = await deliverNotification(createAdminClient(), notificationId);
    return NextResponse.json(result);
  } catch (error) {
    console.error("manual notification retry failed", {
      notificationId,
      category: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json({ attempted: false, delivered: false, status: "PENDING" }, { status: 202 });
  }
}
