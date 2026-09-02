import { getSupabasePublicEnv, getSupabaseServiceRoleKey } from "@/lib/env";
import { operationalLog } from "@/lib/operational-log";

export function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  getSupabasePublicEnv();

  const degraded: string[] = [];
  if (!getSupabaseServiceRoleKey()) {
    degraded.push(
      "MECG_SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_ROLE_KEY is missing: every admin route that needs the service-role client will fail",
    );
  }
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim()
      || !process.env.CLERK_SECRET_KEY?.trim()
      || !process.env.CLERK_ISSUER?.trim()
      || !process.env.CLERK_WEBHOOK_SIGNING_SECRET?.trim()) {
    degraded.push("Clerk configuration is incomplete: authentication or identity reconciliation will fail");
  }
  if (!process.env.RESEND_API_KEY?.trim()) {
    degraded.push("RESEND_API_KEY is missing: no applicant email will be sent");
  }
  if (!process.env.RESEND_FROM_EMAIL?.trim()) {
    degraded.push("RESEND_FROM_EMAIL is missing: no applicant email will be sent");
  }

  for (const problem of degraded) {
    operationalLog("error", { event: "boot.degraded", detail: { problem } });
  }
}
