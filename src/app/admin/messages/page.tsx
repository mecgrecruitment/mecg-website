import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";
import { selectAuthorizedCycleId } from "@/lib/cycles";
import { createClient } from "@/lib/supabase/server";
import WorkspaceHeader from "@/components/workspace-header";
import WorkspaceNav from "@/components/workspace-nav";
import ComposeForm from "./compose-form";

export const metadata: Metadata = { title: "Messages" };

const LOG_PAGE_SIZE = 50;

export default async function MessagesPage() {
  const user = await requireAdmin();
  const cycleId = selectAuthorizedCycleId(user.memberships, "RECRUITMENT_OPERATIONS");
  if (!cycleId || !hasPermission(user.memberships, cycleId, "RECRUITMENT_OPERATIONS")) redirect("/admin");
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

  const counts = (appsResult.data ?? []).reduce<Record<string, number>>((totals, application) => {
    totals[application.status] = (totals[application.status] ?? 0) + 1;
    return totals;
  }, {});
  const log = logResult.data ?? [];
  const failedCount = log.filter((message) => !message.delivered).length;

  return (
    <main className="workspace-stack mx-auto flex max-w-5xl flex-col p-6 sm:p-10">
      <WorkspaceHeader
        eyebrow={`${cycle.name} · ${cycle.status}`}
        title="Messages"
        description="Write to a slice of the pipeline, and see everything this system has already sent."
      />
      <WorkspaceNav user={user} cycleId={cycleId} current="/admin/messages" />
      <ComposeForm cycleId={cycleId} counts={counts} />

      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-mecg-navy/50">Recent sends</p>
            <p className="mt-1 text-sm text-mecg-navy/55">The last {LOG_PAGE_SIZE} messages for this cycle.</p>
          </div>
          {failedCount > 0 && (
            <span className="inline-flex items-center rounded-full bg-red-50 px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-red-800">
              {failedCount} failed
            </span>
          )}
        </div>
        <div className="mt-3 flex flex-col gap-2">
          {log.map((message) => (
            <article key={message.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-xl bg-white px-4 py-3 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.1)]">
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-mecg-navy">{message.subject}</p>
                <p className="mt-0.5 truncate text-[11.5px] text-mecg-navy/50">{message.kind.replaceAll("_", " ")} · {message.recipient}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.06em] ${message.delivered ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>
                  {message.delivered ? "Delivered" : "Failed"}
                </span>
                <time dateTime={message.created_at} className="font-mono text-[11px] tabular-nums text-mecg-navy/45">
                  {new Date(message.created_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Detroit" })}
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
      </section>
    </main>
  );
}
