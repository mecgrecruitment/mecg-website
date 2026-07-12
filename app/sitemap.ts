import type { MetadataRoute } from "next";
import { siteUrl } from "./site";

// Public (external) pages only — /internal, /apply, /portal, /auth and
// /member-login are authenticated and stay out of the index. The redirect-only
// routes (/team, /recruitment, /services, /placement) are omitted too: a
// sitemap should list canonical URLs, not 307s.
const routes: Array<[path: string, priority: number]> = [
  ["/", 1],
  ["/about", 0.8],
  ["/client-services", 0.8],
  ["/prospective-members", 0.8],
  ["/our-team", 0.7],
  ["/contact", 0.7],
  ["/socials", 0.5],
  ["/trek", 0.4],
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return routes.map(([path, priority]) => ({
    url: new URL(path, siteUrl).toString(),
    lastModified,
    changeFrequency: "monthly",
    priority,
  }));
}
