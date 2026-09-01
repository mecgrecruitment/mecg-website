import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { getSupabasePublicEnv, getSupabaseServiceRoleKey } from "@/lib/env";
import { operationalLog } from "@/lib/operational-log";
import { createClient } from "@/lib/supabase/server";

const PROBE_TIMEOUT_MS = 2_000;

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.memberships.some((membership) => membership.active && membership.role === "OWNER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let publicSupabase = false;
  try {
    getSupabasePublicEnv();
    publicSupabase = true;
  } catch {
    publicSupabase = false;
  }

  const configuration = {
    publicSupabase,
    serviceRole: Boolean(getSupabaseServiceRoleKey()),
    resend: Boolean(process.env.RESEND_API_KEY?.trim() && process.env.RESEND_FROM_EMAIL?.trim()),
    contactRecipient: Boolean(process.env.CONTACT_TO_EMAIL?.trim()),
    cronSecret: Boolean(process.env.CRON_SECRET?.trim()),
  };

  const started = Date.now();
  let database = false;
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("public_recruitment").abortSignal(AbortSignal.timeout(PROBE_TIMEOUT_MS));
    database = !error;
  } catch (error) {
    operationalLog("error", {
      event: "operations.database_probe_failed",
      code: error instanceof Error ? error.name : "UNKNOWN",
      durationMs: Date.now() - started,
    });
  }

  const ready = database && Object.values(configuration).every(Boolean);
  if (!ready) {
    operationalLog("warn", {
      event: "operations.degraded",
      durationMs: Date.now() - started,
      detail: { database, ...configuration },
    });
  }

  return NextResponse.json(
    {
      ready,
      checkedAt: new Date().toISOString(),
      database: { ok: database, latencyMs: Date.now() - started },
      configuration,
    },
    { status: ready ? 200 : 503, headers: { "Cache-Control": "private, no-store" } },
  );
}
