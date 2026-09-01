import { createClient } from "@supabase/supabase-js";
import { PUBLIC_PROJECTS } from "@/content/projects.public";
import { getSupabasePublicEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";
import type { PublicProjectCard, PublicProjectDetail } from "./public-types";

// Projects now live in rush.projects. src/content/projects.public.ts stays as
// the fallback so the marketing site keeps rendering before the table is
// seeded, and so a database outage degrades to last-known content rather than
// an empty Work page.
//
// Same client construction as the join page: built here rather than through
// lib/supabase/server so it never touches cookies(), which is the only thing
// that would force these pages out of the ISR cache.
function readClient() {
  // getSupabasePublicEnv, not requireEnv: it resolves the MECG_-prefixed names
  // this deployment actually uses and falls back to the plain ones. Reading a
  // single hard-coded name here would throw during prerender wherever only the
  // prefixed pair is set, which includes CI.
  const { url, anonKey } = getSupabasePublicEnv();
  return createClient<Database, "rush">(url, anonKey, {
    db: { schema: "rush" },
    auth: { persistSession: false },
  });
}

function textOf(value: unknown) {
  return typeof value === "string" ? value : "";
}

function listOf(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function parseProjects(value: unknown): readonly PublicProjectDetail[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): PublicProjectDetail[] => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const row = entry as Record<string, unknown>;
    if (typeof row.slug !== "string" || !row.slug || typeof row.title !== "string" || !row.title) return [];
    return [{
      slug: row.slug,
      title: row.title,
      clientLabel: textOf(row.clientLabel),
      industry: textOf(row.industry),
      semester: textOf(row.semester),
      decision: textOf(row.decision),
      methods: listOf(row.methods),
      deliverables: listOf(row.deliverables),
      context: textOf(row.context),
      constraints: listOf(row.constraints),
      handoff: textOf(row.handoff) || undefined,
      memberWork: listOf(row.memberWork),
    }];
  });
}

async function loadProjects(): Promise<readonly PublicProjectDetail[]> {
  try {
    const { data, error } = await readClient().rpc("public_projects");
    if (error) {
      console.error("public_projects failed", error);
      return PUBLIC_PROJECTS;
    }
    const projects = parseProjects(data);
    return projects.length ? projects : PUBLIC_PROJECTS;
  } catch (loadError) {
    console.error("public_projects unavailable", loadError);
    return PUBLIC_PROJECTS;
  }
}

export async function listPublicProjectCards(): Promise<readonly PublicProjectCard[]> {
  return loadProjects();
}

export async function getPublicProject(slug: string): Promise<PublicProjectDetail | undefined> {
  return (await loadProjects()).find((project) => project.slug === slug);
}

export async function getFeaturedPublicProject(): Promise<PublicProjectDetail | undefined> {
  return (await loadProjects())[0];
}

export async function getPublicProjectSlugs(): Promise<readonly string[]> {
  return (await loadProjects()).map((project) => project.slug);
}
