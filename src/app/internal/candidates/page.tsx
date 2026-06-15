import React from "react";
import { createDemoAdminClient } from "@/lib/supabase/demo-admin";

export default async function CandidatesPage() {
  const supabase = createDemoAdminClient();

  const { data: applications } = await supabase
    .from("demo_applications")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="grid gap-7">
      <section>
        <p className="eyebrow">Applicants</p>
        <h2 className="font-display mt-4 text-5xl font-bold uppercase tracking-[-0.06em]">
          Applicant review queue.
        </h2>
        <p className="mt-4 text-white/54">
          Every submitted application appears here for internal review.
        </p>
      </section>

      <section className="grid gap-4">
        {(applications ?? []).map((app) => (
          <article key={app.id} className="panel rounded-[1.5rem] p-6">
            <div className="grid gap-4 md:grid-cols-[1fr_12rem_12rem] md:items-center">
              <div>
                <p className="text-sm font-bold text-[var(--orange)]">{app.status}</p>
                <h3 className="font-display mt-2 text-3xl font-bold uppercase tracking-[-0.05em]">
                  {app.full_name}
                </h3>
                <p className="mt-2 text-sm text-white/48">{app.email}</p>
              </div>
              <p className="text-white/58">{app.major || "Major TBD"}</p>
              <p className="text-white/58">{app.year || "Year TBD"}</p>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/38">Why MECG</p>
                <p className="mt-2 text-sm text-white/62">{app.why_mecg || "No response"}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/38">Teamwork</p>
                <p className="mt-2 text-sm text-white/62">{app.teamwork || "No response"}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/38">Problem Solving</p>
                <p className="mt-2 text-sm text-white/62">{app.problem_solving || "No response"}</p>
              </div>
            </div>
          </article>
        ))}

        {(applications ?? []).length === 0 ? (
          <p className="panel rounded-[1.5rem] p-6 text-white/48">
            No applications yet. Submit one from the applicant portal.
          </p>
        ) : null}
      </section>
    </div>
  );
}
