import React from "react";
import { applicantLogout } from "../actions";
import { submitApplicantCheckin } from "../checkin/actions";
import { submitDemoApplication } from "../application/actions";
import { SubmitButton } from "../SubmitButton";
import {
  getSubmittedApplication,
  requireApplicantSession,
} from "@/lib/applicant-portal/session";
import { createDemoAdminClient } from "@/lib/supabase/demo-admin";

type SearchParams = {
  checkin_error?: string;
  checkin_success?: string;
  application_error?: string;
  submitted?: string;
};

function Notice({
  type,
  children,
}: {
  type: "success" | "error";
  children: React.ReactNode;
}) {
  const classes =
    type === "success"
      ? "border-[var(--orange)]/40 bg-[var(--orange)]/10 text-[var(--orange-soft)]"
      : "border-red-400/30 bg-red-400/10 text-red-100";

  return <div className={`rounded-[1.5rem] border p-5 ${classes}`}>{children}</div>;
}

export default async function ApplicantDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const session = await requireApplicantSession();
  const params = await searchParams;
  const submittedApplication = await getSubmittedApplication(session.email);

  if (submittedApplication) {
    return (
      <div className="grid gap-8">
      <div className="mb-6">
        <a
          href="/"
          className="inline-flex rounded-full border border-white/15 px-4 py-2 text-xs font-extrabold uppercase tracking-[0.14em] text-white/60 transition hover:border-[var(--orange)] hover:text-white"
        >
          ← Back to Main Website
        </a>
      </div>

        <section className="panel-strong rounded-[2rem] p-7 md:p-10">
          <p className="eyebrow">Application Submitted</p>
          <h2 className="font-display mt-5 max-w-4xl text-5xl font-bold uppercase leading-[0.9] tracking-[-0.07em] md:text-7xl">
            Thank you.
          </h2>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-white/68">
            Thank you for submitting your MECG application. Your application has been received. No further action is needed at this time.
          </p>
          <p className="mt-4 text-sm text-white/45">
            Logged in as {session.email}
          </p>

          <form action={applicantLogout} className="mt-8">
            <button className="rounded-full border border-white/15 px-6 py-4 text-xs font-extrabold uppercase tracking-[0.16em] text-white/70 transition hover:border-[var(--orange)] hover:text-white">
              Logout
            </button>
          </form>
        </section>
      </div>
    );
  }

  const supabase = createDemoAdminClient();

  const { data: openRushEvents } = await supabase
    .from("demo_events")
    .select("id,title,event_date,location")
    .eq("active", true)
    .eq("event_type", "Open Rush")
    .order("event_date", { ascending: true });

  const openRushIds = (openRushEvents ?? []).map((event) => event.id);

  const { data: checkins } = openRushIds.length
    ? await supabase
        .from("demo_checkins")
        .select("id,event_id,event_name,created_at")
        .eq("email", session.email)
        .in("event_id", openRushIds)
        .order("created_at", { ascending: false })
    : { data: [] };

  const checkedEventIds = new Set((checkins ?? []).map((checkin) => checkin.event_id));
  const attendanceCount = checkedEventIds.size;
  const attendanceTotal = openRushEvents?.length ?? 0;

  return (
    <div className="grid gap-8">
      <section className="panel-strong rounded-[2rem] p-7 md:p-10">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-start">
          <div>
            <p className="eyebrow">Applicant Dashboard</p>
            <h2 className="font-display mt-5 max-w-4xl text-5xl font-bold uppercase leading-[0.9] tracking-[-0.07em] md:text-7xl">
              Welcome{session.fullName ? `, ${session.fullName.split(" ")[0]}` : ""}.
            </h2>
            <p className="mt-6 max-w-2xl text-white/58">
              Your email is saved from login and will be used automatically.
            </p>
          </div>

          <form action={applicantLogout}>
            <button className="rounded-full border border-white/15 px-5 py-3 text-xs font-extrabold uppercase tracking-[0.16em] text-white/70 transition hover:border-[var(--orange)] hover:text-white">
              Logout
            </button>
          </form>
        </div>
      </section>

      {params?.checkin_success ? <Notice type="success">{params.checkin_success}</Notice> : null}
      {params?.checkin_error ? <Notice type="error">{params.checkin_error}</Notice> : null}
      {params?.application_error ? <Notice type="error">{params.application_error}</Notice> : null}

      <section className="grid gap-5 md:grid-cols-3">
        <article className="panel rounded-[1.5rem] p-6">
          <p className="eyebrow">Profile</p>
          <p className="mt-5 text-sm text-white/40">Name</p>
          <p className="mt-1 text-xl font-bold">{session.fullName || "Not added yet"}</p>
          <p className="mt-5 text-sm text-white/40">Email</p>
          <p className="mt-1 break-all text-xl font-bold">{session.email}</p>
        </article>

        <article className="panel rounded-[1.5rem] p-6">
          <p className="eyebrow">Open Rush Attendance</p>
          <p className="mt-5 text-5xl font-black">
            {attendanceCount}/{attendanceTotal}
          </p>
          <p className="mt-3 text-sm text-white/50">
            Only open rush events count here.
          </p>
        </article>

        <article className="panel rounded-[1.5rem] p-6">
          <p className="eyebrow">Application</p>
          <p className="mt-5 text-2xl font-black">Not submitted</p>
          <p className="mt-3 text-sm text-white/50">
            Once submitted, this dashboard will lock.
          </p>
        </article>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <article className="panel rounded-[2rem] p-6 md:p-8">
          <p className="eyebrow">Event Check-In</p>
          <h3 className="font-display mt-4 text-4xl font-bold uppercase tracking-[-0.05em]">
            Enter open rush code.
          </h3>
          <p className="mt-4 text-sm leading-6 text-white/52">
            Only enter the event phrase. Your email is already attached to your session.
          </p>

          <form action={submitApplicantCheckin} className="mt-6 grid gap-4">
            <label className="grid gap-2">
              <span className="text-sm font-bold">Event phrase</span>
              <input
                name="event_phrase"
                required
                placeholder="Example: BLUEGEAR"
                className="rounded-xl border border-white/10 bg-white/[0.04] p-4 uppercase outline-none focus:border-[var(--orange)]"
              />
            </label>

            <SubmitButton pendingText="Checking in...">
              Check In
            </SubmitButton>
          </form>

          <div className="mt-8">
            <p className="text-sm font-bold text-white">Your open rush check-ins</p>
            {(checkins ?? []).length > 0 ? (
              <ul className="mt-3 grid gap-2 text-sm text-white/55">
                {(checkins ?? []).map((checkin) => (
                  <li key={checkin.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    {checkin.event_name || "Open Rush Event"} · {new Date(checkin.created_at).toLocaleString()}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-white/40">No open rush check-ins yet.</p>
            )}
          </div>
        </article>

        <article className="panel rounded-[2rem] p-6 md:p-8">
          <p className="eyebrow">Application Submission</p>
          <h3 className="font-display mt-4 text-4xl font-bold uppercase tracking-[-0.05em]">
            Submit once.
          </h3>
          <p className="mt-4 text-sm leading-6 text-white/52">
            After you submit, the portal will only show the thank you screen.
          </p>

          <form action={submitDemoApplication} className="mt-6 grid gap-4">
            <label className="grid gap-2">
              <span className="text-sm font-bold">Full name</span>
              <input
                name="full_name"
                required
                defaultValue={session.fullName || ""}
                className="rounded-xl border border-white/10 bg-white/[0.04] p-4 outline-none focus:border-[var(--orange)]"
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-bold">Year</span>
                <input
                  name="year"
                  required
                  placeholder="2028"
                  className="rounded-xl border border-white/10 bg-white/[0.04] p-4 outline-none focus:border-[var(--orange)]"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-bold">Major</span>
                <input
                  name="major"
                  required
                  placeholder="IOE, Data Science, etc."
                  className="rounded-xl border border-white/10 bg-white/[0.04] p-4 outline-none focus:border-[var(--orange)]"
                />
              </label>
            </div>

            <label className="grid gap-2">
              <span className="text-sm font-bold">Resume</span>
              <input
                name="resume"
                type="file"
                className="rounded-xl border border-white/10 bg-white/[0.04] p-4 outline-none focus:border-[var(--orange)]"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-bold">Why MECG?</span>
              <textarea name="why_mecg" required rows={4} className="rounded-xl border border-white/10 bg-white/[0.04] p-4 outline-none focus:border-[var(--orange)]" />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-bold">Tell us about a time you worked on a team.</span>
              <textarea name="teamwork" required rows={4} className="rounded-xl border border-white/10 bg-white/[0.04] p-4 outline-none focus:border-[var(--orange)]" />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-bold">Tell us about a time you solved a problem.</span>
              <textarea name="problem_solving" required rows={4} className="rounded-xl border border-white/10 bg-white/[0.04] p-4 outline-none focus:border-[var(--orange)]" />
            </label>

            <SubmitButton pendingText="Submitting...">
              Submit Application
            </SubmitButton>
          </form>
        </article>
      </section>
    </div>
  );
}
