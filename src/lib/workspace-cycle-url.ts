export const WORKSPACE_CYCLE_HEADER = "x-mecg-workspace-cycle";
export type WorkspaceCycleSelection = { kind: "default" } | { kind: "selected"; cycleId: string } | { kind: "invalid" };

export function parseWorkspaceCycleSelection(values: readonly string[]): WorkspaceCycleSelection {
  if (!values.length) return { kind: "default" };
  const selected = values[0];
  if (!selected || selected.length > 240 || selected.trim() !== selected || values.some((value) => value !== selected)) return { kind: "invalid" };
  return { kind: "selected", cycleId: selected };
}

export function workspaceCycleSelection(params: URLSearchParams): WorkspaceCycleSelection {
  // Keep old provisioning deep links, while rejecting contradictory selectors.
  return parseWorkspaceCycleSelection([...params.getAll("cycleId"), ...params.getAll("cycle")]);
}

export function withWorkspaceCycle(href: string, cycleId: string | null): string {
  if (!cycleId) return href;
  if (!/^\/(admin|member)(?:[/?#]|$)/.test(href)) return href;
  const url = new URL(href, "https://workspace.invalid");
  url.searchParams.delete("cycle");
  url.searchParams.set("cycleId", cycleId);
  return `${url.pathname}${url.search}${url.hash}`;
}

// Entity ids cannot be transplanted into another cohort. Return to the matching
// list/workspace when switching there; ordinary query filters and hashes survive.
export function switchedWorkspaceHref(href: string, cycleId: string): string {
  const url = new URL(href, "https://workspace.invalid");
  if (/^\/admin\/rounds\/[^/]+/.test(url.pathname)) url.pathname = "/admin/rounds";
  else if (/^\/admin\/events\/[^/]+/.test(url.pathname) && url.pathname !== "/admin/events/new") url.pathname = "/admin/rounds";
  else if (/^\/admin\/applications\/[^/]+/.test(url.pathname)) url.pathname = "/admin";
  else if (/^\/member\/(screening|calibration)\/[^/]+/.test(url.pathname)) url.pathname = "/member";
  url.searchParams.delete("assignment");
  url.searchParams.delete("event");
  url.searchParams.delete("return");
  return withWorkspaceCycle(`${url.pathname}${url.search}${url.hash}`, cycleId);
}

export function clonedCycleDestination(receipt: unknown): string | null {
  if (!receipt || typeof receipt !== "object" || !("id" in receipt)
    || typeof receipt.id !== "string" || !receipt.id || receipt.id.length > 240 || receipt.id.trim() !== receipt.id) return null;
  return withWorkspaceCycle("/admin/settings", receipt.id);
}

export function workspacePermissionsForPath(href: string): readonly import("@/lib/authorization").Permission[] {
  const path = href.split(/[?#]/, 1)[0];
  if (path === "/admin/settings") return ["MANAGE_CYCLE"];
  if (path === "/admin/provisioning") return ["MANAGE_MEMBERSHIPS"];
  if (path === "/admin/hash" || path.startsWith("/admin/hash/")) return ["HASH_PANEL_ACCESS", "MANAGE_CYCLE"];
  if (path === "/admin") return ["RECRUITMENT_OPERATIONS", "HASH_PANEL_ACCESS"];
  if (["/admin/rounds", "/admin/events", "/admin/screening", "/admin/messages", "/admin/audit", "/admin/referrals"].some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) return ["RECRUITMENT_OPERATIONS"];
  return ["WORKSPACE_ACCESS"];
}
