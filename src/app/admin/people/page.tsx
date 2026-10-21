import { withWorkspaceCycle } from "@/lib/workspace-cycle-url";
import type { Metadata } from "next";
import Link from "@/components/workspace-link";
import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";
import { selectWorkspaceCycle } from "@/lib/workspace-cycle";
import { createClient } from "@/lib/supabase/server";
import WorkspaceHeader from "@/components/workspace-header";
import WorkspaceNav from "@/components/workspace-nav";
import { PeopleControls } from "../rush-controls";
import { duplicateAccountIdsFor, memberAccountsFor } from "../member-accounts";
import { cycleStatusLabel } from "@/lib/labels";
import { onboardingRpc } from "@/app/applicant/onboarding-data";
import BoardOnboarding, { type BoardOnboardingItem } from "./onboarding";
import PeopleDirectory from "./directory";
import PeopleWorkspace from "./people-workspace";
import { type DirectoryEntry } from "./directory-model";
import { BOARD } from "@/lib/site-content";

export const metadata: Metadata = { title: "People" };

const BOARD_NAME_ALIASES: Record<string, string> = {
  abigailosterhart: "abbyosterhart",
  anacallam: "anniecallam",
};

const normalizedName = (value: string) => value.toLocaleLowerCase().replace(/[^a-z0-9]/g, "");

function publicBoardProfile(name: string, roles: string[]) {
  if (!roles.some((role) => role === "BOARD" || role === "OWNER")) return null;
  const original = normalizedName(name);
  const key = BOARD_NAME_ALIASES[original] ?? original;
  return BOARD.find((person) => normalizedName(person.name) === key) ?? null;
}

function parseDirectory(value: unknown): DirectoryEntry[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const row = entry as Record<string, unknown>;
    if (typeof row.id !== "string" || typeof row.name !== "string") return [];
    const text = (field: unknown) => (typeof field === "string" ? field : "");
    const roles = Array.isArray(row.roles) ? row.roles.filter((role): role is string => typeof role === "string") : [];
    const publicProfile = publicBoardProfile(row.name, roles);
    return [{
      id: row.id,
      name: row.name,
      gradTerm: text(row.gradTerm),
      major: text(row.major),
      position: text(row.position),
      bio: text(row.bio),
      roles,
      imageSrc: publicProfile?.src,
      linkedin: publicProfile?.linkedin,
    }];
  });
}

function parseOnboarding(value: unknown): BoardOnboardingItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const row = entry as Record<string, unknown>;
    if (typeof row.applicationId !== "string" || typeof row.applicantName !== "string" || typeof row.key !== "string") return [];
    const optional = (field: unknown) => typeof field === "string" ? field : null;
    return [{ applicationId: row.applicationId, applicantName: row.applicantName, contact: optional(row.contact) ?? "", key: row.key, ownerId: optional(row.ownerId), ownerName: optional(row.ownerName), completedAt: optional(row.completedAt), completedByName: optional(row.completedByName) }];
  });
}

export default async function PeoplePage() {
  // Any member may read the directory. Only MANAGE_MEMBERSHIPS gets the role
  // controls below it, so this is one page with two audiences rather than a
  // second near-identical page for the read-only case.
  const user = await requireMember();
  const cycleId = await selectWorkspaceCycle(user.memberships, "WORKSPACE_ACCESS");
  if (!cycleId) redirect("/member");
  const canManage = hasPermission(user.memberships, cycleId, "MANAGE_MEMBERSHIPS");
  const canOnboard = user.memberships.some((membership) => membership.active && membership.cycleId === cycleId && ["BOARD", "OWNER"].includes(membership.role));
  const supabase = await createClient();
  const [cycleResult, membersResult, directoryResult] = await Promise.all([
    supabase.from("rush_cycles").select("id,name,status").eq("id", cycleId).single(),
    canManage
      ? supabase.from("memberships").select("id,user_id,role,active,profiles!inner(display_name,primary_email)").eq("cycle_id", cycleId)
      : Promise.resolve({ data: [], error: null }),
    supabase.rpc("cycle_directory", { target_cycle_id: cycleId }),
  ]);
  if (cycleResult.error) throw cycleResult.error;
  if (membersResult.error) throw membersResult.error;
  if (directoryResult.error) throw directoryResult.error;
  const cycle = cycleResult.data;
  if (!cycle) redirect("/member");
  const directory = parseDirectory(directoryResult.data);
  const onboardingResult = canOnboard ? await onboardingRpc<unknown>(supabase, "cycle_member_onboarding", { target_cycle_id: cycleId }) : { data: [], error: null };
  if (onboardingResult.error) console.error("cycle member onboarding failed", onboardingResult.error);
  const onboarding = parseOnboarding(onboardingResult.data);
  const memberRows = membersResult.data ?? [];
  const memberAccounts = memberAccountsFor(memberRows);
  const duplicateAccountIds = duplicateAccountIdsFor(memberRows);

  return (
    <main className="workspace-stack mx-auto flex max-w-5xl flex-col">
      <WorkspaceHeader
        eyebrow={`${cycle.name} · ${cycleStatusLabel(cycle.status)}`}
        title="People"
        description="Who is on the team this cycle."
      />
      <WorkspaceNav user={user} cycleId={cycleId} current="/admin/people" />

      {canManage && <Link href={withWorkspaceCycle(`/admin/provisioning?cycleId=${encodeURIComponent(cycleId)}`, cycleId)} className="text-sm font-semibold text-mecg-navy underline underline-offset-4">Review account setup incidents</Link>}

      <PeopleWorkspace
        directory={<PeopleDirectory directory={directory} currentUserId={user.id} canManage={canManage} duplicateAccountIds={duplicateAccountIds} />}
        directoryCount={directory.length}
        onboardingCount={new Set(onboarding.map((item) => item.applicationId)).size}
        duplicateAccountCount={duplicateAccountIds.length}
        onboarding={canOnboard ? <BoardOnboarding cycleId={cycleId} initialItems={onboarding} owners={directory.map(({ id, name }) => ({ id, name }))} loadError={Boolean(onboardingResult.error)} /> : undefined}
        access={canManage ? <PeopleControls cycleId={cycleId} currentUserId={user.id} memberAccounts={memberAccounts} duplicateAccountIds={duplicateAccountIds} /> : undefined}
      />
    </main>
  );
}
