import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { hasPermission } from "@/lib/authorization";
import { selectAuthorizedCycleId } from "@/lib/cycles";
import { createClient } from "@/lib/supabase/server";
import WorkspaceHeader from "@/components/workspace-header";
import WorkspaceNav from "@/components/workspace-nav";
import { PeopleControls } from "../rush-controls";
import { memberAccountsFor } from "../member-accounts";

export const metadata: Metadata = { title: "People" };

type DirectoryEntry = {
  id: string;
  name: string;
  gradTerm: string;
  major: string;
  position: string;
  bio: string;
  roles: string[];
};

function parseDirectory(value: unknown): DirectoryEntry[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const row = entry as Record<string, unknown>;
    if (typeof row.id !== "string" || typeof row.name !== "string") return [];
    const text = (field: unknown) => (typeof field === "string" ? field : "");
    return [{
      id: row.id,
      name: row.name,
      gradTerm: text(row.gradTerm),
      major: text(row.major),
      position: text(row.position),
      bio: text(row.bio),
      roles: Array.isArray(row.roles) ? row.roles.filter((role): role is string => typeof role === "string") : [],
    }];
  });
}

export default async function PeoplePage() {
  // Any member may read the directory. Only MANAGE_MEMBERSHIPS gets the role
  // controls below it, so this is one page with two audiences rather than a
  // second near-identical page for the read-only case.
  const user = await requireMember();
  const cycleId = selectAuthorizedCycleId(user.memberships, "WORKSPACE_ACCESS");
  if (!cycleId) redirect("/member");
  const canManage = hasPermission(user.memberships, cycleId, "MANAGE_MEMBERSHIPS");
  const supabase = await createClient();
  const [cycleResult, membersResult, directoryResult] = await Promise.all([
    supabase.from("rush_cycles").select("id,name,status").eq("id", cycleId).single(),
    canManage
      ? supabase.from("memberships").select("id,user_id,role,active,profiles!inner(display_name)").eq("cycle_id", cycleId)
      : Promise.resolve({ data: [], error: null }),
    supabase.rpc("cycle_directory", { target_cycle_id: cycleId }),
  ]);
  if (cycleResult.error) throw cycleResult.error;
  if (membersResult.error) throw membersResult.error;
  if (directoryResult.error) console.error("cycle_directory failed", directoryResult.error);
  const cycle = cycleResult.data;
  if (!cycle) redirect("/member");
  const directory = parseDirectory(directoryResult.data);

  return (
    <main className="workspace-stack mx-auto flex max-w-5xl flex-col p-6 sm:p-10">
      <WorkspaceHeader
        eyebrow={`${cycle.name} · ${cycle.status}`}
        title="People"
        description="Who is on the team this cycle."
      />
      <WorkspaceNav user={user} cycleId={cycleId} current="/admin/people" />

      <section>
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-mecg-navy/50">Directory</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {directory.map((person) => (
            <article key={person.id} className="rounded-2xl bg-paper p-4">
              <p className="text-[15px] font-semibold text-mecg-navy">{person.name}</p>
              {person.position && <p className="mt-0.5 text-[13px] text-mecg-navy/60">{person.position}</p>}
              <p className="mt-1.5 text-[12px] text-mecg-navy/45">
                {[person.major, person.gradTerm].filter(Boolean).join(" · ") || "No details yet"}
              </p>
              {person.bio && <p className="mt-2 text-[13px] leading-5 text-mecg-navy/65">{person.bio}</p>}
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {person.roles.map((role) => (
                  <span key={role} className="inline-flex items-center rounded-full bg-white px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-mecg-navy/55 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.12)]">
                    {role.replaceAll("_", " ")}
                  </span>
                ))}
              </div>
            </article>
          ))}
          {!directory.length && (
            <p className="rounded-2xl border-[1.5px] border-dashed border-mecg-navy/[0.14] p-6 text-sm text-mecg-navy/55 sm:col-span-2 lg:col-span-3">
              Nobody has filled in a profile yet. Members can add theirs from the Evaluation Hub.
            </p>
          )}
        </div>
      </section>

      {canManage && (
        <PeopleControls
          cycleId={cycleId}
          currentUserId={user.id}
          memberAccounts={memberAccountsFor(membersResult.data ?? [])}
        />
      )}
    </main>
  );
}
