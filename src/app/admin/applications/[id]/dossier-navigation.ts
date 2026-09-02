import { DECIDED_PIPELINE_STATUSES, isPipelineStatus } from "@/lib/workflow";

const RETURN_ORIGIN = "https://mecg.local";

export type DossierNavigationRow = {
  id: string;
  submitted_at: string | null;
  status: string;
  resume_storage_path: string | null;
  pnms: { name: string; contact: string };
};

export function validateRecruitmentReturnTo(value: string | string[] | undefined) {
  if (typeof value !== "string" || value.length === 0 || value.length > 2048) return "/admin";
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/admin";
  try {
    const url = new URL(value, RETURN_ORIGIN);
    if (url.origin !== RETURN_ORIGIN || url.pathname !== "/admin") return "/admin";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/admin";
  }
}

export function applicantDossierHref(applicationId: string, returnTo: string) {
  const query = new URLSearchParams({ returnTo });
  return `/admin/applications/${encodeURIComponent(applicationId)}?${query.toString()}`;
}

export function filterDossierNavigationRows(rows: DossierNavigationRow[], returnTo: string) {
  const url = new URL(validateRecruitmentReturnTo(returnTo), RETURN_ORIGIN);
  const query = (url.searchParams.get("query") ?? url.searchParams.get("search") ?? "").trim().toLowerCase();
  const status = url.searchParams.get("filter");
  const resume = url.searchParams.get("resume");
  const pipelineView = url.searchParams.get("view") === "PIPELINE";
  const showDecided = url.searchParams.get("decided") === "1";

  return rows.filter((row) => {
    if (pipelineView) {
      const decided = isPipelineStatus(row.status) && DECIDED_PIPELINE_STATUSES.has(row.status);
      if (decided && !showDecided) return false;
    } else {
      if (status && status !== "ALL" && row.status !== status) return false;
      if (resume === "ON_FILE" && !row.resume_storage_path) return false;
      if (resume === "MISSING" && row.resume_storage_path) return false;
    }
    if (query && !row.pnms.name.toLowerCase().includes(query) && !row.pnms.contact.toLowerCase().includes(query)) return false;
    return true;
  });
}
