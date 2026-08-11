import React from "react";
import { createClient } from "@/lib/supabase/server";
import { requireBoard } from "@/lib/auth";

function pretty(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

type AuditActor = { full_name: string | null; email: string };

export default async function AuditPage({
  searchParams,
}: {
  searchParams?: Promise<{ action?: string; entity?: string }>;
}) {
  await requireBoard();
  const params = await searchParams;
  const actionFilter = params?.action?.trim() ?? "";
  const entityFilter = params?.entity?.trim().toLowerCase() ?? "";
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("audit_log")
    .select(
      "id, created_at, action, entity_type, entity_id, before_state, after_state, actor:members(full_name, email)"
    )
    .order("created_at", { ascending: false })
    .limit(250);

  const rows = (data ?? []).filter((row) => {
    const matchesAction = !actionFilter || row.action === actionFilter;
    const matchesEntity =
      !entityFilter ||
      row.entity_type.toLowerCase().includes(entityFilter) ||
      row.entity_id.toLowerCase().includes(entityFilter);
    return matchesAction && matchesEntity;
  });

  const actions = [...new Set((data ?? []).map((row) => row.action))].sort();

  return (
    <div className="grid gap-8">
      <section className="panel-strong rounded-[2rem] p-7 md:p-10">
        <p className="eyebrow">Board Audit Log</p>
        <h2 className="font-display mt-5 text-5xl font-bold uppercase tracking-[-0.07em] md:text-7xl">
          Recruitment history.
        </h2>
        <p className="mt-5 max-w-2xl text-white/58">
          Read-only history of access, scoring, voting, decisions, and candidate changes.
        </p>
      </section>

      <form method="get" className="panel grid gap-4 rounded-[2rem] p-6 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <label className="grid gap-2 text-sm font-bold">
          Action
          <select name="action" defaultValue={actionFilter} className="rounded-xl border border-white/10 bg-[var(--navy-900)] p-3">
            <option value="">All actions</option>
            {actions.map((action) => (
              <option key={action} value={action}>{pretty(action)}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-bold">
          Entity type or ID
          <input name="entity" defaultValue={entityFilter} className="portal-field focus-ring" placeholder="candidate, score, UUID…" />
        </label>
        <button className="rounded-full bg-[var(--orange)] px-6 py-3 text-xs font-black uppercase tracking-[0.14em] text-white">
          Filter
        </button>
      </form>

      {error ? (
        <p className="rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-red-100">
          Could not load the audit log: {error.message}
        </p>
      ) : (
        <section className="panel overflow-x-auto rounded-[2rem] p-4">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="text-left text-white/45">
              <tr>
                <th className="p-3">Time</th>
                <th className="p-3">Actor</th>
                <th className="p-3">Action</th>
                <th className="p-3">Entity</th>
                <th className="p-3">Change</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const relation = row.actor as AuditActor | AuditActor[] | null;
                const actor = Array.isArray(relation) ? relation[0] : relation;
                return (
                  <tr key={row.id} className="border-t border-white/10 align-top">
                    <td className="whitespace-nowrap p-3 text-white/55">
                      {new Date(row.created_at).toLocaleString()}
                    </td>
                    <td className="p-3">
                      <p className="font-bold">{actor?.full_name ?? "System"}</p>
                      {actor?.email ? <p className="text-xs text-white/40">{actor.email}</p> : null}
                    </td>
                    <td className="p-3 font-bold text-[var(--orange-soft)]">{pretty(row.action)}</td>
                    <td className="p-3">
                      <p>{pretty(row.entity_type)}</p>
                      <p className="mt-1 font-mono text-xs text-white/35">{row.entity_id}</p>
                    </td>
                    <td className="p-3">
                      <details>
                        <summary className="cursor-pointer font-bold text-white/65">View record</summary>
                        <pre className="mt-3 max-w-xl overflow-auto whitespace-pre-wrap rounded-xl bg-black/20 p-3 text-xs text-white/55">
                          {JSON.stringify({ before: row.before_state, after: row.after_state }, null, 2)}
                        </pre>
                      </details>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length === 0 ? <p className="p-4 text-white/45">No matching audit entries.</p> : null}
        </section>
      )}
    </div>
  );
}
