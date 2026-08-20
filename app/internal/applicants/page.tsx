import React from "react";
import { createClient } from "@/lib/supabase/server";
import { requireCommittee } from "@/lib/auth";

function pretty(value: string | null | undefined) {
  if (!value) return "—";
  return value.replaceAll("_", " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

export default async function ApplicantsPage() {
  await requireCommittee();
  const supabase = await createClient();

  const { data: cycle, error: cycleError } = await supabase
    .from("recruitment_cycles")
    .select("id, name")
    .eq("is_active", true)
    .maybeSingle();

  if (cycleError) {
    return (
      <p className="rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-red-100">
        Could not load recruitment cycle: {cycleError.message}
      </p>
    );
  }

  const [candidateResult, eventResult, checkinResult] = await Promise.all([
    cycle
      ? supabase
          .from("candidates")
          .select("id, per_cycle_seq, full_name, email, year, major, current_stage, status, created_at")
          .eq("cycle_id", cycle.id)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as never[], error: null }),
    cycle
      ? supabase
          .from("recruitment_events")
          .select("id, title")
          .eq("cycle_id", cycle.id)
          .eq("event_type", "open_rush")
          .order("event_date", { ascending: true })
      : Promise.resolve({ data: [] as never[], error: null }),
    supabase.from("event_checkins").select("email, event_id"),
  ]);

  if (candidateResult.error) {
    return (
      <p className="rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-red-100">
        Could not load applicants: {candidateResult.error.message}
      </p>
    );
  }

  const candidates = candidateResult.data;
  const events = eventResult.data;
  const checkins = checkinResult.data;

  const eventList = events ?? [];
  const checkinList = checkins ?? [];

  function attended(email: string | null, eventId: string) {
    if (!email) return false;
    return checkinList.some(
      (ck) => ck.email?.toLowerCase() === email.toLowerCase() && ck.event_id === eventId
    );
  }
  function attendanceCount(email: string | null) {
    return eventList.filter((e) => attended(email, e.id)).length;
  }

  return (
    <div className="grid gap-8">
      <section className="panel-strong rounded-[2rem] p-7 md:p-10">
        <p className="eyebrow">Applicants</p>
        <h2 className="font-display mt-5 text-5xl font-bold uppercase tracking-[-0.07em] md:text-7xl">
          Candidate list.
        </h2>
        <p className="mt-5 text-white/58">
          Submissions, current stage, and open-rush attendance for the active cycle.
        </p>
        {cycle ? (
          <p className="mt-3 font-mono text-xs uppercase tracking-[0.14em] text-white/40">
            Active cycle · {cycle.name ?? cycle.id}
          </p>
        ) : null}
      </section>

      {!cycle ? (
        <p className="rounded-xl border border-amber-300/20 bg-amber-400/5 p-4 text-sm text-amber-100/85">
          No active recruitment cycle. Applicant rows appear here once the board activates a
          cycle and applications come in.
        </p>
      ) : (
        <section className="panel overflow-x-auto rounded-[2rem] p-4">
          <table className="w-full min-w-[1100px] border-collapse text-sm">
            <thead className="text-left text-white/45">
              <tr>
                <th className="p-3">#</th>
                <th className="p-3">Name</th>
                <th className="p-3">Email</th>
                <th className="p-3">Year</th>
                <th className="p-3">Major</th>
                <th className="p-3">Stage</th>
                <th className="p-3">Status</th>
                <th className="p-3">Attendance</th>
                {eventList.map((event) => (
                  <th key={event.id} className="p-3">
                    {event.title}
                  </th>
                ))}
                <th className="p-3">Submitted</th>
              </tr>
            </thead>

            <tbody>
              {(candidates ?? []).map((c) => {
                const count = attendanceCount(c.email);
                return (
                  <tr key={c.id} className="border-t border-white/10">
                    <td className="p-3 font-mono text-white/45">
                      C{String(c.per_cycle_seq).padStart(2, "0")}
                    </td>
                    <td className="p-3 font-bold">{c.full_name}</td>
                    <td className="p-3 text-white/60">{c.email}</td>
                    <td className="p-3 text-white/60">{c.year}</td>
                    <td className="p-3 text-white/60">{c.major}</td>
                    <td className="p-3">
                      <span className="rounded-full border border-[var(--orange)]/30 bg-[var(--orange)]/10 px-3 py-1 text-xs font-bold text-[var(--orange-soft)]">
                        {pretty(c.current_stage)}
                      </span>
                    </td>
                    <td className="p-3 text-white/60">{pretty(c.status)}</td>
                    <td className="p-3 text-white/70">
                      {count}/{eventList.length}
                    </td>

                    {eventList.map((event) => (
                      <td key={event.id} className="p-3">
                        {attended(c.email, event.id) ? (
                          <span className="rounded-full border border-green-300/30 bg-green-400/10 px-3 py-1 text-xs font-bold text-green-100">
                            Yes
                          </span>
                        ) : (
                          <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-bold text-white/35">
                            No
                          </span>
                        )}
                      </td>
                    ))}

                    <td className="p-3 text-white/60">
                      {c.created_at ? new Date(c.created_at).toLocaleString() : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {(candidates ?? []).length === 0 ? (
            <p className="p-4 text-white/45">
              No applications in this cycle yet. New /apply submissions show up here.
            </p>
          ) : null}
        </section>
      )}
    </div>
  );
}
