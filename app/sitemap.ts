import type { MetadataRoute } from "next";
import { siteUrl } from "./site";

// Public (external) pages only. Authenticated zones (/internal, /apply,
// /portal, /auth, /member-login) stay out. Redirect aliases (/team,
// /recruitment, /services) stay out. /placement is a thin placeholder and
// stays out until consent-backed content ships.
const routes: Array<[path: string, priority: number]> = [
  ["/", 1],
  ["/client-services", 0.8],
  ["/prospective-members", 0.8],
  ["/our-team", 0.7],
  ["/contact", 0.7],
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
