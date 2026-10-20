import type { MetadataRoute } from "next";
import { getPublicProjectSlugs } from "@/lib/projects/public-projects";
import { PUBLIC_MARKETING_PATHS, SITE_URL } from "@/lib/seo";

export const revalidate = 60;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return [
    ...PUBLIC_MARKETING_PATHS.map((path) => ({ url: `${SITE_URL}${path}` })),
    ...(await getPublicProjectSlugs()).map((slug) => ({ url: `${SITE_URL}/work/${slug}` })),
  ];
}
