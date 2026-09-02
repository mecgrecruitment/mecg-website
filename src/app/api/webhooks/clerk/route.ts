import { verifyWebhook } from "@clerk/nextjs/webhooks";
import type { UserJSON } from "@clerk/backend";
import { NextRequest, NextResponse } from "next/server";
import { requireClerkIssuer, requireClerkWebhookSigningSecret } from "@/lib/env";
import { migratedUserId } from "@/lib/identity/clerk-migration";
import { createAdminClient } from "@/lib/supabase/admin";

function primaryEmail(user: UserJSON) {
  return user.email_addresses.find((email) => email.id === user.primary_email_address_id)?.email_address ?? null;
}

function displayName(user: UserJSON, email: string) {
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();
  return fullName || user.username || email.split("@", 1)[0] || "MECG user";
}

function deliveryMetadata(request: NextRequest) {
  const eventId = request.headers.get("svix-id") ?? request.headers.get("webhook-id");
  const rawTimestamp = request.headers.get("svix-timestamp") ?? request.headers.get("webhook-timestamp");
  if (!eventId?.trim() || !rawTimestamp || !/^\d+$/.test(rawTimestamp)) return null;
  const timestampSeconds = Number(rawTimestamp);
  if (!Number.isSafeInteger(timestampSeconds) || timestampSeconds <= 0) return null;
  const occurredAt = new Date(timestampSeconds * 1_000);
  if (Number.isNaN(occurredAt.getTime())) return null;
  return { eventId: eventId.trim(), occurredAt: occurredAt.toISOString() };
}

export async function POST(request: NextRequest) {
  let event: Awaited<ReturnType<typeof verifyWebhook>>;
  try {
    event = await verifyWebhook(request, { signingSecret: requireClerkWebhookSigningSecret() });
  } catch {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
  }

  if (event.type !== "user.created" && event.type !== "user.updated" && event.type !== "user.deleted") {
    return NextResponse.json({ ok: true });
  }
  if (!event.data.id) return NextResponse.json({ error: "Missing user id" }, { status: 400 });
  const delivery = deliveryMetadata(request);
  if (!delivery) return NextResponse.json({ error: "Missing webhook delivery metadata" }, { status: 400 });

  let email: string | null = null;
  let identityDisplayName: string | null = null;
  let existingAppUserId: string | null = null;
  if (event.type !== "user.deleted") {
    email = primaryEmail(event.data);
    if (!email) return NextResponse.json({ error: "A primary email is required" }, { status: 422 });
    identityDisplayName = displayName(event.data, email);
    existingAppUserId = migratedUserId(event.data.external_id) ?? null;
  }

  const admin = createAdminClient();
  const { data: outcome, error } = await admin.rpc("reconcile_clerk_webhook", {
    webhook_event_id: delivery.eventId,
    webhook_event_type: event.type,
    webhook_occurred_at: delivery.occurredAt,
    identity_issuer: requireClerkIssuer(),
    identity_subject: event.data.id,
    identity_email: email,
    identity_display_name: identityDisplayName,
    existing_app_user_id: existingAppUserId,
  });
  if (error) return NextResponse.json({ error: "Identity reconciliation failed" }, { status: 500 });
  return NextResponse.json({ ok: true, outcome });
}
