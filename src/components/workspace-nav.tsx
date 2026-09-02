import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/authorization";
import { screeningRpc, type ScreeningQueueItem } from "@/lib/screening-rpc";
import type { CurrentUser } from "@/lib/auth";
import PillNav from "./pill-nav";
import WorkspaceMoreMenu from "./workspace-more-menu";

type NavLink = readonly [href: string, label: string];

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

  const primary: NavLink[] = [
    ["/member", "My work"],
    ...(can("RECRUITMENT_OPERATIONS")
      ? ([
        ["/admin", "Recruitment"],
        ["/admin/rounds", "Interviews"],
      ] as const)
      : []),
    ...(!can("RECRUITMENT_OPERATIONS") && can("HASH_PANEL_ACCESS") ? [["/admin", "Overview"] as const] : []),
    ...(can("HASH_PANEL_ACCESS") ? [["/admin/hash", "Decisions"] as const] : []),
    ...(can("RECRUITMENT_OPERATIONS") ? [["/admin/messages", "Communications"] as const] : []),
  ];

  const myTools: NavLink[] = [
    ...(votingOpen ? [["/member/hash", "Hash vote"] as const] : []),
    ...(screeningReviewer.data ? [["/member/screening", `Read applications${openScreening ? ` · ${openScreening}` : ""}`] as const] : []),
    ...(hasGradingEvent ? [["/member/event", "Live event"] as const] : []),
    ["/member/refer", "Refer someone"],
    ["/admin/people", "People"],
  ];

  const adminTools: NavLink[] = [
    ...(can("RECRUITMENT_OPERATIONS")
      ? ([
        ["/admin/screening", "Review setup"],
      ] as const)
      : []),
    ...(can("MANAGE_CYCLE") ? [["/admin/settings", "Settings"] as const] : []),
  ];
  return (
    <>
      <div className="workspace-nav-shell sticky top-3 z-30 flex items-center gap-1 rounded-2xl bg-white/92 p-1.5 shadow-[0_10px_30px_rgba(7,13,31,0.08),inset_0_0_0_1px_rgba(7,13,31,0.08)] backdrop-blur-xl">
        <div className="min-w-0 flex-1">
          <PillNav ariaLabel="Workspace" current={current} links={primary} matchPathOnly />
        </div>
        <WorkspaceMoreMenu current={current} myTools={myTools} adminTools={adminTools} />
      </div>
      <span id="workspace-content" tabIndex={-1} className="sr-only">Workspace content</span>
    </>
  );
}
