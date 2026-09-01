import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/home", "/team", "/work", "/join", "/contact"],
      disallow: ["/admin", "/member", "/applicant", "/apply", "/api", "/login", "/forgot-password", "/reset-password", "/checkin", "/auth"],
    },
    sitemap: "https://mecgmichigan.com/sitemap.xml",
  };
}
