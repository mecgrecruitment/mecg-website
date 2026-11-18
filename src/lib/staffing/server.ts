import "server-only";
import { createClient } from "@/lib/supabase/server";
import { parseMyAvailability, parsePlan, type MyAvailability, type ProjectOption, type StaffingPlan } from "./model";

// Each loader returns null when its data cannot be read (RPC missing before the
// migration, access refused, or a malformed response) so the page shows an
// unavailable state and no partial data.
export async function loadStaffingPlan(cycleId: string): Promise<StaffingPlan | null> {
  try {
    const client = await createClient();
    const { data, error } = await client.rpc("staffing_plan", { target_cycle_id: cycleId });
    if (error) throw error;
    const parsed = parsePlan(data);
    if (!parsed || parsed.cycleId !== cycleId) throw new Error("staffing_plan returned an unusable payload");
    return parsed;
  } catch (error) {
    console.error("staffing_plan unavailable", error);
    return null;
  }
}

export async function loadMyAvailability(cycleId: string): Promise<{ availability: MyAvailability; projects: ProjectOption[] } | null> {
  try {
    const client = await createClient();
    const [availabilityResult, projectsResult] = await Promise.all([
      client.rpc("my_staffing_availability", { target_cycle_id: cycleId }),
      // Any active member may already read the project list (projects_read_internal).
      client.from("projects").select("id,title,semester").order("sort_order").order("title"),
    ]);
    if (availabilityResult.error) throw availabilityResult.error;
    if (projectsResult.error) throw projectsResult.error;
    const availability = parseMyAvailability(availabilityResult.data);
    if (!availability || availability.cycleId !== cycleId) throw new Error("my_staffing_availability returned an unusable payload");
    const projects = (projectsResult.data ?? []).map((project) => ({ id: project.id, title: project.title, semester: project.semester }));
    return { availability, projects };
  } catch (error) {
    console.error("my_staffing_availability unavailable", error);
    return null;
  }
}
