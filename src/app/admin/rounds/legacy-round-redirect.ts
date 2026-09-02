import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";
import { selectAuthorizedCycleId } from "@/lib/cycles";
import { createClient } from "@/lib/supabase/server";

export async function redirectLegacyRound(kind: string) {
  const user = await requireAdmin();
  const cycleId = selectAuthorizedCycleId(user.memberships, "RECRUITMENT_OPERATIONS")
    ?? selectAuthorizedCycleId(user.memberships, "HASH_PANEL_ACCESS")
    ?? selectAuthorizedCycleId(user.memberships, "MANAGE_CYCLE");
  if (!cycleId) redirect("/member");

  const supabase = await createClient();
  const { data: round, error } = await supabase
    .from("rounds")
    .select("id")
    .eq("cycle_id", cycleId)
    .eq("kind", kind)
    .maybeSingle();
  if (error) throw error;
  if (round) redirect(`/admin/rounds/${round.id}`);

  redirect(hasPermission(user.memberships, cycleId, "RECRUITMENT_OPERATIONS") ? "/admin/rounds" : "/admin");
}
