import { PUBLIC_PROJECTS } from "@/content/projects.public";
import type { PublicProjectCard, PublicProjectDetail } from "./public-types";

export function listPublicProjectCards(): readonly PublicProjectCard[] {
  return PUBLIC_PROJECTS;
}

export function getPublicProject(slug: string): PublicProjectDetail | undefined {
  return PUBLIC_PROJECTS.find((project) => project.slug === slug);
}

export function getFeaturedPublicProject(): PublicProjectDetail | undefined {
  return PUBLIC_PROJECTS[0];
}

export function getPublicProjectSlugs(): readonly string[] {
  return PUBLIC_PROJECTS.map((project) => project.slug);
}
