import type { Metadata } from "next";

export const SITE_URL = "https://mecgmichigan.com";
export const SITE_NAME = "Michigan Engineering Consulting Group";
const SITE_DESCRIPTION = "Pro-bono, student-led consulting at the University of Michigan.";

export const PUBLIC_MARKETING_PATHS = ["/home", "/team", "/work", "/join", "/contact"];

export const PUBLIC_ROBOTS = { index: true, follow: true } satisfies Metadata["robots"];
const PRIVATE_ROBOTS = { index: false, follow: false } satisfies Metadata["robots"];

// Next replaces nested metadata objects rather than merging their fields.
// Each page supplies a complete social card. Explicit null delegates its image
// to colocated Next metadata files, whose generated route suffix is framework-owned.
export function marketingMetadata({ title, description, path, image = "/opengraph-image" }: {
  title: string;
  description: string;
  path: string;
  image?: string | null;
}): Metadata {
  const socialTitle = `${title} | MECG`;
  const imageAlt = image === "/opengraph-image" ? SITE_NAME : title;
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}${path}` },
    robots: PUBLIC_ROBOTS,
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: "en_US",
      title: socialTitle,
      description,
      url: `${SITE_URL}${path}`,
      ...(image === null ? {} : { images: [{ url: `${SITE_URL}${image}`, width: 1200, height: 630, alt: imageAlt }] }),
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description,
      ...(image === null ? {} : { images: [{ url: `${SITE_URL}${image}`, alt: imageAlt }] }),
    },
  };
}

export const MARKETING_METADATA = {
  team: marketingMetadata({
    title: "Our Team",
    description: "Meet the Michigan Engineering Consulting Group executive board.",
    path: "/team",
  }),
  work: marketingMetadata({
    title: "Client Services",
    description: "Partner with MECG on a semester-long, pro-bono consulting engagement.",
    path: "/work",
  }),
  join: marketingMetadata({
    title: "Join Our Team",
    description: "Explore MECG recruitment for University of Michigan students in every major. No previous consulting experience is required.",
    path: "/join",
  }),
  contact: marketingMetadata({
    title: "Contact Us",
    description: "Contact MECG about membership, a client project, or a general question.",
    path: "/contact",
  }),
} satisfies Record<string, Metadata>;

export const ROOT_METADATA: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_NAME, template: "%s | MECG" },
  description: SITE_DESCRIPTION,
  applicationName: "MECG",
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_US",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: SITE_NAME }],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: ["/opengraph-image"],
  },
  // Account, application, and token-bearing routes inherit this safe default.
  // The marketing route group explicitly opts its public pages into indexing.
  robots: PRIVATE_ROBOTS,
};

export const ORGANIZATION_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${SITE_URL}/#organization`,
  name: SITE_NAME,
  alternateName: "MECG",
  description: SITE_DESCRIPTION,
  url: `${SITE_URL}/home`,
  logo: `${SITE_URL}/logos/mecg-color.svg`,
  email: "mecg-board@umich.edu",
  sameAs: [
    "https://www.instagram.com/mecgmichigan",
    "https://www.linkedin.com/company/michigan-engineering-consulting-group",
  ],
};

export function marketingBreadcrumbs(items: readonly { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map(({ name, path }, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name,
      item: `${SITE_URL}${path}`,
    })),
  };
}
