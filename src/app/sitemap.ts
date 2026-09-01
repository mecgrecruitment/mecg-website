import type { MetadataRoute } from "next";
import { getPublicProjectSlugs } from "@/lib/projects/public-projects";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://mecgmichigan.com";
  const pages = ["/home", "/team", "/work", "/join", "/contact"];
  return [
    ...pages.map((path) => ({ url: `${baseUrl}${path}`, changeFrequency: "monthly" as const, priority: path === "/home" ? 1 : 0.8 })),
    ...(await getPublicProjectSlugs()).map((slug) => ({ url: `${baseUrl}/work/${slug}`, changeFrequency: "yearly" as const, priority: 0.6 })),
  ];
}
