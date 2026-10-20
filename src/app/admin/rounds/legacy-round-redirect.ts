import { withWorkspaceCycle } from "@/lib/workspace-cycle-url";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";
import { selectWorkspaceCycle } from "@/lib/workspace-cycle";
import { createClient } from "@/lib/supabase/server";

export async function redirectLegacyRound(kind: string) {
  const user = await requireAdmin();
  const cycleId = await selectWorkspaceCycle(user.memberships, ["RECRUITMENT_OPERATIONS", "HASH_PANEL_ACCESS", "MANAGE_CYCLE"]);
  if (!cycleId) redirect("/member");

  const supabase = await createClient();
  const { data: round, error } = await supabase
    .from("rounds")
    .select("id")
    .eq("cycle_id", cycleId)
    .eq("kind", kind)
    .maybeSingle();
  if (error) throw error;
  if (round) redirect(withWorkspaceCycle(`/admin/rounds/${round.id}`, cycleId));

  redirect(withWorkspaceCycle(hasPermission(user.memberships, cycleId, "RECRUITMENT_OPERATIONS") ? "/admin/rounds" : "/admin", cycleId));
}
