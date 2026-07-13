import React from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireApplicant } from "@/lib/auth";
import { logout } from "../../auth/actions";
import { submitApplicantCheckin } from "../checkin/actions";
import { submitApplication } from "../application/actions";
import { SubmitButton } from "../SubmitButton";

type SearchParams = {
  checkin_error?: string;
  checkin_success?: string;
  application_error?: string;
  submitted?: string;
};

function Notice({ type, children }: { type: "success" | "error"; children: React.ReactNode }) {
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
  const applicant = await requireApplicant();
  const params = await searchParams;
  const supabase = await createClient();

  const { data: appRows } = await supabase.rpc("my_application");
  const application = Array.isArray(appRows) ? appRows[0] : null;

  const { data: membershipRequest } = await supabase
    .from("membership_requests")
    .select("status")
    .eq("user_id", applicant.id)
    .maybeSingle();

  const MEMBERSHIP_STATUS_COPY: Record<string, string> = {
    pending: "Your board membership request is pending review. We'll email you once it's decided.",
    approved: "Your board membership request was approved — log out and back in to enter the member portal.",
    denied: "Your board membership request wasn't approved.",
  };

  const membershipBanner = membershipRequest ? (
    <div className="rounded-[1.5rem] border border-[var(--orange)]/40 bg-[var(--orange)]/10 p-5 text-white/80">
      {MEMBERSHIP_STATUS_COPY[membershipRequest.status]}{" "}
      <a href="/auth/request-access" className="underline hover:text-white">
        View request status.
      </a>
    </div>
  ) : null;

  // Locked "thank you" view once an application exists for this cycle.
  if (application) {
    return (
      <div className="grid gap-8">
        {membershipBanner}
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex rounded-full border border-white/15 px-4 py-2 text-xs font-extrabold uppercase tracking-[0.14em] text-white/60 transition hover:border-[var(--orange)] hover:text-white"
          >
            ← Back to Main Website
          </Link>
        </div>

        <section className="panel-strong rounded-[2rem] p-7 md:p-10">
          <p className="eyebrow">Application Submitted</p>
          <h2 className="font-display mt-5 max-w-4xl text-5xl font-bold uppercase leading-[0.9] tracking-[-0.07em] md:text-7xl">
            Thank you.
          </h2>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-white/68">
            Your MECG application has been received. No further action is needed at this time.
          </p>
          <p className="mt-4 text-sm text-white/45">
            Applicant {application.display_code} · stage: {application.stage} · status: {application.status}
          </p>
          <p className="mt-1 text-sm text-white/45">Logged in as {applicant.email}</p>

          <form action={logout} className="mt-8">
            <button className="rounded-full border border-white/15 px-6 py-4 text-xs font-extrabold uppercase tracking-[0.16em] text-white/70 transition hover:border-[var(--orange)] hover:text-white">
              Logout
            </button>
          </form>
        </section>
      </div>
    );
  }

  const { data: events } = await supabase
    .from("v_open_rush_events")
    .select("id, title, event_date, location")
    .order("event_date", { ascending: true });

  const { data: checkins } = await supabase.rpc("my_checkins");
  const checkinList = Array.isArray(checkins) ? checkins : [];
  const attendanceCount = checkinList.length;
  const attendanceTotal = events?.length ?? 0;
  const applicantSteps = [
    {
      index: "01",
      label: "Profile",
      value: applicant.fullName ? "Ready" : "Add your name",
      complete: Boolean(applicant.fullName),
    },
    {
      index: "02",
      label: "Open rush",
      value: `${attendanceCount}/${attendanceTotal} check-ins`,
      complete: attendanceCount > 0,
    },
    {
      index: "03",
      label: "Application",
      value: "Not submitted",
      complete: false,
    },
  ];

  return (
    <div className="grid gap-8">
      {membershipBanner}
      <section className="panel-strong rounded-[2rem] p-7 md:p-10">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-start">
          <div>
            <p className="eyebrow">Applicant Dashboard</p>
            <h2 className="font-display mt-5 max-w-4xl text-5xl font-bold uppercase leading-[0.9] tracking-[-0.07em] md:text-7xl">
              Welcome{applicant.fullName ? `, ${applicant.fullName.split(" ")[0]}` : ""}.
            </h2>
            <p className="mt-6 max-w-2xl text-white/58">
              Your email is saved from login and is attached to your check-ins and application automatically.
            </p>
          </div>

          <form action={logout}>
            <button className="rounded-full border border-white/15 px-5 py-3 text-xs font-extrabold uppercase tracking-[0.16em] text-white/70 transition hover:border-[var(--orange)] hover:text-white">
              Logout
            </button>
          </form>
        </div>
      </section>

      {params?.checkin_success ? <Notice type="success">{params.checkin_success}</Notice> : null}
      {params?.checkin_error ? <Notice type="error">{params.checkin_error}</Notice> : null}
      {params?.application_error ? <Notice type="error">{params.application_error}</Notice> : null}

      <section aria-label="Application progress" className="grid gap-px overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/10 md:grid-cols-3">
        {applicantSteps.map((step) => (
          <article key={step.index} className="bg-[var(--navy-900)] p-5 md:p-6">
            <div className="flex items-center justify-between gap-4">
              <p className="font-mono text-xs font-bold text-[var(--orange)]">{step.index}</p>
              <span className={`rounded-full border px-3 py-1 text-[0.62rem] font-bold uppercase tracking-[0.12em] ${
                step.complete
                  ? "border-green-300/25 bg-green-400/10 text-green-100"
                  : "border-white/10 bg-white/[0.03] text-white/38"
              }`}>
                {step.complete ? "Recorded" : "Open"}
              </span>
            </div>
            <h3 className="font-display mt-6 text-2xl font-bold uppercase tracking-[-0.04em]">{step.label}</h3>
            <p className="mt-2 text-sm text-white/48">{step.value}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-5 md:grid-cols-3">
        <article className="panel rounded-[1.5rem] p-6">
          <p className="eyebrow">Profile</p>
          <p className="mt-5 text-sm text-white/40">Name</p>
          <p className="mt-1 text-xl font-bold">{applicant.fullName || "Not added yet"}</p>
          <p className="mt-5 text-sm text-white/40">Email</p>
          <p className="mt-1 break-all text-xl font-bold">{applicant.email}</p>
        </article>

        <article className="panel rounded-[1.5rem] p-6">
          <p className="eyebrow">Open Rush Attendance</p>
          <p className="mt-5 text-5xl font-black">
            {attendanceCount}/{attendanceTotal}
          </p>
          <p className="mt-3 text-sm text-white/50">Only open rush events count here.</p>
        </article>

        <article className="panel rounded-[1.5rem] p-6">
          <p className="eyebrow">Application</p>
          <p className="mt-5 text-2xl font-black">Not submitted</p>
          <p className="mt-3 text-sm text-white/50">Once submitted, this dashboard will lock.</p>
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
                placeholder="Example: GOBLUE"
                className="portal-field focus-ring uppercase"
              />
            </label>

            <SubmitButton pendingText="Checking in...">Check In</SubmitButton>
          </form>

          <div className="mt-8">
            <p className="text-sm font-bold text-white">Your open rush check-ins</p>
            {checkinList.length > 0 ? (
              <ul className="mt-3 grid gap-2 text-sm text-white/55">
                {checkinList.map((c, i) => (
                  <li key={i} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    {c.event_title || "Open Rush Event"} · {new Date(c.checked_in_at).toLocaleString()}
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

          <form action={submitApplication} className="mt-6 grid gap-4">
            <label className="grid gap-2">
              <span className="text-sm font-bold">Full name</span>
              <input
                name="full_name"
                required
                defaultValue={applicant.fullName || ""}
                className="portal-field focus-ring"
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-bold">Year</span>
                <input name="year" required placeholder="2028" className="portal-field focus-ring" />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-bold">Major</span>
                <input name="major" required placeholder="IOE, Data Science, etc." className="portal-field focus-ring" />
              </label>
            </div>

            <label className="grid gap-2">
              <span className="text-sm font-bold">Resume (PDF, required)</span>
              <input
                name="resume"
                type="file"
                accept="application/pdf"
                required
                className="portal-field focus-ring"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-bold">Why do you want to join MECG?</span>
              <textarea name="why_mecg" required rows={4} className="portal-field focus-ring" />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-bold">Tell us about a time you worked on a team.</span>
              <textarea name="teamwork" required rows={4} className="portal-field focus-ring" />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-bold">Describe a problem you broke down and solved.</span>
              <textarea name="problem_solving" required rows={4} className="portal-field focus-ring" />
            </label>

            <SubmitButton pendingText="Submitting...">Submit Application</SubmitButton>
          </form>
        </article>
      </section>
    </div>
  );
}
