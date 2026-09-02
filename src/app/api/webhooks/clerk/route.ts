import { verifyWebhook } from "@clerk/nextjs/webhooks";
import type { UserJSON } from "@clerk/backend";
import { NextRequest, NextResponse } from "next/server";
import { requireClerkIssuer, requireClerkWebhookSigningSecret } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

function primaryEmail(user: UserJSON) {
  return user.email_addresses.find((email) => email.id === user.primary_email_address_id)?.email_address ?? null;
}

function displayName(user: UserJSON, email: string) {
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();
  return fullName || user.username || email.split("@", 1)[0] || "MECG user";
}

function migratedUserId(externalId: string | null) {
  return externalId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(externalId)
    ? externalId
    : undefined;
}

export async function POST(request: NextRequest) {
  let event: Awaited<ReturnType<typeof verifyWebhook>>;
  try {
    event = await verifyWebhook(request, { signingSecret: requireClerkWebhookSigningSecret() });
  } catch {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
  }

  const admin = createAdminClient();
  const issuer = requireClerkIssuer();
  if (event.type === "user.deleted") {
    if (!event.data.id) return NextResponse.json({ error: "Missing user id" }, { status: 400 });
    const { error } = await admin.rpc("disable_external_identity", {
      identity_issuer: issuer,
      identity_subject: event.data.id,
    });
    if (error) return NextResponse.json({ error: "Identity reconciliation failed" }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (event.type !== "user.created" && event.type !== "user.updated") {
    return NextResponse.json({ ok: true });
  }
  const email = primaryEmail(event.data);
  if (!email) return NextResponse.json({ error: "A primary email is required" }, { status: 422 });
  const { error } = await admin.rpc("ensure_external_identity", {
    identity_issuer: issuer,
    identity_subject: event.data.id,
    identity_email: email,
    identity_display_name: displayName(event.data, email),
    existing_app_user_id: migratedUserId(event.data.external_id),
  });
  if (error) return NextResponse.json({ error: "Identity reconciliation failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
