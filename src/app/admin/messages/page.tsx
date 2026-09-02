import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";
import { selectAuthorizedCycleId } from "@/lib/cycles";
import { createClient } from "@/lib/supabase/server";
import WorkspaceHeader from "@/components/workspace-header";
import WorkspaceNav from "@/components/workspace-nav";
import { cycleStatusLabel, statusLabel } from "@/lib/labels";
import ComposeForm from "./compose-form";
import { formatEasternDateTime } from "@/lib/date-time";
import RetryButton from "../notifications/retry-button";

export const metadata: Metadata = { title: "Communications" };

const LOG_PAGE_SIZE = 50;
const OUTBOX_PAGE_SIZE = 100;

type CommunicationsView = "compose" | "history" | "delivery";

function selectedView(value: string | string[] | undefined): CommunicationsView {
  const selected = Array.isArray(value) ? value[0] : value;
  return selected === "history" || selected === "delivery" ? selected : "compose";
}

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string | string[] }>;
}) {
  const [user, { view: requestedView }] = await Promise.all([requireAdmin(), searchParams]);
  const cycleId = selectAuthorizedCycleId(user.memberships, "RECRUITMENT_OPERATIONS");
  if (!cycleId || !hasPermission(user.memberships, cycleId, "RECRUITMENT_OPERATIONS")) redirect("/admin");
  const canManageDelivery = hasPermission(user.memberships, cycleId, "MANAGE_CYCLE");
  const view = selectedView(requestedView);
  if (view === "delivery" && !canManageDelivery) redirect("/admin/messages");

  const supabase = await createClient();
  const [cycleResult, appsResult, logResult] = await Promise.all([
    supabase.from("rush_cycles").select("id,name,status").eq("id", cycleId).single(),
    supabase.from("applications").select("status").eq("cycle_id", cycleId).neq("status", "DRAFT"),
    supabase
      .from("messages")
      .select("id,kind,recipient,subject,delivered,created_at")
      .eq("cycle_id", cycleId)
      .order("created_at", { ascending: false })
      .limit(LOG_PAGE_SIZE),
  ]);
  if (cycleResult.error) throw cycleResult.error;
  if (appsResult.error) throw appsResult.error;
  if (logResult.error) console.error("message log lookup failed", logResult.error);
  const cycle = cycleResult.data;
  if (!cycle) redirect("/admin");

  const deliveryResults = view === "delivery"
    ? await Promise.all([
      supabase
        .from("notification_outbox")
        .select("id,recipient,status,attempt_count,max_attempts,last_error_category,next_attempt_at,last_attempt_at,sent_at,created_at")
        .eq("cycle_id", cycleId)
        .eq("status", "FAILED")
        .order("created_at", { ascending: false }),
      supabase
        .from("notification_outbox")
        .select("id,recipient,status,attempt_count,max_attempts,last_error_category,next_attempt_at,last_attempt_at,sent_at,created_at")
        .eq("cycle_id", cycleId)
        .order("created_at", { ascending: false })
        .limit(OUTBOX_PAGE_SIZE),
    ])
    : null;
  if (deliveryResults?.[0].error) throw deliveryResults[0].error;
  if (deliveryResults?.[1].error) throw deliveryResults[1].error;

  const counts = (appsResult.data ?? []).reduce<Record<string, number>>((totals, application) => {
    totals[application.status] = (totals[application.status] ?? 0) + 1;
    return totals;
  }, {});
  const log = logResult.data ?? [];
  const failedCount = log.filter((message) => !message.delivered).length;
  const needsAttention = deliveryResults?.[0].data ?? [];
  const deliveryLog = deliveryResults?.[1].data ?? [];
  const tabs: Array<readonly [href: string, label: string, tab: CommunicationsView]> = [
    ["/admin/messages", "Compose", "compose"],
    ["/admin/messages?view=history", "History", "history"],
    ...(canManageDelivery
      ? [["/admin/messages?view=delivery", "Delivery", "delivery"] as const]
      : []),
  ];

  return (
    <main className="workspace-stack mx-auto flex max-w-5xl flex-col">
      <WorkspaceHeader
        eyebrow={`${cycle.name} · ${cycleStatusLabel(cycle.status)}`}
        title="Communications"
        description="Write to applicants, review sent messages, and resolve delivery failures."
      />
      <WorkspaceNav user={user} cycleId={cycleId} current="/admin/messages" />
      <nav aria-label="Communication sections" className="scroll-cue overflow-x-auto border-b border-mecg-navy/10">
        <div className="flex min-w-max gap-1">
          {tabs.map(([href, label, tab]) => (
            <Link
              key={tab}
              href={href}
              aria-current={view === tab ? "page" : undefined}
              className={`inline-flex min-h-11 items-center border-b-2 px-3.5 text-sm font-semibold transition-colors duration-150 ${
                view === tab
                  ? "border-mecg-navy text-mecg-navy"
                  : "border-transparent text-mecg-navy/55 hover:text-mecg-navy"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
      </nav>

      {view === "compose" && <ComposeForm cycleId={cycleId} counts={counts} />}

      {view === "history" && <section>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <p className="text-[13px] font-semibold text-mecg-navy/50">Recent sends</p>
            <p className="mt-1 text-sm text-mecg-navy/55">The last {LOG_PAGE_SIZE} messages for this cycle.</p>
          </div>
          {failedCount > 0 && (
            <span className="inline-flex items-center rounded-full bg-red-50 px-3 py-1 text-[13px] font-semibold text-red-800">
              {failedCount} failed
            </span>
          )}
        </div>
        <div className="mt-3 flex flex-col gap-2">
          {log.map((message) => (
            <article key={message.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-xl bg-white px-4 py-3 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)]">
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-mecg-navy">{message.subject}</p>
                <p className="mt-0.5 truncate text-[11.5px] text-mecg-navy/50">{statusLabel(message.kind)} · {message.recipient}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[13px] font-semibold ${message.delivered ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>
                  {message.delivered ? "Delivered" : "Failed"}
                </span>
                <time dateTime={message.created_at} className="tabular text-[11px] text-mecg-navy/45">
                  {formatEasternDateTime(message.created_at)}
                </time>
              </div>
            </article>
          ))}
          {!log.length && (
            <p className="rounded-2xl border-[1.5px] border-dashed border-mecg-navy/[0.14] p-7 text-center text-sm text-mecg-navy/55">
              Nothing has been sent from this system yet.
            </p>
          )}
        </div>
      </section>}

      {view === "delivery" && (
        <>
          <section aria-labelledby="failed-notifications">
            <div className="flex items-baseline justify-between gap-4">
              <div>
                <h2 id="failed-notifications" className="text-lg font-semibold text-mecg-navy">Needs attention</h2>
                <p className="mt-1 text-sm text-mecg-navy/65">Terminal failures stay here. Temporary failures retry automatically.</p>
              </div>
              <span className="rounded-full bg-red-50 px-3 py-1 tabular text-xs font-semibold text-red-800">{needsAttention.length} failed</span>
            </div>
            <div className="mt-3 flex flex-col gap-2">
              {needsAttention.map((item) => (
                <article key={item.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-white px-4 py-3 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)]">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-mecg-navy">{item.recipient}</p>
                    <p className="mt-0.5 text-xs text-mecg-navy/65">
                      {statusLabel(item.last_error_category ?? "UNKNOWN")} · attempt {item.attempt_count} of {item.max_attempts}
                    </p>
                  </div>
                  {item.attempt_count < 8 && <RetryButton notificationId={item.id} />}
                </article>
              ))}
              {!needsAttention.length && (
                <p className="rounded-xl border border-dashed border-mecg-navy/15 p-6 text-center text-sm text-mecg-navy/65">
                  No failed notifications.
                </p>
              )}
            </div>
          </section>

          <section aria-labelledby="delivery-history">
            <div>
              <h2 id="delivery-history" className="text-lg font-semibold text-mecg-navy">Delivery history</h2>
              <p className="mt-1 text-sm text-mecg-navy/65">The latest {OUTBOX_PAGE_SIZE} automated emails and texts for this cycle.</p>
            </div>
            <div className="mt-3 flex flex-col gap-2">
              {deliveryLog.map((item) => (
                <article key={item.id} className="flex flex-wrap items-baseline justify-between gap-3 rounded-xl bg-white px-4 py-3 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)]">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-mecg-navy">{item.recipient}</p>
                    <p className="mt-0.5 text-xs text-mecg-navy/65">
                      Attempt {item.attempt_count} of {item.max_attempts}{item.last_error_category ? ` · ${statusLabel(item.last_error_category)}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${item.status === "SENT" ? "bg-emerald-50 text-emerald-800" : item.status === "FAILED" ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-800"}`}>
                      {statusLabel(item.status)}
                    </span>
                    <time className="ml-3 tabular text-xs text-mecg-navy/65" dateTime={item.sent_at ?? item.next_attempt_at}>
                      {formatEasternDateTime(item.sent_at ?? item.next_attempt_at)}
                    </time>
                  </div>
                </article>
              ))}
              {!deliveryLog.length && (
                <p className="rounded-xl border border-dashed border-mecg-navy/15 p-6 text-center text-sm text-mecg-navy/65">
                  No automated deliveries yet.
                </p>
              )}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
