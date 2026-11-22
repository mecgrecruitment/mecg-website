// URL shapes for the board-only consulting hub, shared by the build script
// (which bakes them into rendered links) and the pages that serve them.
export const HUB_ROOT = "/admin/consulting";

export function hubDocHref(slug: string): string {
  return `${HUB_ROOT}/${slug.split("/").map(encodeURIComponent).join("/")}`;
}

export function hubFileHref(id: string, name: string): string {
  return `${HUB_ROOT}/file/${encodeURIComponent(id)}/${encodeURIComponent(name)}`;
}
