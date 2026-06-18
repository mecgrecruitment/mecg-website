import React from "react";
import { createDemoAdminClient } from "@/lib/supabase/demo-admin";
import { requireInternalSession } from "@/lib/internal-portal/session";

export default async function ApplicantsPage() {
  await requireInternalSession();
  const supabase = createDemoAdminClient();

  const { data: applications } = await supabase
    .from("demo_applications")
    .select("id,full_name,email,year,major,status,recruitment_status,submitted_at,created_at")
    .order("created_at", { ascending: false });

  const { data: events } = await supabase
    .from("demo_events")
    .select("id,title,event_type,event_date,active")
    .eq("event_type", "Open Rush")
    .order("created_at", { ascending: true });

  const { data: checkins } = await supabase
    .from("demo_checkins")
    .select("email,event_id,event_name,created_at");

  const eventList = events ?? [];
  const checkinList = checkins ?? [];

  function attended(email: string, eventId: string) {
    return checkinList.some(
      (checkin) =>
        checkin.email?.toLowerCase() === email.toLowerCase() &&
        checkin.event_id === eventId
    );
  }

  function attendanceCount(email: string) {
    return eventList.filter((event) => attended(email, event.id)).length;
  }

  return (
    <div className="grid gap-8">
      <section className="panel-strong rounded-[2rem] p-7 md:p-10">
        <p className="eyebrow">Applicants</p>
        <h2 className="font-display mt-5 text-5xl font-bold uppercase tracking-[-0.07em] md:text-7xl">
          Candidate list.
        </h2>
        <p className="mt-5 text-white/58">
          View submissions, recruitment status, and attendance for each open rush event.
        </p>
      </section>

      <section className="panel overflow-x-auto rounded-[2rem] p-4">
        <table className="w-full min-w-[1100px] border-collapse text-sm">
          <thead className="text-left text-white/45">
            <tr>
              <th className="p-3">Name</th>
              <th className="p-3">Email</th>
              <th className="p-3">Year</th>
              <th className="p-3">Major</th>
              <th className="p-3">Recruitment Status</th>
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
            {(applications ?? []).map((app) => {
              const count = attendanceCount(app.email);

              return (
                <tr key={app.id} className="border-t border-white/10">
                  <td className="p-3 font-bold">{app.full_name}</td>
                  <td className="p-3 text-white/60">{app.email}</td>
                  <td className="p-3 text-white/60">{app.year}</td>
                  <td className="p-3 text-white/60">{app.major}</td>
                  <td className="p-3">
                    <span className="rounded-full border border-[var(--orange)]/30 bg-[var(--orange)]/10 px-3 py-1 text-xs font-bold text-[var(--orange-soft)]">
                      {app.recruitment_status || app.status || "submitted"}
                    </span>
                  </td>
                  <td className="p-3 text-white/70">
                    {count}/{eventList.length}
                  </td>

                  {eventList.map((event) => (
                    <td key={event.id} className="p-3">
                      {attended(app.email, event.id) ? (
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
                    {app.submitted_at ? new Date(app.submitted_at).toLocaleString() : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {(applications ?? []).length === 0 ? (
          <p className="p-4 text-white/45">No submitted applications yet.</p>
        ) : null}
      </section>
    </div>
  );
}
