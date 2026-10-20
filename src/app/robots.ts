import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/member", "/applicant", "/apply", "/api", "/login", "/sign-up", "/forgot-password", "/reset-password", "/checkin", "/auth", "/access-denied"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
