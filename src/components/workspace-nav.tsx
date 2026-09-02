import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/authorization";
import { screeningRpc, type ScreeningQueueItem } from "@/lib/screening-rpc";
import type { CurrentUser } from "@/lib/auth";
import PillNav from "./pill-nav";

// One nav for the whole internal workspace. Before this, /admin had BoardNav,
// /member hand-rolled its own link array, and every sub-page had neither: you
// landed on Case teams or Live event and your only way out was a single "back"
// button. Board members also carried two mental models because the two trees
// advertised each other with cross-link buttons instead of shared nav.
//
// Capability gating lives here so a page never has to reason about which links
// a role may see.
//
// Labels are plain English on purpose. "Pipeline", "Blind screening",
// "Delivery" and "Audit log" were internal names that meant nothing to a member
// on their first day; the routes behind them are unchanged.
export default async function WorkspaceNav({
  user,
  cycleId,
  current,
}: {
  user: CurrentUser;
  cycleId: string;
  current: string;
}) {
  const supabase = await createClient();
  // Two links depend on live state rather than on a role, so they are looked up
  // rather than derived. Cheap, and it keeps callers from plumbing flags through.
  const [screeningReviewer, { data: gradingEvents }] = await Promise.all([
    screeningRpc<boolean>(supabase, "is_active_screening_reviewer", { target_cycle_id: cycleId }),
    supabase.rpc("my_grading_events"),
  ]);

  const screeningQueue = screeningReviewer.data
    ? await screeningRpc<ScreeningQueueItem[]>(supabase, "my_screening_queue", { target_cycle_id: cycleId })
    : { data: [], error: null };
  const openScreening = (screeningQueue.data ?? []).filter((item) => item.assignment_status === "ASSIGNED").length;
  const hasGradingEvent = (gradingEvents ?? []).length > 0;

  const can = (permission: Parameters<typeof hasPermission>[2]) => hasPermission(user.memberships, cycleId, permission);
  // Every member votes once the cycle reaches decision lock, so the link is
  // driven by cycle state rather than by role.
  const votingOpen = user.memberships.some((membership) =>
    membership.active && membership.cycleId === cycleId && membership.cycle.status === "DECISION_LOCK");

  // Two rows, because a single 16-item bar made "what I owe" and "what I run"
  // look like one undifferentiated list. Row one is always the member's own
  // work, so a plain member sees only that row.
  const mine: Array<readonly [string, string]> = [
    ["/member", "My work"],
    ...(votingOpen ? [["/member/hash", "Hash vote"] as const] : []),
    ...(screeningReviewer.data ? [["/member/screening", `Read applications${openScreening ? ` · ${openScreening}` : ""}`] as const] : []),
    ...(hasGradingEvent ? [["/member/event", "Live event"] as const] : []),
    ["/member/refer", "Refer someone"],
    ["/admin/people", "People"],
  ];

  const board: Array<readonly [string, string]> = [
    ...(can("RECRUITMENT_OPERATIONS")
      ? ([
        ["/admin", "Applicants"],
        ["/admin/referrals", "Referrals"],
        ["/admin/rounds", "Interview rounds"],
        ["/admin/screening", "Review setup"],
        ["/admin/groups", "Group interviews"],
        ["/admin/messages", "Messages"],
        ...(can("MANAGE_CYCLE") ? [["/admin/notifications", "Emails & texts"] as const] : []),
      ] as const)
      : []),
    ...(can("HASH_PANEL_ACCESS") ? [["/admin/hash", "Hash results"] as const] : []),
    ...(can("RECRUITMENT_OPERATIONS") ? [["/admin/audit", "Activity"] as const] : []),
    ...(can("MANAGE_CYCLE") ? [["/admin/projects", "Projects"] as const] : []),
    ...(can("MANAGE_CYCLE") ? [["/admin/settings", "Settings"] as const] : []),
  ];

  return (
    <>
      <div className="workspace-nav-shell sticky top-3 z-30 flex flex-col gap-1 rounded-2xl bg-white/88 p-1.5 shadow-[0_14px_44px_rgba(7,13,31,0.09),inset_0_0_0_1px_rgba(7,13,31,0.08)] backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <span className="w-14 shrink-0 pl-2 text-[12px] font-semibold text-mecg-navy/55">Mine</span>
          <PillNav ariaLabel="Your work" current={current} links={mine} />
        </div>
        {board.length > 0 && (
          <div className="flex items-center gap-2 border-t border-mecg-navy/[0.08] pt-1">
            <span className="w-14 shrink-0 pl-2 text-[12px] font-semibold text-mecg-navy/55">Board</span>
            <PillNav ariaLabel="Board tools" current={current} links={board} />
          </div>
        )}
      </div>
      <span id="workspace-content" tabIndex={-1} className="sr-only">Workspace content</span>
    </>
  );
}
