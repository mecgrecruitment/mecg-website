// Absolute origin used by metadataBase, the sitemap, and robots.txt.
// NEXT_PUBLIC_SITE_URL is already the deploy-origin var (see app/auth/actions.ts).
export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.mecgmichigan.com";
