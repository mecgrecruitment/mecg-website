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

  const links: Array<readonly [string, string]> = [
    ["/member", "My work"],
    ...(screeningReviewer.data ? [["/member/screening", `Blind screening${openScreening ? ` · ${openScreening}` : ""}`] as const] : []),
    ...(hasGradingEvent ? [["/member/event", "Live event"] as const] : []),
    ...(can("RECRUITMENT_OPERATIONS")
      ? ([
        ["/admin", "Pipeline"],
        ["/admin/rounds", "Rounds"],
        ["/admin/screening", "Screening admin"],
        ["/admin/groups", "Case teams"],
      ] as const)
      : []),
    ...(can("HASH_PANEL_ACCESS") ? [["/admin/hash", "Hash"] as const] : []),
    ...(can("RECRUITMENT_OPERATIONS") ? [["/admin/audit", "Audit log"] as const] : []),
    ["/admin/people", "People"],
    ...(can("MANAGE_CYCLE") ? [["/admin/settings", "Settings"] as const] : []),
  ];

  return <PillNav ariaLabel="Workspace" current={current} links={links} />;
}
