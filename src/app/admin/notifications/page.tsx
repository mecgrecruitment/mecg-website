import type { Metadata } from "next";
import { redirect } from "next/navigation";
import WorkspaceHeader from "@/components/workspace-header";
import WorkspaceNav from "@/components/workspace-nav";
import { requireAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";
import { selectAuthorizedCycleId } from "@/lib/cycles";
import { createClient } from "@/lib/supabase/server";
import RetryButton from "./retry-button";
import { formatEasternDateTime } from "@/lib/date-time";

export const metadata: Metadata = { title: "Notification delivery" };

export default async function NotificationsPage() {
  const user = await requireAdmin();
  const cycleId = selectAuthorizedCycleId(user.memberships, "MANAGE_CYCLE");
  if (!cycleId || !hasPermission(user.memberships, cycleId, "MANAGE_CYCLE")) redirect("/admin");
  const supabase = await createClient();
  const fields = "id,recipient,status,attempt_count,max_attempts,last_error_category,next_attempt_at,last_attempt_at,sent_at,created_at" as const;
  const [failedResult, recentResult] = await Promise.all([
    supabase.from("notification_outbox").select(fields).eq("cycle_id", cycleId).eq("status", "FAILED").order("created_at", { ascending: false }),
    supabase.from("notification_outbox").select(fields).eq("cycle_id", cycleId).order("created_at", { ascending: false }).limit(100),
  ]);
  if (failedResult.error) throw failedResult.error;
  if (recentResult.error) throw recentResult.error;
  const rows = recentResult.data ?? [];
  const needsAttention = failedResult.data ?? [];

  return (
    <main className="workspace-stack mx-auto flex max-w-5xl flex-col">
      <WorkspaceHeader
        eyebrow="Operations"
        title="Notification delivery"
        description="Recruitment state is independent from email delivery. Failed sends stay visible here and can be retried safely."
      />
      <WorkspaceNav user={user} cycleId={cycleId} current="/admin/notifications" />

      <section aria-labelledby="failed-notifications">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <h2 id="failed-notifications" className="text-lg font-semibold text-mecg-navy">Needs attention</h2>
            <p className="mt-1 text-sm text-mecg-navy/65">Only terminal failures appear here. Temporary failures retry automatically.</p>
          </div>
          <span className="rounded-full bg-red-50 px-3 py-1 font-mono text-xs font-semibold text-red-800">{needsAttention.length} failed</span>
        </div>
        <div className="mt-3 flex flex-col gap-2">
          {needsAttention.map((item) => (
            <article key={item.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-white px-4 py-3 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)]">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-mecg-navy">{item.recipient}</p>
                <p className="mt-0.5 font-mono text-xs text-mecg-navy/65">
                  {item.last_error_category ?? "UNKNOWN"} · attempt {item.attempt_count} of {item.max_attempts}
                </p>
              </div>
              {item.attempt_count < 8 && <RetryButton notificationId={item.id} />}
            </article>
          ))}
          {!needsAttention.length && <p className="rounded-xl border border-dashed border-mecg-navy/15 p-6 text-center text-sm text-mecg-navy/65">No failed notifications.</p>}
        </div>
      </section>

      <section aria-labelledby="recent-notifications">
        <h2 id="recent-notifications" className="text-lg font-semibold text-mecg-navy">Recent delivery state</h2>
        <div className="mt-3 flex flex-col gap-2">
          {rows.map((item) => (
            <article key={item.id} className="flex flex-wrap items-baseline justify-between gap-3 rounded-xl bg-white px-4 py-3 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)]">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-mecg-navy">{item.recipient}</p>
                <p className="mt-0.5 text-xs text-mecg-navy/65">Attempt {item.attempt_count} of {item.max_attempts}{item.last_error_category ? ` · ${item.last_error_category}` : ""}</p>
              </div>
              <div className="text-right">
                <span className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold ${item.status === "SENT" ? "bg-emerald-50 text-emerald-800" : item.status === "FAILED" ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-800"}`}>{item.status}</span>
                <time className="ml-3 font-mono text-xs text-mecg-navy/65" dateTime={item.sent_at ?? item.next_attempt_at}>
                  {formatEasternDateTime(item.sent_at ?? item.next_attempt_at)}
                </time>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
