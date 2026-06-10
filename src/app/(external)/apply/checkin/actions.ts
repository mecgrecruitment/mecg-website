"use server";

import { redirect } from "next/navigation";

// TODO(Track B): event check-in needs recruitment-event + attendance tables
// that are not part of the PRD §10 canonical schema yet. Spec them (or fold
// into recruitment_cycles config §9.14) before rebuilding this flow.
export async function checkIn(_formData: FormData) {
  redirect("/apply/checkin?error=Event check-in is not yet open for Fall 2026.");
}
