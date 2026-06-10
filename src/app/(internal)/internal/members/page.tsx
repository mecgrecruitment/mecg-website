import { createClient } from "../../../../lib/supabase/server";

// /internal/* is never cached (NFR-21).
export const dynamic = "force-dynamic";

const roleLabels = {
  board: "Board",
  recruitment_committee: "Recruitment Committee",
  general_member: "General Member",
} as const;

export default async function MembersPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // RLS scopes this to: own row + is_public rows (general members) or all
  // rows (committee/board). The layout already guarantees a members row exists.
  const { data: members } = await supabase
    .from("members")
    .select("id, user_id, full_name, role, year, major, email")
    .is("deleted_at", null)
    .order("full_name");

  const me = members?.find((m) => m.user_id === user?.id);

  return (
    <div className="grid gap-7">
      <section className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
        <aside className="panel-strong rounded-panel p-7">
          <p className="eyebrow">Member profile</p>
          <h2 className="font-display mt-4 text-5xl font-bold uppercase tracking-[-0.06em]">
            {me?.full_name ?? "—"}
          </h2>
          <p className="mt-4 text-white/54">
            {me ? roleLabels[me.role] : "—"}
            {me?.major ? ` · ${me.major}` : ""}
            {me?.year ? ` · ${me.year}` : ""}
          </p>
          <button className="mt-7 rounded-pill bg-accent px-5 py-3 text-xs font-extrabold uppercase tracking-[0.16em]">
            Edit profile
          </button>
        </aside>

        <div className="panel rounded-panel p-7">
          <p className="eyebrow">Directory</p>
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {(members ?? []).map((member) => (
              <article
                key={member.id}
                className="rounded-card border border-rule p-4"
              >
                <h3 className="font-bold">{member.full_name}</h3>
                <p className="mt-1 text-sm text-white/44">
                  {roleLabels[member.role]}
                </p>
              </article>
            ))}
            {(members ?? []).length === 0 && (
              <p className="text-sm text-white/44">No members visible.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
