import "server-only";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { CurrentUser } from "@/lib/auth";
import { hasPermission, type Permission } from "@/lib/authorization";
import { selectAuthorizedCycleId } from "@/lib/cycles";
import { parseWorkspaceCycleSelection, WORKSPACE_CYCLE_HEADER } from "@/lib/workspace-cycle-url";

export async function requestedWorkspaceCycleId() {
  // Proxy overwrites this request-only context from the URL, including deleting
  // externally supplied values. It is a selector, never proof of authorization.
  const raw = (await headers()).get(WORKSPACE_CYCLE_HEADER);
  let values: unknown;
  try { values = raw === null ? [] : JSON.parse(raw); } catch { notFound(); }
  if (!Array.isArray(values) || !values.every((value) => typeof value === "string")) notFound();
  const selection = parseWorkspaceCycleSelection(values);
  if (selection.kind === "invalid") notFound();
  return selection.kind === "selected" ? selection.cycleId : null;
}

export async function selectWorkspaceCycle(memberships: CurrentUser["memberships"], permission: Permission | readonly Permission[]) {
  const requested = await requestedWorkspaceCycleId();
  if (requested && !hasPermission(memberships, requested, "WORKSPACE_ACCESS")) notFound();
  const permissions = typeof permission === "string" ? [permission] : permission;
  const selected = permissions.map((capability) => selectAuthorizedCycleId(memberships, capability, requested)).find(Boolean) ?? null;
  // An explicit cohort cannot silently turn into another cohort or capability.
  if (requested && !selected) notFound();
  return selected;
}

export async function selectWorkspaceMembership(user: CurrentUser, roles?: readonly string[]) {
  const cycleId = await selectWorkspaceCycle(user.memberships, "WORKSPACE_ACCESS");
  return user.memberships.find((membership) => membership.active && membership.cycleId === cycleId
    && (!roles || roles.includes(membership.role))) ?? null;
}
