import type { MetadataRoute } from "next";
import { siteUrl } from "./site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/internal",
        "/internal/",
        "/apply",
        "/apply/",
        "/portal",
        "/portal/",
        "/auth",
        "/auth/",
        "/member-login",
        "/member-login/",
        "/api",
        "/api/",
      ],
    },
    sitemap: new URL("/sitemap.xml", siteUrl).toString(),
  };
}
